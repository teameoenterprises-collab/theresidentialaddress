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
// Auth: deployed WITH --no-verify-jwt this time. Reason: when a function
// requires the platform's automatic JWT check AND needs custom CORS
// headers, Supabase checks the JWT before your code (and its CORS
// headers) ever runs — which breaks the browser preflight. So instead we
// disable the platform check and verify the caller's session ourselves,
// inside the function, after CORS is already handled.
//
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically by
// Supabase to every Edge Function — no need to set them as secrets.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")!;
const APPS_SCRIPT_SECRET = Deno.env.get("APPS_SCRIPT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Confirms the Authorization header is a real, currently-valid Supabase
// login session (not just any string) by asking Supabase Auth directly.
async function isLoggedIn(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Browser preflight check — answered immediately, before any auth check.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const loggedIn = await isLoggedIn(req.headers.get("Authorization"));
  if (!loggedIn) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
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