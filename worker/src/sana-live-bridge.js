import sanaBookingWorker from "./sana-booking-worker.js";

const ONLINE_WINDOW_MS = 45 * 1000;
const CONNECT_WINDOW_MS = 3 * 60 * 1000;
const now = () => Date.now();

function cors(request) {
  const origin = request.headers.get("Origin");
  const allowed = [
    "https://naveenshankar.in",
    "https://www.naveenshankar.in",
    "https://admin.naveenshankar.in",
  ];
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Sana-Session,X-Sana-Timezone",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(request) },
  });
}

function sessionId(request) {
  const id = request.headers.get("X-Sana-Session") || "";
  return /^[a-zA-Z0-9_-]{12,100}$/.test(id) ? id : null;
}

async function handleLegacyLiveName(request, env) {
  if (request.method !== "POST") return null;

  const session = sessionId(request);
  if (!session) return null;

  const body = await request.clone().json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 120) : "";
  if (!message) return null;

  // The older visitor chat asks for the visitor's name through /public/chat.
  // Detect that exact conversation state and turn the next message into a
  // real live connection request instead of sending it back to the AI.
  const previous = await env.DB.prepare(
    "SELECT sender,message FROM sana_messages WHERE session_id=? AND conversation_id IS NULL ORDER BY id DESC LIMIT 1"
  ).bind(session).first();

  if (
    !previous ||
    previous.sender !== "sana" ||
    !/may I have your name/i.test(String(previous.message || ""))
  ) {
    return null;
  }

  const presence = await env.DB.prepare("SELECT * FROM sana_presence WHERE id=1").first();
  const online = !!presence && Number(presence.online) === 1 && now() - Number(presence.last_seen_at || 0) <= ONLINE_WINDOW_MS;
  if (!online) {
    const reply = "Naveen is offline right now. Please try again when he is online. 💙";
    await env.DB.prepare(
      "INSERT INTO sana_messages(session_id,conversation_id,sender,message,created_at) VALUES(?,?,?,?,?)"
    ).bind(session, null, "sana", reply, now()).run();
    return json(request, { reply, action: "naveen_offline", online: false });
  }

  const existing = await env.DB.prepare(
    "SELECT * FROM sana_connect_requests WHERE session_id=? AND status IN('pending','accepted') ORDER BY id DESC LIMIT 1"
  ).bind(session).first();

  if (existing && existing.status === "pending" && Number(existing.expires_at) > now()) {
    const reply = "Your connection request is already waiting for Naveen. 💙";
    return json(request, {
      reply,
      action: "connect_requested",
      conversation_id: existing.conversation_id,
      request_id: existing.id,
      expires_at: existing.expires_at,
      status: "pending",
    });
  }

  if (existing && existing.status === "accepted") {
    return json(request, {
      reply: "You're already connected with Naveen. 💬",
      action: "connected",
      conversation_id: existing.conversation_id,
      request_id: existing.id,
      status: "accepted",
    });
  }

  if (existing && existing.status === "pending") {
    await env.DB.prepare(
      "UPDATE sana_connect_requests SET status='expired',updated_at=? WHERE id=? AND status='pending'"
    ).bind(now(), existing.id).run();
  }

  const conversationId = crypto.randomUUID();
  const created = now();
  const expires = created + CONNECT_WINDOW_MS;
  const result = await env.DB.prepare(
    "INSERT INTO sana_connect_requests(session_id,status,conversation_id,created_at,expires_at,updated_at,visitor_name) VALUES(?, 'pending', ?, ?, ?, ?, ?)"
  ).bind(session, conversationId, created, expires, created, message).run();

  const reply = `Thanks, ${message}! 😊 Naveen is online. I've sent him your live connection request. I'll wait for his Accept or Reject decision.`;
  await env.DB.prepare(
    "INSERT INTO sana_messages(session_id,conversation_id,sender,message,created_at) VALUES(?,?,?,?,?)"
  ).bind(session, conversationId, "sana", reply, created).run();

  return json(request, {
    reply,
    action: "connect_requested",
    conversation_id: conversationId,
    request_id: result.meta?.last_row_id || null,
    expires_at: expires,
    status: "pending",
  });
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/public/chat" && request.method === "POST") {
      const live = await handleLegacyLiveName(request, env);
      if (live) return live;
    }
    return sanaBookingWorker.fetch(request, env, ctx);
  },
};
