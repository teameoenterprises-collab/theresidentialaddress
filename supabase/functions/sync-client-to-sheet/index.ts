// supabase/functions/sync-client-to-sheet/index.ts
//
// Purpose: Called directly from the portal right after a client signs up
// (same pattern as the existing notify() -> send-email call). Appends one
// row to a Google Sheet with the client's name, signup date, email,
// address, country, and phone.
//
// This function is READ-ONLY with respect to your Supabase data — it
// doesn't touch `profiles` or any table at all, it just relays the data
// it's handed to a Google Apps Script Web App, which appends one row.
//
// Auth: deployed WITH JWT verification (the default — do NOT use
// --no-verify-jwt). Supabase checks the caller has a valid logged-in
// session before this code runs, same as send-email already does.
//
// CORS: browsers calling this from theresidentialaddress.com send a
// preflight OPTIONS request first. We answer that with the right headers,
// then include the same headers on the real response.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")!;
const APPS_SCRIPT_SECRET = Deno.env.get("APPS_SCRIPT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Browser preflight check — must answer this before the real POST works.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    country?: string;
    created_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const name = body.name ?? "";
  const email = body.email ?? "";
  const phone = body.phone ?? "";
  const address = body.address ?? "";
  const country = body.country ?? "";
  const createdAt = body.created_at ?? new Date().toISOString();

  try {
    const url = `${APPS_SCRIPT_URL}?secret=${encodeURIComponent(APPS_SCRIPT_SECRET)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, created_at: createdAt, email, address, country, phone }),
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Apps Script relay failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("sync-client-to-sheet error:", err);
    return new Response("Failed to sync to sheet", { status: 500, headers: corsHeaders });
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
});