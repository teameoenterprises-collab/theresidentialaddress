export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      event,
      message_id,
      ticket_id,
    } = req.body || {};

    if (!event) {
      return res.status(400).json({ error: 'Missing event' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      !N8N_WEBHOOK_URL ||
      !N8N_WEBHOOK_SECRET
    ) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const headers = {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
    };

    // Verify logged-in Supabase user
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      { headers }
    );

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await userResponse.json();

    // Get client name
    let clientName = 'Client';

    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=full_name`,
      { headers }
    );

    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      if (profiles?.[0]?.full_name) {
        clientName = profiles[0].full_name;
      }
    }

    let notification;

    // ---------------------------------------------------------
    // MESSAGE YOUR REP
    // ---------------------------------------------------------
    if (event === 'rep_message') {
      if (!message_id) {
        return res.status(400).json({ error: 'Missing message_id' });
      }

      const msgResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/ticket_messages?id=eq.${encodeURIComponent(message_id)}&sender_id=eq.${encodeURIComponent(user.id)}&select=id,ticket_id,body`,
        { headers }
      );

      if (!msgResponse.ok) {
        return res.status(500).json({ error: 'Could not load message' });
      }

      const messages = await msgResponse.json();

      if (!messages.length) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const message = messages[0];

      notification = {
        event: 'rep_message',
        client_name: clientName,
        title: 'Message Your Rep',
        type: 'Mail Inquiry',
        description: message.body,
        ticket_id: message.ticket_id,
        portal_url: 'https://www.theresidentialaddress.com/portal',
      };
    }

    // ---------------------------------------------------------
    // SHIP MAIL REQUEST
    // ---------------------------------------------------------
    else if (event === 'ship_request') {
      if (!ticket_id) {
        return res.status(400).json({ error: 'Missing ticket_id' });
      }

      const ticketResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/tickets?id=eq.${encodeURIComponent(ticket_id)}&user_id=eq.${encodeURIComponent(user.id)}&type=eq.ship_mail&select=id,ticket_number,title,type,description`,
        { headers }
      );

      if (!ticketResponse.ok) {
        return res.status(500).json({ error: 'Could not load ticket' });
      }

      const tickets = await ticketResponse.json();

      if (!tickets.length) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const ticket = tickets[0];

      notification = {
        event: 'ship_request',
        client_name: clientName,
        title: ticket.title,
        type: 'Ship Mail Request',
        description: ticket.description,
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        portal_url: 'https://www.theresidentialaddress.com/portal',
      };
    }

    else {
      return res.status(400).json({ error: 'Unknown event' });
    }

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify(notification),
    });

    if (!n8nResponse.ok) {
      console.error('n8n error:', await n8nResponse.text());
      return res.status(502).json({ error: 'Notification failed' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Ticket notification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

