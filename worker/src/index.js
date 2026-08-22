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

async function logActivity(env, username, action, detail, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  await env.DB.prepare(
    "INSERT INTO admin_activity_log (username, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(username, action, detail || null, ip, Date.now())
    .run();
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
        const today = new Date().toISOString().slice(0, 10);
        const { results } = await env.DB.prepare(
          "SELECT date, shift_type, note FROM availability WHERE date >= ? ORDER BY date ASC LIMIT 14"
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
          const result = await env.AI.run("@cf/openai/gpt-oss-20b", {
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
          return json(request, { suggestion: (result.response || "").trim() });
        } catch (e) {
          return json(request, { error: "AI request failed", detail: String(e) }, 500);
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
