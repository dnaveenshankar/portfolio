import { verifySessionToken } from "./auth.js";

const ONLINE_WINDOW_MS = 45 * 1000;
const CONNECT_WINDOW_MS = 3 * 60 * 1000;
const ALLOWED_ORIGINS = [
  "https://admin.naveenshankar.in",
  "https://naveenshankar.in",
  "https://www.naveenshankar.in",
];

const now = () => Date.now();

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Sana-Session,X-Sana-Timezone",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

async function adminAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? verifySessionToken(env.SESSION_SECRET, token) : null;
}

function visitorSession(request) {
  const id = request.headers.get("X-Sana-Session") || "";
  return /^[a-zA-Z0-9_-]{12,100}$/.test(id) ? id : null;
}

async function getPresence(env) {
  const p = await env.DB.prepare("SELECT * FROM sana_presence WHERE id=1").first();
  const online = !!p && Number(p.online) === 1 && now() - Number(p.last_seen_at || 0) <= ONLINE_WINDOW_MS;
  return { online, presence: p || null };
}

async function expireIfNeeded(env, requestRow) {
  if (requestRow && requestRow.status === "pending" && Number(requestRow.expires_at) <= now()) {
    await env.DB.prepare("UPDATE sana_connect_requests SET status='expired',updated_at=? WHERE id=? AND status='pending'")
      .bind(now(), requestRow.id).run();
    return "expired";
  }
  return requestRow?.status || null;
}

async function publicConnect(request, env) {
  const session = visitorSession(request);
  if (!session) return json(request, { error: "A valid Sana session is required." }, 400);
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return json(request, { error: "Please provide your name." }, 400);

  const { online } = await getPresence(env);

  const existing = await env.DB.prepare(
    "SELECT * FROM sana_connect_requests WHERE session_id=? AND status IN('pending','accepted') ORDER BY id DESC LIMIT 1"
  ).bind(session).first();
  if (existing) {
    const status = await expireIfNeeded(env, existing);
    if (status === "accepted") {
      return json(request, { reply: "You're already connected with Naveen. 💬", action: "connected", conversation_id: existing.conversation_id, status });
    }
    if (status === "pending") {
      return json(request, { reply: online ? "Your connection request is already waiting for Naveen. 💙" : "Your connection request is queued. Naveen will see it when he is online. 💙", action: "connect_requested", conversation_id: existing.conversation_id, expires_at: existing.expires_at, status, online });
    }
  }

  const conversationId = crypto.randomUUID();
  const created = now();
  const expires = created + CONNECT_WINDOW_MS;
  const result = await env.DB.prepare(
    "INSERT INTO sana_connect_requests(session_id,status,conversation_id,created_at,expires_at,updated_at,visitor_name) VALUES(?, 'pending', ?, ?, ?, ?, ?)"
  ).bind(session, conversationId, created, expires, created, name).run();

  await env.DB.prepare(
    "INSERT INTO sana_messages(session_id,conversation_id,sender,message,created_at) VALUES(?,?,?,?,?)"
  ).bind(session, conversationId, "sana", online
    ? `Hi ${name}! 👋 I've sent Naveen a live connection request. Please wait for him to accept it.`
    : `Hi ${name}! 👋 Your live connection request is queued for Naveen. He is currently offline, but the request has been saved.`, created).run();

  return json(request, {
    reply: online
      ? `Thanks, ${name}! 😊 Naveen is online. I've sent him your live connection request. I'll wait for his Accept or Reject decision.`
      : `Thanks, ${name}! 😊 I've saved your live connection request. Naveen is currently offline and can see it when he comes online.`,
    action: "connect_requested",
    conversation_id: conversationId,
    expires_at: expires,
    request_id: result.meta?.last_row_id || null,
    status: "pending",
    online,
  });
}

async function publicLive(request, env) {
  const session = visitorSession(request);
  if (!session) return json(request, { error: "A valid Sana session is required." }, 400);
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation_id");
  const after = Math.max(0, Number(url.searchParams.get("after") || 0));
  if (!conversationId) return json(request, { error: "conversation_id is required" }, 400);

  const row = await env.DB.prepare(
    "SELECT * FROM sana_connect_requests WHERE conversation_id=? AND session_id=? ORDER BY id DESC LIMIT 1"
  ).bind(conversationId, session).first();
  if (!row) return json(request, { error: "Connection not found" }, 404);

  let status = await expireIfNeeded(env, row);
  if (status === "expired") return json(request, { status: "expired", messages: [] });

  const messages = await env.DB.prepare(
    "SELECT id,sender,message,created_at FROM sana_messages WHERE conversation_id=? AND id>? ORDER BY id ASC LIMIT 100"
  ).bind(conversationId, after).all();

  return json(request, {
    status,
    expires_at: row.expires_at,
    visitor_name: row.visitor_name || null,
    messages: messages.results || [],
  });
}

async function publicMessage(request, env) {
  const session = visitorSession(request);
  if (!session) return json(request, { error: "A valid Sana session is required." }, 400);
  const body = await request.json().catch(() => ({}));
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!conversationId || !message) return json(request, { error: "conversation_id and message are required" }, 400);

  const row = await env.DB.prepare(
    "SELECT * FROM sana_connect_requests WHERE conversation_id=? AND session_id=? ORDER BY id DESC LIMIT 1"
  ).bind(conversationId, session).first();
  if (!row) return json(request, { error: "Connection not found" }, 404);
  const status = await expireIfNeeded(env, row);
  if (status !== "accepted") return json(request, { error: "The live connection is not active.", status }, 409);

  const created = now();
  await env.DB.prepare(
    "INSERT INTO sana_messages(session_id,conversation_id,sender,message,created_at) VALUES(?,?,?,?,?)"
  ).bind(session, conversationId, "visitor", message, created).run();
  return json(request, { ok: true, created_at: created });
}

async function adminHeartbeat(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const online = body.online === undefined ? true : !!body.online;
  const username = auth.username || auth.email || "admin";
  const stamp = now();
  await env.DB.prepare(
    "INSERT INTO sana_presence(id,online,last_seen_at,admin_username,updated_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET online=excluded.online,last_seen_at=excluded.last_seen_at,admin_username=excluded.admin_username,updated_at=excluded.updated_at"
  ).bind(online ? 1 : 0, stamp, username, stamp).run();
  return json(request, { online, last_seen_at: stamp });
}

async function adminRequests(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);

  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT r.*,s.country,s.timezone FROM sana_connect_requests r LEFT JOIN sana_sessions s ON s.id=r.session_id WHERE r.status IN('pending','accepted') AND (r.status!='pending' OR r.expires_at>?) ORDER BY r.created_at DESC LIMIT 50"
    ).bind(now()).all();
    return json(request, { requests: rows.results || [] });
  }

  return json(request, { error: "Use the approve or reject endpoint." }, 405);
}

async function adminDecision(request, env, id, decision) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const row = await env.DB.prepare("SELECT * FROM sana_connect_requests WHERE id=?").bind(id).first();
  if (!row) return json(request, { error: "Request not found" }, 404);
  if (row.status !== "pending") return json(request, { error: `Request is already ${row.status}`, status: row.status }, 409);
  if (Number(row.expires_at) <= now()) {
    await env.DB.prepare("UPDATE sana_connect_requests SET status='expired',updated_at=? WHERE id=?").bind(now(), id).run();
    return json(request, { error: "Request expired", status: "expired" }, 409);
  }

  const status = decision === "approve" ? "accepted" : "declined";
  await env.DB.prepare("UPDATE sana_connect_requests SET status=?,updated_at=? WHERE id=?").bind(status, now(), id).run();
  return json(request, { ok: true, status, conversation_id: row.conversation_id, visitor_name: row.visitor_name || null });
}

async function adminMessages(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  let conversationId = url.searchParams.get("conversation_id") || "";
  let body = null;
  if (request.method === "POST") body = await request.json().catch(() => ({}));
  if (!conversationId && typeof body?.conversation_id === "string") conversationId = body.conversation_id.trim();

  if (!conversationId) {
    const fallback = await env.DB.prepare(
      "SELECT conversation_id FROM sana_connect_requests WHERE status='accepted' ORDER BY updated_at DESC, id DESC LIMIT 1"
    ).first();
    conversationId = fallback?.conversation_id || "";
  }
  if (!conversationId) return json(request, { error: "No active Sana conversation" }, 409);

  const row = await env.DB.prepare("SELECT * FROM sana_connect_requests WHERE conversation_id=? LIMIT 1").bind(conversationId).first();
  if (!row) return json(request, { error: "Connection not found" }, 404);

  if (request.method === "GET") {
    const after = Math.max(0, Number(url.searchParams.get("after") || 0));
    const messages = await env.DB.prepare("SELECT id,sender,message,created_at FROM sana_messages WHERE conversation_id=? AND id>? ORDER BY id ASC LIMIT 100").bind(conversationId, after).all();
    return json(request, { status: row.status, expires_at: row.expires_at, visitor_name: row.visitor_name || null, conversation_id: conversationId, messages: messages.results || [] });
  }

  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return json(request, { error: "message is required" }, 400);
  if (row.status !== "accepted") return json(request, { error: "Connection is not active.", status: row.status }, 409);
  if (Number(row.expires_at) <= now()) {
    await env.DB.prepare("UPDATE sana_connect_requests SET status='expired',updated_at=? WHERE id=?").bind(now(), row.id).run();
    return json(request, { error: "Connection expired", status: "expired" }, 409);
  }
  const created = now();
  await env.DB.prepare("INSERT INTO sana_messages(session_id,conversation_id,sender,message,created_at) VALUES(?,?,?,?,?)").bind(row.session_id, conversationId, "naveen", message, created).run();
  return json(request, { ok: true, created_at: created, conversation_id: conversationId });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
    const path = new URL(request.url).pathname;
    try {
      if (path === "/public/sana/connect" && request.method === "POST") return publicConnect(request, env);
      if (path === "/public/sana/live" && request.method === "GET") return publicLive(request, env);
      if (path === "/public/sana/message" && request.method === "POST") return publicMessage(request, env);
      if (path === "/admin/sana/heartbeat" && request.method === "POST") return adminHeartbeat(request, env);
      if (path === "/admin/sana/requests" && request.method === "GET") return adminRequests(request, env);
      const approve = path.match(/^\/admin\/sana\/requests\/(\d+)\/(approve|reject)$/);
      if (approve && request.method === "POST") return adminDecision(request, env, Number(approve[1]), approve[2] === "approve" ? "approve" : "reject");
      if (path === "/admin/sana/messages" && (request.method === "GET" || request.method === "POST")) return adminMessages(request, env);
      return null;
    } catch (error) {
      return json(request, { error: "Sana live service failed", detail: String(error?.message || error) }, 500);
    }
  },
};
