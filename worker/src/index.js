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

// Is `nowMinutes` within a shift window that starts at `startMin` and either ends
// same-day at `endMin`, or (if endsNextDay) spills into the next day up to `endMin`.
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

        const user = await env.DB.prepare(
          "SELECT * FROM admin_users WHERE username = ?"
        )
          .bind(username)
          .first();

        if (!user) return json(request, { error: "Invalid username or password" }, 401);

        const ok = await verifyPassword(password, user.password_salt, user.password_hash);
        if (!ok) return json(request, { error: "Invalid username or password" }, 401);

        const token = await createSessionToken(env.SESSION_SECRET, {
          sub: user.id,
          username: user.username,
        });

        await logActivity(env, user.username, "login", null, request);

        return json(request, {
          token,
          mustChangePassword: !!user.must_change_password,
        });
      }

      // POST /admin/change-password  { currentPassword, newPassword }  (auth required)
      if (path === "/admin/change-password" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const { currentPassword, newPassword } = await request.json();
        if (!currentPassword || !newPassword || newPassword.length < 8) {
          return json(request, { error: "New password must be at least 8 characters" }, 400);
        }

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?")
          .bind(auth.sub)
          .first();
        if (!user) return json(request, { error: "Unauthorized" }, 401);

        const ok = await verifyPassword(currentPassword, user.password_salt, user.password_hash);
        if (!ok) return json(request, { error: "Current password is incorrect" }, 401);

        const { hash, salt } = await hashPassword(newPassword);
        await env.DB.prepare(
          `UPDATE admin_users
           SET password_hash = ?, password_salt = ?, must_change_password = 0,
               updated_at = ?
           WHERE id = ?`
        )
          .bind(hash, salt, Date.now(), user.id)
          .run();

        await logActivity(env, user.username, "password_change", null, request);

        return json(request, { success: true });
      }

      // POST /admin/forgot-password  { username }
      if (path === "/admin/forgot-password" && request.method === "POST") {
        const { username } = await request.json();
        const generic = { success: true, message: "If that account exists, a reset link has been sent." };
        if (!username) return json(request, generic); // never reveal whether the user exists

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?")
          .bind(username)
          .first();

        if (user) {
          const token = randomToken();
          const expires = Date.now() + 30 * 60 * 1000; // 30 min
          await env.DB.prepare(
            "UPDATE admin_users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?"
          )
            .bind(token, expires, user.id)
            .run();

          // Email delivery is not wired up yet — needs an email provider
          // (e.g. Resend, Mailgun) configured with an API key as a Worker secret.
          // For now the reset link is logged so it can be tested manually.
          if (env.RESEND_API_KEY && user.email) {
            await sendResetEmail(env, user.email, token);
          } else {
            console.log(`Password reset link for ${user.username}: https://admin.naveenshankar.in/reset-password.html?token=${token}`);
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

        const user = await env.DB.prepare(
          "SELECT * FROM admin_users WHERE reset_token = ?"
        )
          .bind(token)
          .first();

        if (!user || !user.reset_token_expires_at || user.reset_token_expires_at < Date.now()) {
          return json(request, { error: "Reset link is invalid or has expired" }, 400);
        }

        const { hash, salt } = await hashPassword(newPassword);
        await env.DB.prepare(
          `UPDATE admin_users
           SET password_hash = ?, password_salt = ?, must_change_password = 0,
               reset_token = NULL, reset_token_expires_at = NULL, updated_at = ?
           WHERE id = ?`
        )
          .bind(hash, salt, Date.now(), user.id)
          .run();

        return json(request, { success: true });
      }

      // GET /admin/me  (auth required) — sanity check endpoint for the admin panel
      if (path === "/admin/me" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        return json(request, { username: auth.username });
      }

      // GET /admin/activity  (auth required) — recent activity feed for the dashboard
      if (path === "/admin/activity" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
        const { results } = await env.DB.prepare(
          "SELECT username, action, detail, ip, created_at FROM admin_activity_log ORDER BY created_at DESC LIMIT ?"
        )
          .bind(limit)
          .all();

        return json(request, { activity: results });
      }

      // GET /admin/profile  (auth required) — first working CMS section
      if (path === "/admin/profile" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const profile = await env.DB.prepare("SELECT * FROM profile WHERE id = 1").first();
        return json(request, { profile });
      }

      // PUT /admin/profile  (auth required)  { full_name, title, bio, location, email, avatar_url }
      if (path === "/admin/profile" && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const body = await request.json();
        const { full_name, title, bio, location, email, avatar_url } = body;

        await env.DB.prepare(
          `UPDATE profile SET full_name = ?, title = ?, bio = ?, location = ?, email = ?, avatar_url = ?, updated_at = ?
           WHERE id = 1`
        )
          .bind(full_name || null, title || null, bio || null, location || null, email || null, avatar_url || null, Date.now())
          .run();

        await logActivity(env, auth.username, "profile_update", null, request);

        return json(request, { success: true });
      }

      // GET /admin/stats  (auth required) — visitor stats via Cloudflare's GraphQL Analytics API.
      // Requires CF_API_TOKEN (Analytics: Read) and CF_ZONE_ID set as Worker secrets/vars.
      // Falls back to a "not configured" response until those are set, rather than failing.
      if (path === "/admin/stats" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) {
          return json(request, { configured: false });
        }

        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const until = new Date().toISOString();

        const query = `
          query {
            viewer {
              zones(filter: { zoneTag: "${env.CF_ZONE_ID}" }) {
                httpRequests1dGroups(limit: 7, filter: { date_geq: "${since.slice(0, 10)}", date_leq: "${until.slice(0, 10)}" }, orderBy: [date_ASC]) {
                  dimensions { date }
                  sum { requests, pageViews, uniques }
                }
              }
            }
          }`;

        const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });
        const data = await res.json(request, );
        const groups = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];

        return json(request, {
          configured: true,
          daily: groups.map((g) => ({
            date: g.dimensions.date,
            requests: g.sum.requests,
            pageViews: g.sum.pageViews,
            uniqueVisitors: g.sum.uniques,
          })),
        });
      }

      // GET /admin/skills  (auth required) — list all skills
      if (path === "/admin/skills" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const { results } = await env.DB.prepare(
          "SELECT * FROM skills ORDER BY sort_order ASC, id ASC"
        ).all();
        return json(request, { skills: results });
      }

      // POST /admin/skills  (auth required)  { name, category, proficiency, display_type, sort_order }
      if (path === "/admin/skills" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const { name, category, proficiency, display_type, sort_order } = await request.json();
        if (!name) return json(request, { error: "Name is required" }, 400);

        const now = Date.now();
        const result = await env.DB.prepare(
          `INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(name, category || null, proficiency || null, display_type || "bar", sort_order || 0, now, now)
          .run();

        await logActivity(env, auth.username, "skill_create", name, request);
        return json(request, { success: true, id: result.meta.last_row_id });
      }

      // PUT /admin/skills/:id  (auth required)  { name, category, proficiency, display_type, sort_order }
      if (path.startsWith("/admin/skills/") && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const id = parseInt(path.split("/").pop(), 10);
        const { name, category, proficiency, display_type, sort_order } = await request.json();
        if (!name) return json(request, { error: "Name is required" }, 400);

        await env.DB.prepare(
          `UPDATE skills SET name = ?, category = ?, proficiency = ?, display_type = ?, sort_order = ?, updated_at = ?
           WHERE id = ?`
        )
          .bind(name, category || null, proficiency || null, display_type || "bar", sort_order || 0, Date.now(), id)
          .run();

        await logActivity(env, auth.username, "skill_update", name, request);
        return json(request, { success: true });
      }

      // DELETE /admin/skills/:id  (auth required)
      if (path.startsWith("/admin/skills/") && request.method === "DELETE") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const id = parseInt(path.split("/").pop(), 10);
        await env.DB.prepare("DELETE FROM skills WHERE id = ?").bind(id).run();

        await logActivity(env, auth.username, "skill_delete", `id ${id}`, request);
        return json(request, { success: true });
      }

      // ---- Generic CRUD for simple list-type CMS sections ----
      // Table/column names are only ever taken from this fixed allowlist, never from
      // user input, so building SQL strings from them here is safe.
      const dataMatch = path.match(/^\/admin\/data\/([a-z_]+)(?:\/(\d+))?$/);
      if (dataMatch) {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        const table = dataMatch[1];
        const id = dataMatch[2] ? parseInt(dataMatch[2], 10) : null;
        const config = GENERIC_TABLES[table];
        if (!config) return json(request, { error: "Unknown section" }, 404);

        if (request.method === "GET") {
          const { results } = await env.DB.prepare(
            `SELECT * FROM ${table} ORDER BY sort_order ASC, id ASC`
          ).all();
          return json(request, { items: results });
        }

        if (request.method === "POST") {
          const body = await request.json();
          for (const req of config.required) {
            if (!body[req]) return json(request, { error: `${req} is required` }, 400);
          }
          const now = Date.now();
          const cols = config.columns;
          const placeholders = cols.map(() => "?").join(", ");
          const values = cols.map((c) => body[c] ?? null);
          const result = await env.DB.prepare(
            `INSERT INTO ${table} (${cols.join(", ")}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`
          )
            .bind(...values, now, now)
            .run();
          await logActivity(env, auth.username, `${table}_create`, body[cols[0]], request);
          return json(request, { success: true, id: result.meta.last_row_id });
        }

        if (request.method === "PUT" && id) {
          const body = await request.json();
          for (const req of config.required) {
            if (!body[req]) return json(request, { error: `${req} is required` }, 400);
          }
          const cols = config.columns;
          const setClause = cols.map((c) => `${c} = ?`).join(", ");
          const values = cols.map((c) => body[c] ?? null);
          await env.DB.prepare(`UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`)
            .bind(...values, Date.now(), id)
            .run();
          await logActivity(env, auth.username, `${table}_update`, body[cols[0]], request);
          return json(request, { success: true });
        }

        if (request.method === "DELETE" && id) {
          await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
          await logActivity(env, auth.username, `${table}_delete`, `id ${id}`, request);
          return json(request, { success: true });
        }

        return json(request, { error: "Method not allowed" }, 405);
      }

      // ---- Quotes (daily quote, optionally scheduled) ----
      if (path === "/admin/quotes" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { results } = await env.DB.prepare(
          "SELECT * FROM quotes ORDER BY scheduled_date DESC, id DESC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/admin/quotes" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { text, author, scheduled_date, is_active } = await request.json();
        if (!text) return json(request, { error: "Quote text is required" }, 400);
        const now = Date.now();
        const result = await env.DB.prepare(
          `INSERT INTO quotes (text, author, scheduled_date, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(text, author || null, scheduled_date || null, is_active ? 1 : 0, now, now)
          .run();
        await logActivity(env, auth.username, "quote_create", text.slice(0, 40), request);
        return json(request, { success: true, id: result.meta.last_row_id });
      }
      if (path.match(/^\/admin\/quotes\/\d+$/) && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const id = parseInt(path.split("/").pop(), 10);
        const { text, author, scheduled_date, is_active } = await request.json();
        if (!text) return json(request, { error: "Quote text is required" }, 400);
        await env.DB.prepare(
          `UPDATE quotes SET text = ?, author = ?, scheduled_date = ?, is_active = ?, updated_at = ? WHERE id = ?`
        )
          .bind(text, author || null, scheduled_date || null, is_active ? 1 : 0, Date.now(), id)
          .run();
        await logActivity(env, auth.username, "quote_update", text.slice(0, 40), request);
        return json(request, { success: true });
      }
      if (path.match(/^\/admin\/quotes\/\d+$/) && request.method === "DELETE") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const id = parseInt(path.split("/").pop(), 10);
        await env.DB.prepare("DELETE FROM quotes WHERE id = ?").bind(id).run();
        await logActivity(env, auth.username, "quote_delete", `id ${id}`, request);
        return json(request, { success: true });
      }

      // ---- Availability (rotational shifts) ----
      if (path === "/admin/availability" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { results } = await env.DB.prepare(
          "SELECT * FROM availability ORDER BY date DESC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/admin/availability" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { date, shift_type, note } = await request.json();
        if (!date || !shift_type) return json(request, { error: "Date and shift type are required" }, 400);
        const now = Date.now();
        const result = await env.DB.prepare(
          `INSERT INTO availability (date, shift_type, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
          .bind(date, shift_type, note || null, now, now)
          .run();
        await logActivity(env, auth.username, "availability_create", `${date} ${shift_type}`, request);
        return json(request, { success: true, id: result.meta.last_row_id });
      }
      if (path.match(/^\/admin\/availability\/\d+$/) && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const id = parseInt(path.split("/").pop(), 10);
        const { date, shift_type, note } = await request.json();
        if (!date || !shift_type) return json(request, { error: "Date and shift type are required" }, 400);
        await env.DB.prepare(
          `UPDATE availability SET date = ?, shift_type = ?, note = ?, updated_at = ? WHERE id = ?`
        )
          .bind(date, shift_type, note || null, Date.now(), id)
          .run();
        await logActivity(env, auth.username, "availability_update", `${date} ${shift_type}`, request);
        return json(request, { success: true });
      }
      if (path.match(/^\/admin\/availability\/\d+$/) && request.method === "DELETE") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const id = parseInt(path.split("/").pop(), 10);
        await env.DB.prepare("DELETE FROM availability WHERE id = ?").bind(id).run();
        await logActivity(env, auth.username, "availability_delete", `id ${id}`, request);
        return json(request, { success: true });
      }

      // ---- Blog ----
      if (path === "/admin/blog" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { results } = await env.DB.prepare(
          "SELECT * FROM blog_posts ORDER BY created_at DESC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/admin/blog" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { title, slug, content, published } = await request.json();
        if (!title || !slug) return json(request, { error: "Title and slug are required" }, 400);
        const now = Date.now();
        try {
          const result = await env.DB.prepare(
            `INSERT INTO blog_posts (title, slug, content, published, published_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(title, slug, content || null, published ? 1 : 0, published ? now : null, now, now)
            .run();
          await logActivity(env, auth.username, "blog_create", title, request);
          return json(request, { success: true, id: result.meta.last_row_id });
        } catch (e) {
          return json(request, { error: "That slug is already in use" }, 400);
        }
      }
      if (path.match(/^\/admin\/blog\/\d+$/) && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const id = parseInt(path.split("/").pop(), 10);
        const { title, slug, content, published } = await request.json();
        if (!title || !slug) return json(request, { error: "Title and slug are required" }, 400);
        const existing = await env.DB.prepare("SELECT published, published_at FROM blog_posts WHERE id = ?").bind(id).first();
        const published_at = published && !existing?.published ? Date.now() : existing?.published_at || null;
        try {
          await env.DB.prepare(
            `UPDATE blog_posts SET title = ?, slug = ?, content = ?, published = ?, published_at = ?, updated_at = ? WHERE id = ?`
          )
            .bind(title, slug, content || null, published ? 1 : 0, published_at, Date.now(), id)
            .run();
          await logActivity(env, auth.username, "blog_update", title, request);
          return json(request, { success: true });
        } catch (e) {
          return json(request, { error: "That slug is already in use" }, 400);
        }
      }
      if (path.match(/^\/admin\/blog\/\d+$/) && request.method === "DELETE") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const id = parseInt(path.split("/").pop(), 10);
        await env.DB.prepare("DELETE FROM blog_posts WHERE id = ?").bind(id).run();
        await logActivity(env, auth.username, "blog_delete", `id ${id}`, request);
        return json(request, { success: true });
      }

      // ---- Public read-only endpoints (no auth) — used by the live site to render content ----
      if (path === "/public/profile" && request.method === "GET") {
        const profile = await env.DB.prepare("SELECT * FROM profile WHERE id = 1").first();
        return json(request, { profile });
      }
      if (path === "/public/skills" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, name, category, proficiency, display_type, sort_order FROM skills ORDER BY sort_order ASC, id ASC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/public/experience" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, meta, title, summary, details_json, bullets_json, note, sort_order FROM experience ORDER BY sort_order ASC, id ASC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/public/education" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, meta, title, summary, details_json, bullets_json, note, sort_order FROM education ORDER BY sort_order ASC, id ASC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/public/certifications" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, icon, title, summary, details_json, bullets_json, note, sort_order FROM certifications ORDER BY sort_order ASC, id ASC"
        ).all();
        return json(request, { items: results });
      }
      if (path === "/public/achievements" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, meta, title, summary, details_json, bullets_json, note, sort_order FROM achievements ORDER BY sort_order ASC, id ASC"
        ).all();
        return json(request, { items: results });
      }
      // GET /admin/shift-types  (auth required) — the 6 configurable shift definitions
      if (path === "/admin/shift-types" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const { results } = await env.DB.prepare(
          "SELECT * FROM shift_types ORDER BY sort_order ASC"
        ).all();
        return json(request, { items: results });
      }

      // PUT /admin/shift-types/:code  (auth required)  { label, start_time, end_time, end_next_day }
      if (path.match(/^\/admin\/shift-types\/[A-Z]+$/) && request.method === "PUT") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);
        const code = path.split("/").pop();
        const { label, start_time, end_time, end_next_day } = await request.json();
        if (!label) return json(request, { error: "Label is required" }, 400);

        const existing = await env.DB.prepare("SELECT is_off FROM shift_types WHERE code = ?").bind(code).first();
        if (!existing) return json(request, { error: "Unknown shift code" }, 404);

        await env.DB.prepare(
          `UPDATE shift_types SET label = ?, start_time = ?, end_time = ?, end_next_day = ?, updated_at = ? WHERE code = ?`
        )
          .bind(
            label,
            existing.is_off ? null : start_time || null,
            existing.is_off ? null : end_time || null,
            end_next_day ? 1 : 0,
            Date.now(),
            code
          )
          .run();

        await logActivity(env, auth.username, "shift_type_update", `${code}: ${label}`, request);
        return json(request, { success: true });
      }

      // GET /public/shift-types — used by the admin availability page and any public display
      if (path === "/public/shift-types" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT code, label, start_time, end_time, end_next_day, is_off FROM shift_types ORDER BY sort_order ASC"
        ).all();
        return json(request, { items: results });
      }

      // GET /public/availability-status — "am I available right now?", computed in IST,
      // handling shifts that cross midnight (e.g. Night 16:00 -> 08:00 next day).
      if (path === "/public/availability-status" && request.method === "GET") {
        const status = await getAvailabilityStatus(env);
        return json(request, status);
      }

      if (path === "/public/quote-of-the-day" && request.method === "GET") {
        const today = new Date().toISOString().slice(0, 10);
        let quote = await env.DB.prepare(
          "SELECT text, author FROM quotes WHERE scheduled_date = ? AND is_active = 1 LIMIT 1"
        )
          .bind(today)
          .first();
        if (!quote) {
          quote = await env.DB.prepare(
            "SELECT text, author FROM quotes WHERE is_active = 1 AND scheduled_date IS NULL ORDER BY id DESC LIMIT 1"
          ).first();
        }
        return json(request, { quote: quote || null });
      }
      if (path === "/public/availability" && request.method === "GET") {
        const { dateStr: today } = getISTParts();
        const { results } = await env.DB.prepare(
          `SELECT a.date, a.shift_type, a.note, s.label, s.start_time, s.end_time, s.end_next_day, s.is_off
           FROM availability a LEFT JOIN shift_types s ON s.code = a.shift_type
           WHERE a.date >= ? ORDER BY a.date ASC LIMIT 14`
        )
          .bind(today)
          .all();
        return json(request, { items: results });
      }

      // POST /admin/ai/assist  (auth required)  { instruction, text }
      // Uses Cloudflare Workers AI (included with your Cloudflare account, no external API key).
      if (path === "/admin/ai/assist" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json(request, { error: "Unauthorized" }, 401);

        if (!env.AI) return json(request, { error: "AI binding not configured" }, 400);

        const { instruction, text } = await request.json();
        if (!instruction) return json(request, { error: "instruction is required" }, 400);

        try {
          const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
            messages: [
              {
                role: "system",
                content: "You write concise, professional portfolio/resume copy. Return only the requested text with no preamble, no quotes, no markdown formatting.",
              },
              {
                role: "user",
                content: text ? `${instruction}\n\nExisting text:\n${text}` : instruction,
              },
            ],
          });
          const suggestion =
            result.response ||
            result.output_text ||
            (Array.isArray(result.output) && result.output.find((o) => o.content)?.content?.[0]?.text) ||
            "";
          if (!suggestion) return json(request, { error: "AI returned an empty response" }, 502);
          return json(request, { suggestion: suggestion.trim() });
        } catch (e) {
          return json(request, { error: "AI request failed", detail: String(e) }, 500);
        }
      }

      // POST /public/chat  { message }  — chatbot that answers using the CMS content as context.
      // No auth (public-facing), rate-limited implicitly by Workers AI's own daily neuron allowance.
      if (path === "/public/chat" && request.method === "POST") {
        if (!env.AI) return json(request, { error: "Chat isn't configured yet" }, 400);

        const { message } = await request.json();
        if (!message || typeof message !== "string" || message.length > 500) {
          return json(request, { error: "Please send a short message (max 500 characters)" }, 400);
        }

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

          const availabilityText = availability.available
            ? `Naveen IS currently available (on "${availability.shift.label}" shift, ${availability.shift.start_time}–${availability.shift.end_time}${availability.shift.end_next_day ? " next day" : ""}, IST).`
            : `Naveen is currently NOT available (he works rotational shifts and is off or between shifts right now).`;

          const context = `
Profile: ${profile?.full_name || ""}, ${profile?.title || ""}. Location: ${profile?.location || ""}. Bio: ${profile?.bio || ""}
Contact email: ${profile?.email || "not provided"}

Current availability: ${availabilityText}
(Naveen works rotational shifts, so availability changes daily — always mention this is live/real-time info, not a fixed schedule.)

Skills: ${(skillsRes.results || []).map((s) => s.name).join(", ")}

Experience:
${(expRes.results || []).map((e) => `- ${e.title} (${e.meta}): ${e.summary}`).join("\n")}

Education:
${(eduRes.results || []).map((e) => `- ${e.title} (${e.meta}): ${e.summary}`).join("\n")}

Certifications:
${(certRes.results || []).map((c) => `- ${c.title}: ${c.summary}`).join("\n")}

Achievements:
${(achRes.results || []).map((a) => `- ${a.title} (${a.meta}): ${a.summary}`).join("\n")}
`.trim();

          const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
            messages: [
              {
                role: "system",
                content: `You are "Sana", a friendly assistant on ${profile?.full_name || "this person"}'s personal portfolio website. Answer questions about his background, skills, and experience using only the information below. If asked whether he's available or free right now, use the "Current availability" info directly. If someone wants to contact him, book time, or set up a call/meeting, point them to the contact email above — you cannot book anything yourself, just facilitate. Be concise (2-4 sentences), warm, and professional. If asked something not covered here, say you don't have that detail and suggest using the contact section.\n\n${context}`,
              },
              { role: "user", content: message },
            ],
          });

          const reply =
            result.response ||
            result.output_text ||
            (Array.isArray(result.output) && result.output.find((o) => o.content)?.content?.[0]?.text) ||
            "";
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
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "admin@naveenshankar.in",
      to: email,
      subject: "Reset your admin password",
      html: `<p>Click to reset your password (expires in 30 minutes):</p><p><a href="${link}">${link}</a></p>`,
    }),
  });
}
