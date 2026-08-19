import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://auth.bantrbox.com";
const visitorCookie = "bb_topic_visitor";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

async function sign(value: string) {
  const secret = process.env.TOPIC_VISITOR_SECRET;
  if (!secret) throw new Error("TOPIC_VISITOR_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function visitorIdentity(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const encoded = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${visitorCookie}=`))
    ?.slice(visitorCookie.length + 1);
  const decoded = encoded ? decodeURIComponent(encoded) : "";
  const [candidateId, candidateSignature] = decoded.split(".");
  let id = candidateId;
  let isNew = false;

  if (!id || !candidateSignature || candidateSignature !== await sign(id)) {
    id = crypto.randomUUID();
    isNew = true;
  }

  const signature = await sign(id);
  return {
    visitorHash: await digest(`visitor:${id}`),
    cookie: isNew ? `${visitorCookie}=${encodeURIComponent(`${id}.${signature}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000` : "",
  };
}

export function adminSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await adminSupabase().auth.getUser(token);
  return error ? null : data.user;
}

export async function actorHash(request: Request, visitorHash: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return digest(`${visitorHash}:${forwarded}`);
}

export async function enforceRateLimit(
  topicId: string,
  actor: string,
  action: string,
  maximum = 30
) {
  const client = adminSupabase();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await client
    .from("campaign_topic_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId)
    .eq("actor_hash", actor)
    .gte("created_at", since);
  if ((count || 0) >= maximum) return false;
  await client.from("campaign_topic_rate_events").insert({ topic_id: topicId, actor_hash: actor, action });
  return true;
}

export function json(data: unknown, status = 200, cookie = "") {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}

