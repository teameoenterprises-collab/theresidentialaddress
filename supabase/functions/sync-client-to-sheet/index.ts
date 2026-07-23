// supabase/functions/sync-client-to-sheet/index.ts
//
// Purpose: When a new row is INSERTed into `profiles` (i.e. a client signs
// up), append a row to a Google Sheet with their name, signup date, email,
// address, country, and phone.
//
// This function is READ-ONLY with respect to your Supabase data — it never
// updates, deletes, or overwrites anything in `profiles` or any other table.
// It only reads the new row it's handed by the webhook and APPENDS a row to
// the Sheet. Existing rows in the Sheet and existing client data in Supabase
// are never touched.
//
// Trigger: a Supabase Database Webhook on table `profiles`, event = INSERT.
// See the deployment steps for exact setup.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── Environment secrets (set these with `supabase secrets set`) ──────────
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const GOOGLE_PRIVATE_KEY = (Deno.env.get("GOOGLE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const GOOGLE_SHEET_TAB = Deno.env.get("GOOGLE_SHEET_TAB") ?? "Sheet1";
// Shared secret so only your Supabase webhook can call this function
// (the function has verify_jwt = false, since webhooks don't send a user JWT).
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;

// ── Google OAuth: exchange the service account key for an access token ───
async function getAccessToken(): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsigned = `${enc(header)}.${enc(claim)}`;

  const keyData = pemToArrayBuffer(GOOGLE_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${unsigned}.${encodedSig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Append one row to the sheet (never overwrites existing rows) ─────────
async function appendRow(accessToken: string, row: (string | null)[]) {
  const range = `${GOOGLE_SHEET_TAB}!A:F`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!res.ok) {
    throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`);
  }
}

// ── Main handler ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify the shared secret set on the Database Webhook's custom header.
  const incomingSecret = req.headers.get("x-webhook-secret");
  if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    type?: string;
    table?: string;
    record?: Record<string, unknown>;
  };

  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Only handle INSERTs on profiles — ignore anything else defensively.
  if (payload.type !== "INSERT" || payload.table !== "profiles" || !payload.record) {
    return new Response("Ignored (not a profiles INSERT)", { status: 200 });
  }

  const record = payload.record;

  const name = (record.full_name as string) ?? "";
  const email = (record.email as string) ?? "";
  const phone = (record.phone as string) ?? (record.whatsapp as string) ?? "";
  const address = (record.mailing_address as string) ?? "";
  const country = (record.country as string) ?? "";
  const createdAt = (record.created_at as string) ?? new Date().toISOString();

  const row = [name, createdAt, email, address, country, phone];

  try {
    const accessToken = await getAccessToken();
    await appendRow(accessToken, row);
  } catch (err) {
    console.error("sync-client-to-sheet error:", err);
    return new Response("Failed to sync to sheet", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});