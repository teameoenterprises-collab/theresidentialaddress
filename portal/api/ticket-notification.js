export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { ticket_id } = req.body || {};

    if (!ticket_id) {
      return res.status(400).json({ error: 'Missing ticket_id' });
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
      console.error('Missing server environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify the currently logged-in Supabase user
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await userResponse.json();

    // Load the ticket using the user's own Supabase session.
    // Existing RLS still applies.
    const ticketResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/tickets?id=eq.${encodeURIComponent(ticket_id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,ticket_number,title,type,description`,
      {
        headers: {
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    if (!ticketResponse.ok) {
      console.error(await ticketResponse.text());
      return res.status(500).json({ error: 'Could not load ticket' });
    }

    const tickets = await ticketResponse.json();

    if (!tickets.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = tickets[0];

    // Load client's display name
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=full_name`,
      {
        headers: {
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    let clientName = 'Client';

    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      if (profiles?.[0]?.full_name) {
        clientName = profiles[0].full_name;
      }
    }

    const portalUrl =
      `https://www.theresidentialaddress.com/portal?ticket=${encodeURIComponent(ticket.id)}`;

    // Send trusted ticket data to n8n
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        client_name: clientName,
        title: ticket.title,
        type: ticket.type,
        description: ticket.description,
        portal_url: portalUrl,
      }),
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