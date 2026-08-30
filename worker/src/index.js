import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  randomToken,
} from "./auth.js";

// Allowlist of simple list-type CMS tables usable via the generic /admin/data/:table routes.
// Table and column names here are the only ones ever interpolated into SQL for those routes.
const GENERIC_TABLES = {
  experience: { columns: ["meta", "title", "summary", "details_json", "bullets_json", "note", "sort_order"], required: ["title"] },
  education: { columns: ["meta", "title", "summary", "details_json", "bullets_json", "note", "sort_order"], required: ["title"] },
  achievements: { columns: ["meta", "title", "summary", "details_json", "bullets_json", "note", "sort_order"], required: ["title"] },
  certifications: { columns: ["icon", "title", "summary", "details_json", "bullets_json", "note", "sort_order"], required: ["title"] },
  projects: { columns: ["title", "description", "url", "repo_url", "tech_stack", "sort_order"], required: ["title"] },
  workshops: { columns: ["title", "role", "organizer", "date", "description", "sort_order"], required: ["title"] },
  testimonials: { columns: ["name", "role", "company", "quote", "sort_order"], required: ["name", "quote"] },
  social_links: { columns: ["platform", "url", "sort_order"], required: ["platform", "url"] },
  services: { columns: ["name", "description", "sort_order"], required: ["name"] },
};

const ALLOWED_ORIGINS = [
  "https://admin.naveenshankar.in",
  "https://naveenshankar.in",
  "https://www.naveenshankar.in",
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
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

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = token ? await verifySessionToken(env.SESSION_SECRET, token) : null;
  if (!payload) return null;
  return payload;
}

// Shared by /public/availability-status and the chatbot — computes whether
// Naveen is "available" right now based on today's/yesterday's assigned shift.
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

  function evaluate(entry) {
    if (!entry) return null;
    const shift = shiftMap[entry.shift_type];
    if (!shift || shift.is_off) return { available: false, shift };
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    const within = isWithinShift(minutesOfDay, start, end, !!shift.end_next_day);
    return { available: within, shift };
  }

  const todayResult = evaluate(todayEntry);
  const yesterdayResult = evaluate(yesterdayEntry);

  let available = false;
  let activeShift = null;

  if (todayResult?.available) {
    available = true;
    activeShift = todayResult.shift;
  } else if (yesterdayResult?.available && yesterdayResult.shift?.end_next_day) {
    available = true;
    activeShift = yesterdayResult.shift;
  }

  return {
    available,
    shift: activeShift ? { code: activeShift.code, label: activeShift.label, start_time: activeShift.start_time, end_time: activeShift.end_time, end_next_day: !!activeShift.end_next_day } : null,
    todayShift: todayResult?.shift ? { code: todayResult.shift.code, label: todayResult.shift.label } : null,
  };
}

async function logActivity(env, username, action, detail, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  await env.DB.prepare(
    "INSERT INTO admin_activity_log (username, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(username, action, detail || null, ip, Date.now())
    .run();
}

// IST (Asia/Kolkata, UTC+5:30) time helpers — used for shift/availability logic
// regardless of where the Worker actually executes.
const IST_OFFSET_MINUTES = 5 * 60 + 30;

function getISTParts(date = new Date()) {
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);
  const dateStr = ist.toISOString().slice(0, 10);
  const minutesOfDay = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return { dateStr, minutesOfDay };
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isWithinShift(nowMinutes, startMin, endMin, endsNextDay) {
  if (startMin == null || endMin == null) return false;
  if (!endsNextDay) return nowMinutes >= startMin && nowMinutes < endMin;
  return nowMinutes >= startMin || nowMinutes < endMin;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /admin/login  { username, password }
      if (path === "/admin/login" && request.method === "POST") {
        const { username, password } = await request.json();
        if (!username || !password) return json(request, { error: "Missing credentials" }, 400);

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?").bind(username).first();
        if (!user) return json(request, { error: "Invalid username or password" }, 401);

        const ok = await verifyPassword(password, user.password_salt, user.password_hash);
        if (!ok) return json(request, { error: "Invalid username or password" }, 401);

        const token = await createSessionToken(env.SESSION_SECRET, { sub: user.id, username: user.username });
        await logActivity(env, user.username, "login", null, request);
        return json(request, { token, mustChangePassword: !!user.must_change_password });
      }

      // POST /admin/change-password  { currentPassword, newPassword }
      if (path === "/admin/change-password" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const { currentPassword, newPassword } = await request.json();
        if (!currentPassword || !newPassword || newPassword.length < 8) {
          return json(request, { error: "New password must be at least 8 characters" }, 400);
        }

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?").bind(auth.sub).first();
        if (!user) return json(request, { error: "Unauthorized" }, 401);

        const ok = await verifyPassword(currentPassword, user.password_salt, user.password_hash);
        if (!ok) return json(request, { error: "Current password is incorrect" }, 401);

        const { hash, salt } = await hashPassword(newPassword);
        await env.DB.prepare(`UPDATE admin_users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?`)
          .bind(hash, salt, Date.now(), user.id).run();
        await logActivity(env, user.username, "password_change", null, request);
        return json(request, { success: true });
      }

      // POST /admin/forgot-password  { username }
      if (path === "/admin/forgot-password" && request.method === "POST") {
        const { username } = await request.json();
        const generic = { success: true, message: "If that account exists, a reset link has been sent." };
        if (!username) return json(request, generic);

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?").bind(username).first();

        if (user) {
          const token = randomToken();
          const expires = Date.now() + 30 * 60 * 1000;
          await env.DB.prepare("UPDATE admin_users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?")
            .bind(token, expires, user.id).run();

          if (env.RESEND_API_KEY && user.email) {
            await sendResetEmail(env, user.email, token);
          } else {
            console.log(`Password reset email not sent for ${user.username}: missing RESEND_API_KEY or admin email`);
          }
        }

        return json(request, generic);
      }

      // POST /admin/reset-password  { token, newPassword }
      if (path === "/admin/reset-password" && request.method === "POST") {
        const { token, newPassword } = await request.json();
        if (!token || !newPassword || newPassword.length < 8) {
          return json(request, { error: "New password must be at least 8 characters" }, 400);
        }

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE reset_token = ?").bind(token).first();
        if (!user || !user.reset_token_expires_at || user.reset_token_expires_at < Date.now()) {
          return json(request, { error: "Reset link is invalid or has expired" }, 400);
        }

        const { hash, salt } = await hashPassword(newPassword);
        await env.DB.prepare(`UPDATE admin_users SET password_hash = ?, password_salt = ?, must_change_password = 0, reset_token = NULL, reset_token_expires_at = NULL, updated_at = ? WHERE id = ?`)
          .bind(hash, salt, Date.now(), user.id).run();
        return json(request, { success: true });
      }

      // GET /admin/me
      if (path === "/admin/me" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        return json(request, { username: auth.username });
      }

      // GET /admin/activity
      if (path === "/admin/activity" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
        const { results } = await env.DB.prepare("SELECT username, action, detail, ip, created_at FROM admin_activity_log ORDER BY created_at DESC LIMIT ?").bind(limit).all();
        return json(request, { activity: results });
      }

      // GET /admin/profile
      if (path === "/admin/profile" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const profile = await env.DB.prepare("SELECT * FROM profile WHERE id = 1").first();
        return json(request, { profile });
      }

      // PUT /admin/profile
      if (path === "/admin/profile" && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const body = await request.json();
        const { full_name, title, bio, location, email, avatar_url } = body;
        await env.DB.prepare(`UPDATE profile SET full_name = ?, title = ?, bio = ?, location = ?, email = ?, avatar_url = ?, updated_at = ? WHERE id = 1`)
          .bind(full_name || null, title || null, bio || null, location || null, email || null, avatar_url || null, Date.now()).run();
        await logActivity(env, auth.username, "profile_update", null, request);
        return json(request, { success: true });
      }

      // GET /admin/stats
      if (path === "/admin/stats" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) return json(request, { configured: false });

        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const until = new Date().toISOString();
        const query = `query { viewer { zones(filter: { zoneTag: "${env.CF_ZONE_ID}" }) { httpRequests1dGroups(limit: 7, filter: { date_geq: "${since.slice(0, 10)}", date_leq: "${until.slice(0, 10)}" }, orderBy: [date_ASC]) { dimensions { date } sum { requests, pageViews, uniques } } } } }`;
        const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (!res.ok || data.errors) return json(request, { configured: true, error: "Cloudflare analytics request failed" }, 502);
        const groups = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
        return json(request, { configured: true, data: groups });
      }

      // Generic admin data routes
      const adminDataMatch = path.match(/^\/admin\/data\/([a-z_]+)$/);
      if (adminDataMatch && ["GET", "POST", "PUT", "DELETE"].includes(request.method)) {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const table = adminDataMatch[1];
        const config = GENERIC_TABLES[table];
        if (!config) return json(request, { error: "Unknown table" }, 404);

        if (request.method === "GET") {
          const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY sort_order ASC`).all();
          return json(request, { rows: results });
        }

        if (request.method === "POST") {
          const body = await request.json();
          for (const field of config.required) {
            if (!body[field]) return json(request, { error: `${field} is required` }, 400);
          }
          const fields = config.columns.filter((c) => Object.prototype.hasOwnProperty.call(body, c));
          if (!fields.length) return json(request, { error: "No valid fields provided" }, 400);
          const placeholders = fields.map(() => "?").join(", ");
          const values = fields.map((f) => body[f] ?? null);
          await env.DB.prepare(`INSERT INTO ${table} (${fields.join(", ")}) VALUES (${placeholders})`).bind(...values).run();
          await logActivity(env, auth.username, `${table}_create`, null, request);
          return json(request, { success: true });
        }

        const id = Number(url.searchParams.get("id"));
        if (!Number.isInteger(id) || id <= 0) return json(request, { error: "Invalid id" }, 400);

        if (request.method === "PUT") {
          const body = await request.json();
          const fields = config.columns.filter((c) => Object.prototype.hasOwnProperty.call(body, c));
          if (!fields.length) return json(request, { error: "No valid fields provided" }, 400);
          const values = fields.map((f) => body[f] ?? null);
          await env.DB.prepare(`UPDATE ${table} SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ?`).bind(...values, id).run();
          await logActivity(env, auth.username, `${table}_update`, `id=${id}`, request);
          return json(request, { success: true });
        }

        await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
        await logActivity(env, auth.username, `${table}_delete`, `id=${id}`, request);
        return json(request, { success: true });
      }

      // Public CMS endpoints
      if (path === "/public/profile" && request.method === "GET") {
        const profile = await env.DB.prepare("SELECT * FROM profile WHERE id = 1").first();
        return json(request, { profile });
      }
      if (path === "/public/skills" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM skills ORDER BY sort_order ASC").all();
        return json(request, { skills: results });
      }
      if (path === "/public/experience" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM experience ORDER BY sort_order ASC").all();
        return json(request, { experience: results });
      }
      if (path === "/public/education" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM education ORDER BY sort_order ASC").all();
        return json(request, { education: results });
      }
      if (path === "/public/certifications" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM certifications ORDER BY sort_order ASC").all();
        return json(request, { certifications: results });
      }
      if (path === "/public/achievements" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM achievements ORDER BY sort_order ASC").all();
        return json(request, { achievements: results });
      }
      if (path === "/public/shift-types" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM shift_types ORDER BY code ASC").all();
        return json(request, { shiftTypes: results });
      }
      if (path === "/public/availability-status" && request.method === "GET") {
        return json(request, await getAvailabilityStatus(env));
      }
      if (path === "/public/quote-of-the-day" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM quotes ORDER BY id ASC").all();
        if (!results.length) return json(request, { quote: null });
        const day = Math.floor(Date.now() / 86400000);
        return json(request, { quote: results[day % results.length] });
      }
      if (path === "/public/availability" && request.method === "GET") {
        const date = url.searchParams.get("date");
        if (!date) return json(request, { error: "date is required" }, 400);
        const row = await env.DB.prepare("SELECT * FROM availability WHERE date = ?").bind(date).first();
        return json(request, { availability: row });
      }
      if (path === "/public/chat" && request.method === "POST") {
        if (!env.AI) return json(request, { error: "Chat isn't configured yet" }, 400);
        const { message } = await request.json();
        if (!message || typeof message !== "string" || message.length > 500) return json(request, { error: "Please send a short message (max 500 characters)" }, 400);
        try {
          const [profile, skillsRes, expRes, eduRes, certRes, achRes, availability] = await Promise.all([
            env.DB.prepare("SELECT * FROM profile WHERE id = 1").first(),
            env.DB.prepare("SELECT name, category, proficiency, display_type FROM skills ORDER BY sort_order ASC").all(),
            env.DB.prepare("SELECT meta, title, summary, note FROM experience ORDER BY sort_order ASC").all(),
            env.DB.prepare("SELECT meta, title, summary FROM education ORDER BY sort_order ASC").all(),
            env.DB.prepare("SELECT title, summary FROM certifications ORDER BY sort_order ASC").all(),
            env.DB.prepare("SELECT meta, title, summary FROM achievements ORDER BY sort_order ASC").all(),
            getAvailabilityStatus(env),
          ]);
          const availabilityText = availability.available ? `Naveen IS currently available (on "${availability.shift.label}" shift, ${availability.shift.start_time}–${availability.shift.end_time}${availability.shift.end_next_day ? " next day" : ""}, IST).` : `Naveen is currently NOT available (he works rotational shifts and is off or between shifts right now).`;
          const context = `Profile: ${profile?.full_name || ""}, ${profile?.title || ""}. Location: ${profile?.location || ""}. Bio: ${profile?.bio || ""}\nContact email: ${profile?.email || "not provided"}\nCurrent availability: ${availabilityText}\n(Naveen works rotational shifts, so availability changes daily — always mention this is live/real-time info, not a fixed schedule.)\nSkills: ${(skillsRes.results || []).map((s) => s.name).join(", ")}\nExperience:\n${(expRes.results || []).map((e) => `- ${e.title} (${e.meta}): ${e.summary}`).join("\n")}\nEducation:\n${(eduRes.results || []).map((e) => `- ${e.title} (${e.meta}): ${e.summary}`).join("\n")}\nCertifications:\n${(certRes.results || []).map((c) => `- ${c.title}: ${c.summary}`).join("\n")}\nAchievements:\n${(achRes.results || []).map((a) => `- ${a.title} (${a.meta}): ${a.summary}`).join("\n")}`.trim();
          const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", { messages: [{ role: "system", content: `You are "Sana", a friendly assistant on ${profile?.full_name || "this person"}'s personal portfolio website. Answer questions about his background, skills, and experience using only the information below. If asked whether he's available or free right now, use the "Current availability" info directly. If someone wants to contact him, book time, or set up a call/meeting, point them to the contact email above — you cannot book anything yourself, just facilitate. Be concise (2-4 sentences), warm, and professional. If asked something not covered here, say you don't have that detail and suggest using the contact section.\n\n${context}` }, { role: "user", content: message }] });
          const reply = result.response || result.output_text || (Array.isArray(result.output) && result.output.find((o) => o.content)?.content?.[0]?.text) || "";
          if (!reply) return json(request, { error: "No response generated" }, 502);
          return json(request, { reply: reply.trim() });
        } catch (e) {
          return json(request, { error: "Chat request failed", detail: String(e) }, 500);
        }
      }

      return json(request, { error: "Not found" }, 404);
    } catch (err) {
      return json(request, { error: "Server error", detail: String(err) }, 500);
    }
  },
};

async function sendResetEmail(env, email, token) {
  const link = `https://admin.naveenshankar.in/reset-password.html?token=${token}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sana <noreply@naveenshankar.in>",
      to: email,
      subject: "🔐 Forgot your password? It happens!",
      html: `
        <p>Hey there! 👋</p>
        <p>Forgot your password? 😅</p>
        <p>Don't worry — forgetting passwords is basically a human tradition. 🧠😂</p>
        <p>No panic, no drama. Sana is here to help. 💁‍♀️✨</p>
        <p>Click the button below, choose a new password, and you're back in business:</p>
        <p><a href="${link}">🔐 Reset my password</a></p>
        <p>⏳ The link is valid for <strong>30 minutes</strong>, so don't let it wander off into the internet forever. 😜</p>
        <p>Didn't request this? No worries — just ignore this email. 🛡️</p>
        <p>See you inside! 👋💛<br><br><strong>— Sana</strong><br>Naveen's Personal Assistant</p>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Resend email failed (${response.status}): ${detail}`);
    throw new Error(`Resend email failed with status ${response.status}`);
  }

  console.log(`Password reset email sent to ${email}`);
}
