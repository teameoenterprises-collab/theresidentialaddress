// ================================================================
// send-email Edge Function
// ================================================================
// The Resend API key never leaves this function. The browser never
// sends "to/subject/html" directly — it only sends an `action` name
// (e.g. "welcome_client") and a small payload (e.g. { ticket_id }).
// This function looks up who's allowed to be emailed *itself*,
// using the service-role key, so an authenticated client can't use
// this endpoint as an open mail relay to send arbitrary content to
// arbitrary addresses.
// ================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail, escHtml } from "./templates.ts";

const corsHeaders = {
  // Tighten this to your real domain before going to production.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_ONLY_ACTIONS = new Set(["mail_uploaded", "doc_uploaded", "proof_assigned", "admin_reply", "test_email"]);
const SELF_ACTIONS = new Set(["new_signup", "welcome_client", "new_ticket", "client_ticket_reply"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    // Client used ONLY to identify who is calling (their own JWT).
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session" }, 401);

    // Service-role client — bypasses RLS, used ONLY inside this
    // trusted server function to look up who is *allowed* to be
    // emailed. Never exposed to the browser.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: callerProfile, error: profileErr } = await admin
      .from("profiles").select("*").eq("id", user.id).single();
    if (profileErr || !callerProfile) return json({ error: "No profile" }, 403);

    const { action, payload = {} } = await req.json();
    if (!action) return json({ error: "Missing action" }, 400);

    if (ADMIN_ONLY_ACTIONS.has(action) && callerProfile.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }
    if (!ADMIN_ONLY_ACTIONS.has(action) && !SELF_ACTIONS.has(action)) {
      return json({ error: "Unknown action" }, 400);
    }

    // Settings are stored as a single JSON row: key='email_settings'
    const { data: settingsRow } = await admin
      .from("admin_settings").select("value").eq("key", "email_settings").maybeSingle();
    const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : {};
    const notify = settings.notify || {};
    const portalUrl = Deno.env.get("PORTAL_URL") || "https://your-portal-domain.com";

    let to: string | null = null;
    let bcc: string | null = null;
    let data: Record<string, any> = { portalUrl };

    switch (action) {
      case "new_signup": {
        if (notify.signup === false) return json({ skipped: true });
        to = settings.adminEmail;
        data = { ...data, clientName: callerProfile.full_name, clientEmail: callerProfile.email };
        break;
      }

      case "welcome_client": {
        if (notify.welcome === false) return json({ skipped: true });
        to = callerProfile.email; // always the caller's own address — never client-supplied
        if (callerProfile.referral_partner_id) {
          const { data: rp } = await admin
            .from("referral_partners").select("contact_email")
            .eq("id", callerProfile.referral_partner_id).single();
          bcc = rp?.contact_email || null;
        }
        data = { ...data, clientName: callerProfile.full_name, paymentLink: settings.paymentLink || null };
        break;
      }

      case "new_ticket": {
        if (notify.newTicket === false) return json({ skipped: true });
        const { data: ticket } = await admin
          .from("tickets").select("*").eq("id", payload.ticket_id).eq("user_id", user.id).single();
        if (!ticket) return json({ error: "Ticket not found or not yours" }, 403);
        to = settings.adminEmail;
        data = { ...data, clientName: callerProfile.full_name, clientEmail: callerProfile.email, ticketTitle: ticket.title };
        break;
      }

      case "client_ticket_reply": {
        if (notify.clientReply === false) return json({ skipped: true });
        const { data: msg } = await admin
          .from("ticket_messages").select("*, tickets!inner(user_id, title)")
          .eq("id", payload.message_id).single();
        if (!msg || msg.tickets.user_id !== user.id) return json({ error: "Not your ticket" }, 403);
        to = settings.adminEmail;
        data = {
          ...data,
          clientName: callerProfile.full_name,
          clientEmail: callerProfile.email,
          ticketTitle: msg.tickets.title,
          replyTextEscaped: escHtml(String(msg.body || "").slice(0, 300)),
        };
        break;
      }

      case "test_email": {
        to = settings.adminEmail;
        break;
      }

      // ── Admin-triggered actions: target client is looked up
      // server-side from payload.client_id, never trusted verbatim. ──
      case "mail_uploaded":
      case "doc_uploaded":
      case "proof_assigned":
      case "admin_reply": {
        const notifyKey = { mail_uploaded: "mail", doc_uploaded: "doc", proof_assigned: "proof", admin_reply: "reply" }[action]!;
        if (notify[notifyKey] === false) return json({ skipped: true });

        const { data: client } = await admin
          .from("profiles").select("email, full_name").eq("id", payload.client_id).single();
        if (!client?.email) return json({ error: "Client not found" }, 404);
        to = client.email;

        if (action === "mail_uploaded") {
          data = { ...data, clientName: client.full_name, sender: payload.sender, subject: payload.subject };
        } else if (action === "doc_uploaded") {
          data = { ...data, clientName: client.full_name, docName: payload.doc_name };
        } else if (action === "proof_assigned") {
          data = { ...data, clientName: client.full_name, proofType: payload.proof_type };
        } else {
          data = {
            ...data,
            clientName: client.full_name,
            ticketTitle: payload.ticket_title,
            replyTextEscaped: escHtml(String(payload.reply_text || "").slice(0, 300)),
          };
        }
        break;
      }
    }

    if (!to || !to.includes("@")) return json({ skipped: true, reason: "no recipient" });

    const { subject, html } = renderEmail(action, data);

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `The Residential Address <${settings.fromEmail || "onboarding@resend.dev"}>`,
        to: [to],
        bcc: bcc ? [bcc] : undefined,
        subject,
        html,
      }),
    });

    const result = await resendResp.json();
    if (!resendResp.ok) return json({ error: result }, resendResp.status);
    return json({ ok: true, result });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});