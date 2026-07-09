// ================================================================
// TEMPLATES — the branded shell + rendering glue.
// You should rarely need to touch this file. Wording changes go in
// email-content.ts instead.
// ================================================================
import { EMAIL_CONTENT } from "./email-content.ts";

// Same branded wrapper you already had in your client-side
// email-templates.js, moved here unchanged.
export function emailWrap(title: string, body: string, cta?: string, ctaUrl?: string) {
  const btn = (cta && ctaUrl)
    ? `<div style="margin:28px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:#b8973a;color:#fff;font-weight:700;font-size:14px;padding:12px 26px;border-radius:8px;text-decoration:none;">${cta}</a></div>`
    : '';
  return `<div style="font-family:Outfit,sans-serif;background:#f5f0e8;padding:40px 20px;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);"><div style="background:#1a3a2a;padding:24px 32px;"><span style="font-size:18px;font-weight:600;color:#d4af55;letter-spacing:-0.3px;">The Residential Address</span></div><div style="padding:30px 32px;"><h2 style="font-size:20px;font-weight:600;color:#0c0f0a;margin:0 0 14px;">${title}</h2><div style="font-size:14px;color:#555;line-height:1.7;">${body}</div>${btn}</div><div style="background:#f5f0e8;padding:16px 32px;font-size:12px;color:#999;text-align:center;">The Residential Address — Client Portal · Automated notification.</div></div></div>`;
}

// Escapes anything that came from a user (ticket text, names) before
// it's spliced into an HTML email. Your old client-side version did
// this in the UI but NOT in the emails — this closes that gap.
export function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEmail(action: string, data: Record<string, any>) {
  const build = EMAIL_CONTENT[action];
  if (!build) throw new Error(`Unknown email action: ${action}`);
  const { subject, title, body, cta, ctaUrl } = build(data);
  return { subject, html: emailWrap(title, body, cta, ctaUrl) };
}