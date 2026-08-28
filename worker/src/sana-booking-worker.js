import sanaWorker from "./sana-worker.js";

function json(request, data, status = 200) {
  const origin = request.headers.get("Origin");
  const allowed = ["https://naveenshankar.in", "https://www.naveenshankar.in", "https://admin.naveenshankar.in"];
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0], "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Sana-Session,X-Sana-Timezone", Vary: "Origin" } });
}

function greeting(hour) { return hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 21 ? "Good evening" : "Hi"; }
function hourFor(tz) { try { return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date())); } catch { return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date())); } }
async function sessionId(request) {
  const supplied = request.headers.get("X-Sana-Session");
  if (supplied && /^[a-zA-Z0-9_-]{12,100}$/.test(supplied)) return supplied;
  const raw = `${request.headers.get("CF-Connecting-IP") || "unknown"}:${request.headers.get("User-Agent") || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
function aiText(result) { return (result?.response || result?.output_text || (Array.isArray(result?.output) && result.output.find((o) => o.content)?.content?.[0]?.text) || "").trim(); }

async function continueBooking(request, env, draft, message, session, timezone) {
  if (!env.AI) return null;
  const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    messages: [
      { role: "system", content: `You are extracting fields for an existing service booking. Return ONLY valid JSON: {"service":null,"name":null,"email":null,"phone":null,"preferred_date":null,"preferred_time":null,"timezone":null,"details":null}. Extract only values present in the latest user message; do not invent. Existing draft: ${JSON.stringify(draft)}. Visitor timezone: ${JSON.stringify(timezone)}.` },
      { role: "user", content: message },
    ],
  });
  let parsed;
  try { parsed = JSON.parse(aiText(result).replace(/^```json\s*|\s*```$/g, "")); } catch { return null; }
  const merged = {
    service: parsed.service || draft.service || null,
    name: parsed.name || draft.name || null,
    email: parsed.email || draft.email || null,
    phone: parsed.phone || draft.phone || null,
    preferred_date: parsed.preferred_date || draft.preferred_date || null,
    preferred_time: parsed.preferred_time || draft.preferred_time || null,
    timezone: parsed.timezone || draft.timezone || timezone,
    details: parsed.details || draft.details_json || null,
  };
  const missing = ["service", "name", "email", "preferred_date", "preferred_time"].filter((k) => !merged[k]);
  const ts = Date.now();
  const labels = { service: "the service you'd like", name: "your name", email: "your email", preferred_date: "your preferred date", preferred_time: "your preferred time" };
  if (missing.length) {
    await env.DB.prepare("UPDATE sana_bookings SET service=?, name=?, email=?, phone=?, preferred_date=?, preferred_time=?, timezone=?, details_json=?, updated_at=? WHERE id=?").bind(merged.service, merged.name, merged.email, merged.phone, merged.preferred_date, merged.preferred_time, merged.timezone, merged.details, ts, draft.id).run();
    const reply = `${greeting(hourFor(timezone))}! I'm Sana, Naveen's personal AI assistant. I've got that — could you share ${labels[missing[0]]}?`;
    await env.DB.prepare("INSERT INTO sana_messages (session_id, conversation_id, sender, message, created_at) VALUES (?, NULL, 'sana', ?, ?)").bind(session, reply, ts).run();
    return json(request, { reply, action: "booking_collecting", booking_fields: missing });
  }
  await env.DB.prepare("UPDATE sana_bookings SET service=?, name=?, email=?, phone=?, preferred_date=?, preferred_time=?, timezone=?, details_json=?, status='new', updated_at=? WHERE id=?").bind(merged.service, merged.name, merged.email, merged.phone, merged.preferred_date, merged.preferred_time, merged.timezone, merged.details, ts, draft.id).run();
  const reply = `${greeting(hourFor(timezone))}! I'm Sana, Naveen's personal AI assistant. Perfect — I've saved your ${merged.service} booking request for ${merged.preferred_date} at ${merged.preferred_time} (${merged.timezone}). Naveen can follow up at ${merged.email}.`;
  await env.DB.prepare("INSERT INTO sana_messages (session_id, conversation_id, sender, message, created_at) VALUES (?, NULL, 'sana', ?, ?)").bind(session, reply, ts).run();
  return json(request, { reply, action: "booking_created" });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return sanaWorker.fetch(request, env, ctx);
    const path = new URL(request.url).pathname;
    if (path === "/public/chat" && request.method === "POST") {
      const session = await sessionId(request);
      const draft = await env.DB.prepare("SELECT * FROM sana_bookings WHERE session_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1").bind(session).first();
      if (draft) {
        const body = await request.clone().json().catch(() => ({}));
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (message) {
          const timezone = request.headers.get("X-Sana-Timezone") || "Asia/Kolkata";
          const continued = await continueBooking(request, env, draft, message, session, timezone).catch(() => null);
          if (continued) {
            await env.DB.prepare("INSERT INTO sana_messages (session_id, conversation_id, sender, message, created_at) VALUES (?, NULL, 'visitor', ?, ?)").bind(session, message, Date.now()).run();
            return continued;
          }
        }
      }
    }
    return sanaWorker.fetch(request, env, ctx);
  },
};
