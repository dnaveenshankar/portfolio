import existingWorker from "./index.js";
import { verifySessionToken } from "./auth.js";

const SERVICES = [
  "Networking",
  "Live session",
  "Lectures",
  "Guest appearance",
  "Web development",
  "Self-development coaching",
  "Career path guidance",
  "Resume / CV review",
  "Interview preparation",
  "Network troubleshooting consultation",
  "Technical mentoring",
  "Workshop / training",
];

const ONLINE_WINDOW_MS = 45 * 1000;
const CONNECT_WINDOW_MS = 3 * 60 * 1000;

function corsHeaders(request) {
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
    "Vary": "Origin",
  };
}

function json(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request), ...extraHeaders },
  });
}

function now() { return Date.now(); }

function timezoneFromRequest(request) {
  return request.headers.get("X-Sana-Timezone") || "Asia/Kolkata";
}

function partsForTimezone(timeZone, date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const text = fmt.format(date);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(date));
    return { text, hour, valid: true };
  } catch {
    const fallback = partsForTimezone("Asia/Kolkata", date);
    return { ...fallback, valid: false };
  }
}

function dayGreeting(hour) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hi";
}

function getSessionId(request) {
  const supplied = request.headers.get("X-Sana-Session");
  if (supplied && /^[a-zA-Z0-9_-]{12,100}$/.test(supplied)) return supplied;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  return `${ip}:${ua}`;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sessionId(request) {
  const supplied = request.headers.get("X-Sana-Session");
  if (supplied && /^[a-zA-Z0-9_-]{12,100}$/.test(supplied)) return supplied;
  return (await sha256(getSessionId(request))).slice(0, 40);
}

async function ensureSession(env, request) {
  const id = await sessionId(request);
  const timezone = timezoneFromRequest(request);
  const country = request.headers.get("CF-IPCountry") || "";
  await env.DB.prepare(
    `INSERT INTO sana_sessions (id, timezone, country, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET timezone = excluded.timezone, country = excluded.country, updated_at = excluded.updated_at`
  ).bind(id, timezone, country, now(), now()).run();
  return id;
}

function cleanAiText(result) {
  return (
    result?.response ||
    result?.output_text ||
    (Array.isArray(result?.output) && result.output.find((o) => o.content)?.content?.[0]?.text) ||
    ""
  ).trim();
}

async function getSanaContext(env) {
  const [profile, skills, experience, education, certifications, achievements, workshops, services, availability] = await Promise.all([
    env.DB.prepare("SELECT * FROM profile WHERE id = 1").first(),
    env.DB.prepare("SELECT name, category FROM skills ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT meta, title, summary, note FROM experience ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT meta, title, summary FROM education ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT title, summary FROM certifications ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT meta, title, summary FROM achievements ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT title, role, organizer, date, description FROM workshops ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT name, description FROM services ORDER BY sort_order ASC").all(),
    getAvailabilityStatus(env),
  ]);
  const dbServices = (services.results || []).map((s) => `${s.name}${s.description ? `: ${s.description}` : ""}`);
  const serviceList = [...new Set([...SERVICES, ...dbServices])];
  return {
    profile,
    availability,
    services: serviceList,
    text: `
Naveen: ${profile?.full_name || "Naveen Shankar D"}
Title: ${profile?.title || "Network Engineer"}
Location: ${profile?.location || ""}
Bio: ${profile?.bio || ""}
Email: ${profile?.email || ""}

Services offered:
${serviceList.map((s) => `- ${s}`).join("\n")}

Skills: ${(skills.results || []).map((s) => s.name).join(", ")}

Experience:
${(experience.results || []).map((e) => `- ${e.title} (${e.meta || ""}): ${e.summary || ""}${e.note ? ` ${e.note}` : ""}`).join("\n")}

Education:
${(education.results || []).map((e) => `- ${e.title} (${e.meta || ""}): ${e.summary || ""}`).join("\n")}

Certifications:
${(certifications.results || []).map((c) => `- ${c.title}: ${c.summary || ""}`).join("\n")}

Achievements:
${(achievements.results || []).map((a) => `- ${a.title} (${a.meta || ""}): ${a.summary || ""}`).join("\n")}

Workshops / lectures:
${(workshops.results || []).map((w) => `- ${w.title} (${w.role || ""}, ${w.organizer || ""}, ${w.date || ""}): ${w.description || ""}`).join("\n")}

Live availability:
${availability.available && availability.shift ? `Naveen is available now on ${availability.shift.label}, ${availability.shift.start_time}-${availability.shift.end_time}${availability.shift.end_next_day ? " next day" : ""} IST.` : "Naveen is offline/unavailable right now based on his rotational schedule."}
`.trim(),
  };
}

async function getAvailabilityStatus(env) {
  const { dateStr: today, minutesOfDay } = getISTParts();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { dateStr: yesterdayStr } = getISTParts(yesterday);
  const [todayEntry, yesterdayEntry, shiftTypesRes] = await Promise.all([
    env.DB.prepare("SELECT shift_type FROM availability WHERE date = ?").bind(today).first(),
    env.DB.prepare("SELECT shift_type FROM availability WHERE date = ?").bind(yesterdayStr).first(),
    env.DB.prepare("SELECT * FROM shift_types").all(),
  ]);
  const shiftMap = {};
  (shiftTypesRes.results || []).forEach((s) => (shiftMap[s.code] = s));
  const evaluate = (entry) => {
    if (!entry) return null;
    const shift = shiftMap[entry.shift_type];
    if (!shift || shift.is_off) return { available: false, shift };
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    const within = shift.end_next_day ? minutesOfDay >= start || minutesOfDay < end : minutesOfDay >= start && minutesOfDay < end;
    return { available: within, shift };
  };
  const todayResult = evaluate(todayEntry);
  const yesterdayResult = evaluate(yesterdayEntry);
  if (todayResult?.available) return { available: true, shift: todayResult.shift };
  if (yesterdayResult?.available && yesterdayResult.shift?.end_next_day) return { available: true, shift: yesterdayResult.shift };
  return { available: false, shift: todayResult?.shift || null };
}

function getISTParts(date = new Date()) {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type) => text.find((p) => p.type === type)?.value;
  return { dateStr: `${get("year")}-${get("month")}-${get("day")}`, minutesOfDay: Number(get("hour")) * 60 + Number(get("minute")) };
}
function timeToMinutes(hhmm) { if (!hhmm) return null; const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }

async function adminAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  return token ? verifySessionToken(env.SESSION_SECRET, token) : null;
}

async function saveMessage(env, session, conversationId, sender, message) {
  await env.DB.prepare(
    "INSERT INTO sana_messages (session_id, conversation_id, sender, message, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(session, conversationId || null, sender, message, now()).run();
}

async function extractBooking(env, message, timezone, session) {
  if (!env.AI) return null;
  const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    messages: [
      { role: "system", content: `Extract booking information from the user's message. Return ONLY valid JSON with keys: wants_booking (boolean), service, name, email, phone, preferred_date, preferred_time, timezone, details. Do not invent values. timezone should be ${JSON.stringify(timezone)} unless the user explicitly gives another timezone. details must be a short string with any other booking requirements. Known services: ${SERVICES.join(", ")}.` },
      { role: "user", content: message },
    ],
  });
  const text = cleanAiText(result).replace(/^```json\s*|\s*```$/g, "");
  try {
    const data = JSON.parse(text);
    if (!data.wants_booking) return null;
    return data;
  } catch { return null; }
}

async function handlePublicChat(request, env) {
  if (!env.AI) return json(request, { error: "Sana isn't configured yet" }, 400);
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) return json(request, { error: "Please send a message up to 1000 characters." }, 400);
  const session = await ensureSession(env, request);
  const timezone = timezoneFromRequest(request);
  const local = partsForTimezone(timezone);
  const india = partsForTimezone("Asia/Kolkata");
  const country = request.headers.get("CF-IPCountry") || "IN";
  const context = await getSanaContext(env);
  const existing = await env.DB.prepare("SELECT sender, message FROM sana_messages WHERE session_id = ? AND conversation_id IS NULL ORDER BY id DESC LIMIT 8").bind(session).all();
  const history = (existing.results || []).reverse().map((m) => ({ role: m.sender === "visitor" ? "user" : "assistant", content: m.message }));
  await saveMessage(env, session, null, "visitor", message);

  const booking = await extractBooking(env, message, timezone, session).catch(() => null);
  if (booking) {
    const previous = await env.DB.prepare("SELECT * FROM sana_bookings WHERE session_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1").bind(session).first();
    const merged = {
      service: booking.service || previous?.service || null,
      name: booking.name || previous?.name || null,
      email: booking.email || previous?.email || null,
      phone: booking.phone || previous?.phone || null,
      preferred_date: booking.preferred_date || previous?.preferred_date || null,
      preferred_time: booking.preferred_time || previous?.preferred_time || null,
      timezone: booking.timezone || previous?.timezone || timezone,
      details: booking.details || previous?.details_json || null,
    };
    const missing = ["service", "name", "email", "preferred_date", "preferred_time"].filter((key) => !merged[key]);
    if (missing.length) {
      const nowMs = now();
      if (previous) {
        await env.DB.prepare(`UPDATE sana_bookings SET service=?, name=?, email=?, phone=?, preferred_date=?, preferred_time=?, timezone=?, details_json=?, updated_at=? WHERE id=?`).bind(merged.service, merged.name, merged.email, merged.phone, merged.preferred_date, merged.preferred_time, merged.timezone, merged.details, nowMs, previous.id).run();
      } else {
        await env.DB.prepare(`INSERT INTO sana_bookings (session_id, service, name, email, phone, preferred_date, preferred_time, timezone, details_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`).bind(session, merged.service, merged.name, merged.email, merged.phone, merged.preferred_date, merged.preferred_time, merged.timezone, merged.details, nowMs, nowMs).run();
      }
      const labels = { service: "which service you'd like", name: "your name", email: "your email", preferred_date: "your preferred date", preferred_time: "your preferred time" };
      const ask = labels[missing[0]];
      const greeting = dayGreeting(local.hour);
      const indiaNote = country !== "IN" ? ` It's ${dayGreeting(india.hour).toLowerCase()} in India right now.` : "";
      const reply = `${greeting}! I'm Sana, Naveen's personal AI assistant.${indiaNote} I'd be happy to help with the booking — could you share ${ask}?`;
      await saveMessage(env, session, null, "sana", reply);
      return json(request, { reply, action: "booking_collecting", booking_fields: missing });
    }
    const nowMs = now();
    if (previous) {
      await env.DB.prepare(`UPDATE sana_bookings SET service=?, name=?, email=?, phone=?, preferred_date=?, preferred_time=?, timezone=?, details_json=?, status='new', updated_at=? WHERE id=?`).bind(merged.service, merged.name, merged.email, merged.phone, merged.preferred_date, merged.preferred_time, merged.timezone, merged.details, nowMs, previous.id).run();
    } else {
      await env.DB.prepare(`INSERT INTO sana_bookings (session_id, service, name, email, phone, preferred_date, preferred_time, timezone, details_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`).bind(session, merged.service, merged.name, merged.email, merged.phone, merged.preferred_date, merged.preferred_time, merged.timezone, merged.details, nowMs, nowMs).run();
    }
    const greeting = dayGreeting(local.hour);
    const indiaNote = country !== "IN" ? ` It's ${dayGreeting(india.hour).toLowerCase()} in India right now.` : "";
    const reply = `${greeting}! I'm Sana, Naveen's personal AI assistant.${indiaNote} I've captured your ${merged.service} booking request for ${merged.preferred_date} at ${merged.preferred_time} (${merged.timezone}). Naveen can follow up using ${merged.email}.`;
    await saveMessage(env, session, null, "sana", reply);
    return json(request, { reply, action: "booking_created" });
  }

  const greeting = dayGreeting(local.hour);
  const indiaNote = country !== "IN" ? ` The local time for you is ${local.text}, and it's ${india.text} in India right now.` : ` Your local time is ${local.text}.`;
  const availability = context.availability.available ? "Naveen is currently available." : "Naveen is currently offline/unavailable.";
  const system = `You are Sana, Naveen's personal AI assistant. Never call yourself a portfolio assistant. Always speak as Sana and answer on Naveen's behalf using the supplied facts. Be warm, friendly, diplomatic, natural and conversational — never stiff or overly formal. Keep simple questions simple. Start every answer with a friendly greeting such as "Hi!", "Good morning!", "Good afternoon!", or "Good evening!" based on the visitor's local time. Visitor local time: ${local.text}. India time: ${india.text}. ${country !== "IN" ? "The visitor is outside India, so naturally mention the India time when it helps. Do not overdo it." : ""} If asked about availability, use live availability only. ${availability} If asked to connect with Naveen, use the live connection action instead of pretending to be Naveen. If Naveen is offline, say he is offline and offer to pass along a message. If a user asks to book anything, help collect the required booking details and store them. Available services: ${context.services.join(", ")}.

FACTS ABOUT NAVEEN:
${context.text}`;
  const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }],
  });
  let reply = cleanAiText(result);
  if (!reply) return json(request, { error: "No response generated" }, 502);
  const prefixes = ["hi!", "hi,", "good morning!", "good afternoon!", "good evening!", "good morning,", "good afternoon,", "good evening,"];
  if (!prefixes.some((p) => reply.toLowerCase().startsWith(p))) reply = `${greeting}! ${reply}`;
  await saveMessage(env, session, null, "sana", reply);
  return json(request, { reply, action: "chat", timezone, local_time: local.text });
}

async function handlePresence(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const ts = now();
  await env.DB.prepare(`INSERT INTO sana_presence (id, online, last_seen_at, admin_username, updated_at) VALUES (1, 1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET online=1, last_seen_at=excluded.last_seen_at, admin_username=excluded.admin_username, updated_at=excluded.updated_at`).bind(ts, auth.username, ts).run();
  return json(request, { online: true, last_seen_at: ts });
}

async function handleStatus(request, env) {
  const row = await env.DB.prepare("SELECT online, last_seen_at FROM sana_presence WHERE id = 1").first();
  const online = !!row && row.online === 1 && now() - row.last_seen_at < ONLINE_WINDOW_MS;
  return json(request, { online, last_seen_at: row?.last_seen_at || null, services: SERVICES });
}

async function handleConnect(request, env) {
  const session = await ensureSession(env, request);
  const presence = await env.DB.prepare("SELECT online, last_seen_at FROM sana_presence WHERE id = 1").first();
  const online = !!presence && presence.online === 1 && now() - presence.last_seen_at < ONLINE_WINDOW_MS;
  if (!online) return json(request, { approved: false, offline: true, message: "Naveen is offline. I can pass a message to him for you." });
  const existing = await env.DB.prepare("SELECT id, status, conversation_id, expires_at FROM sana_connect_requests WHERE session_id = ? ORDER BY id DESC LIMIT 1").bind(session).first();
  if (existing && existing.status === "approved" && existing.conversation_id) return json(request, { approved: true, conversation_id: existing.conversation_id });
  const ts = now();
  const expires = ts + CONNECT_WINDOW_MS;
  const result = await env.DB.prepare("INSERT INTO sana_connect_requests (session_id, status, conversation_id, created_at, expires_at, updated_at) VALUES (?, 'pending', NULL, ?, ?, ?)").bind(session, ts, expires, ts).run();
  return json(request, { approved: false, request_id: result.meta.last_row_id, expires_at: expires, countdown_seconds: 180 });
}

async function handleConnectStatus(request, env, id) {
  const session = await ensureSession(env, request);
  const row = await env.DB.prepare("SELECT id, status, conversation_id, expires_at FROM sana_connect_requests WHERE id = ? AND session_id = ?").bind(id, session).first();
  if (!row) return json(request, { error: "Connection request not found" }, 404);
  if (row.status === "pending" && row.expires_at < now()) {
    await env.DB.prepare("UPDATE sana_connect_requests SET status='expired', updated_at=? WHERE id=?").bind(now(), id).run();
    row.status = "expired";
  }
  return json(request, { approved: row.status === "approved", status: row.status, conversation_id: row.conversation_id, expires_at: row.expires_at, countdown_seconds: Math.max(0, Math.ceil((row.expires_at - now()) / 1000)) });
}

async function handlePublicMessages(request, env) {
  const session = await ensureSession(env, request);
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation_id");
  if (!conversationId) return json(request, { messages: [] });
  const { results } = await env.DB.prepare("SELECT id, sender, message, created_at FROM sana_messages WHERE conversation_id = ? AND session_id = ? ORDER BY id ASC LIMIT 200").bind(conversationId, session).all();
  return json(request, { messages: results || [] });
}

async function handlePublicMessage(request, env) {
  const session = await ensureSession(env, request);
  const body = await request.json().catch(() => ({}));
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!conversationId || !message || message.length > 1000) return json(request, { error: "Invalid message" }, 400);
  const access = await env.DB.prepare("SELECT id FROM sana_connect_requests WHERE conversation_id = ? AND session_id = ? AND status='approved' LIMIT 1").bind(conversationId, session).first();
  if (!access) return json(request, { error: "Live chat is not connected" }, 403);
  await saveMessage(env, session, conversationId, "visitor", message);
  return json(request, { success: true });
}

async function handleOfflineMessage(request, env) {
  const session = await ensureSession(env, request);
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) return json(request, { error: "Message is required" }, 400);
  await saveMessage(env, session, null, "visitor", message);
  return json(request, { success: true });
}

async function handleAdminRequests(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare(`SELECT r.*, s.timezone, s.country FROM sana_connect_requests r LEFT JOIN sana_sessions s ON s.id = r.session_id WHERE r.status IN ('pending','approved') ORDER BY r.id DESC LIMIT 50`).all();
  return json(request, { requests: results || [] });
}

async function handleApprove(request, env, id, approve) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const row = await env.DB.prepare("SELECT * FROM sana_connect_requests WHERE id = ?").bind(id).first();
  if (!row) return json(request, { error: "Request not found" }, 404);
  if (!approve) {
    await env.DB.prepare("UPDATE sana_connect_requests SET status='rejected', updated_at=? WHERE id=?").bind(now(), id).run();
    return json(request, { success: true, status: "rejected" });
  }
  const conversationId = `sana-${id}-${crypto.randomUUID()}`;
  await env.DB.prepare("UPDATE sana_connect_requests SET status='approved', conversation_id=?, updated_at=? WHERE id=?").bind(conversationId, now(), id).run();
  await saveMessage(env, row.session_id, conversationId, "sana", "Hi! Naveen is connected now. You can chat with him here. 👋");
  return json(request, { success: true, status: "approved", conversation_id: conversationId });
}

async function handleAdminMessages(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation_id");
  if (!conversationId) return json(request, { messages: [] });
  const { results } = await env.DB.prepare("SELECT id, sender, message, created_at FROM sana_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 200").bind(conversationId).all();
  return json(request, { messages: results || [] });
}

async function handleAdminSendMessage(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!conversationId || !message || message.length > 2000) return json(request, { error: "Invalid message" }, 400);
  const row = await env.DB.prepare("SELECT id FROM sana_connect_requests WHERE conversation_id = ? AND status='approved' LIMIT 1").bind(conversationId).first();
  if (!row) return json(request, { error: "Conversation not active" }, 404);
  const sessionRow = await env.DB.prepare("SELECT session_id FROM sana_connect_requests WHERE id = ?").bind(row.id).first();
  await saveMessage(env, sessionRow.session_id, conversationId, "naveen", message);
  return json(request, { success: true });
}

async function handleBookings(request, env) {
  const auth = await adminAuth(request, env);
  if (!auth) return json(request, { error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT * FROM sana_bookings WHERE status != 'draft' ORDER BY id DESC LIMIT 100").all();
  return json(request, { bookings: results || [] });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
    const path = new URL(request.url).pathname;
    try {
      if (path === "/public/chat" && request.method === "POST") return handlePublicChat(request, env);
      if (path === "/public/sana/status" && request.method === "GET") return handleStatus(request, env);
      if (path === "/public/sana/connect" && request.method === "POST") return handleConnect(request, env);
      if (path.startsWith("/public/sana/connect/") && request.method === "GET") return handleConnectStatus(request, env, parseInt(path.split("/").pop(), 10));
      if (path === "/public/sana/messages" && request.method === "GET") return handlePublicMessages(request, env);
      if (path === "/public/sana/message" && request.method === "POST") return handlePublicMessage(request, env);
      if (path === "/public/sana/offline-message" && request.method === "POST") return handleOfflineMessage(request, env);
      if (path === "/admin/sana/heartbeat" && request.method === "POST") return handlePresence(request, env);
      if (path === "/admin/sana/requests" && request.method === "GET") return handleAdminRequests(request, env);
      if (path.match(/^\/admin\/sana\/requests\/\d+\/(approve|reject)$/) && request.method === "POST") return handleApprove(request, env, parseInt(path.split("/")[4], 10), path.endsWith("/approve"));
      if (path === "/admin/sana/messages" && request.method === "GET") return handleAdminMessages(request, env);
      if (path === "/admin/sana/message" && request.method === "POST") return handleAdminSendMessage(request, env);
      if (path === "/admin/sana/bookings" && request.method === "GET") return handleBookings(request, env);
      return existingWorker.fetch(request, env, ctx);
    } catch (error) {
      return json(request, { error: "Sana request failed", detail: String(error) }, 500);
    }
  },
};
