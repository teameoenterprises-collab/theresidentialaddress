// ================================================================
// EMAIL CONTENT — THE ONLY FILE YOU NEED TO TOUCH
// ================================================================
// Every automated email's subject line and body copy lives here.
// To change what any email says: edit the strings below, redeploy
// with `supabase functions deploy send-email`, done.
//
// Each entry is a function that takes the data the Edge Function
// looked up server-side and returns { to, bcc, subject, title,
// body, cta, ctaUrl }. "to"/"bcc" are usually filled in by
// index.ts (it knows who's allowed to be emailed), but you can
// override them here if you want to change *who* gets an email
// without touching server logic.
// ================================================================

export const EMAIL_CONTENT: Record<string, (d: any) => {
  subject: string;
  title: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
}> = {

  // Admin notification — new client signed up.
  new_signup: (d) => ({
    subject: `🆕 New Client: ${d.clientName}`,
    title: 'New Client Signed Up',
    body: `
      <p>A new client has created an account.</p>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        <tr><td style="padding:7px 0;color:#888;font-size:13px;width:80px;">Name</td><td style="padding:7px 0;font-weight:600;font-size:13px;">${d.clientName}</td></tr>
        <tr><td style="padding:7px 0;color:#888;font-size:13px;">Email</td><td style="padding:7px 0;font-size:13px;">${d.clientEmail}</td></tr>
      </table>`,
    cta: 'View in Portal',
    ctaUrl: d.portalUrl,
  }),

  // Client welcome email — sent right after signup. BCCs the
  // referral partner automatically when the signup came via a ref link.
  welcome_client: (d) => ({
    subject: '🎉 Welcome to The Residential Address',
    title: `Welcome, ${d.clientName}!`,
    body: `
      <p>Your account has been created and your portal is ready to go.</p>
      <p style="margin-top:12px;">From here you can track incoming mail, view your assigned address and lease details, upload documents, and reach out to us any time through the ticket system.</p>
      ${d.paymentLink ? `<p style="margin-top:12px;"><strong>Next step:</strong> please complete your payment to activate your address and avoid it being released back into stock.</p>` : ''}
      <p style="margin-top:12px;">If anything looks off or you have questions getting started, just open a ticket from your portal and we'll help right away.</p>`,
    cta: d.paymentLink ? 'Complete Payment' : 'Go to My Portal',
    ctaUrl: d.paymentLink || d.portalUrl,
  }),

  // Admin notification — new support ticket.
  new_ticket: (d) => ({
    subject: `🎫 New ticket: ${d.ticketTitle}`,
    title: 'New Support Ticket',
    body: `
      <p>A client has submitted a new support ticket.</p>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        <tr><td style="padding:7px 0;color:#888;font-size:13px;width:80px;">Client</td><td style="padding:7px 0;font-weight:600;font-size:13px;">${d.clientName} (${d.clientEmail})</td></tr>
        <tr><td style="padding:7px 0;color:#888;font-size:13px;">Title</td><td style="padding:7px 0;font-size:13px;">${d.ticketTitle}</td></tr>
      </table>`,
    cta: 'View in Portal',
    ctaUrl: d.portalUrl,
  }),

  // Admin notification — client replied to an existing ticket.
  client_ticket_reply: (d) => ({
    subject: `💬 Client replied: ${d.ticketTitle}`,
    title: 'Client Replied to Ticket',
    body: `
      <p><strong>${d.clientName}</strong> (${d.clientEmail}) replied to their ticket.</p>
      <p style="margin-top:8px;font-weight:600;">${d.ticketTitle}</p>
      <div style="margin:14px 0;padding:14px 16px;background:#f5f0e8;border-left:3px solid #b8973a;border-radius:0 8px 8px 0;font-size:13.5px;line-height:1.6;">${d.replyTextEscaped}</div>`,
    cta: 'View in Portal',
    ctaUrl: d.portalUrl,
  }),

  // Client notification — new mail scanned/uploaded.
  mail_uploaded: (d) => ({
    subject: `📬 New mail from ${d.sender}`,
    title: 'You have new mail',
    body: `
      <p>Hi ${d.clientName},</p><p>A new mail item has been uploaded to your portal.</p>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        <tr><td style="padding:7px 0;color:#888;font-size:13px;width:80px;">From</td><td style="padding:7px 0;font-weight:600;font-size:13px;">${d.sender}</td></tr>
        <tr><td style="padding:7px 0;color:#888;font-size:13px;">Subject</td><td style="padding:7px 0;font-size:13px;">${d.subject || '—'}</td></tr>
      </table>`,
    cta: 'View My Mail',
    ctaUrl: d.portalUrl,
  }),

  // Client notification — new document uploaded.
  doc_uploaded: (d) => ({
    subject: '📄 New document added to your account',
    title: 'New Document Available',
    body: `
      <p>Hi ${d.clientName},</p><p>A new document has been added to your portal.</p>
      <p style="margin-top:12px;padding:12px 16px;background:#f5f0e8;border-radius:8px;font-weight:600;font-size:14px;">📄 ${d.docName}</p>`,
    cta: 'View Documents',
    ctaUrl: d.portalUrl,
  }),

  // Client notification — proof of address assigned.
  proof_assigned: (d) => ({
    subject: '🏠 Proof of address assigned',
    title: 'Proof of Address Assigned',
    body: `
      <p>Hi ${d.clientName},</p><p>A proof of address document has been assigned to your account.</p>
      <p style="margin-top:12px;padding:12px 16px;background:#f5f0e8;border-radius:8px;font-weight:600;font-size:14px;">📋 ${d.proofType}</p>`,
    cta: 'View My Portal',
    ctaUrl: d.portalUrl,
  }),

  // Admin-triggered — "Send Test Email" button in settings.
  test_email: (d) => ({
    subject: '✅ The Residential Address — email test',
    title: 'Email configuration is working!',
    body: `<p>Your portal email notifications are set up correctly. All enabled triggers will now send emails automatically.</p>`,
  }),

  // Client notification — staff replied to their ticket.
  admin_reply: (d) => ({
    subject: `💬 Reply to your ticket: ${d.ticketTitle}`,
    title: 'Your ticket has a new reply',
    body: `
      <p>Hi ${d.clientName},</p><p>Your account manager has replied to your support ticket.</p>
      <div style="margin:16px 0;padding:14px 16px;background:#f5f0e8;border-left:3px solid #b8973a;border-radius:0 8px 8px 0;font-size:13.5px;line-height:1.6;">${d.replyTextEscaped}</div>`,
    cta: 'View Ticket',
    ctaUrl: d.portalUrl,
  }),
};