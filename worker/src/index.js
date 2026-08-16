import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  randomToken,
} from "./auth.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://admin.naveenshankar.in",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Credentials": "true",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = token ? await verifySessionToken(env.SESSION_SECRET, token) : null;
  if (!payload) return null;
  return payload;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /admin/login  { username, password }
      if (path === "/admin/login" && request.method === "POST") {
        const { username, password } = await request.json();
        if (!username || !password) return json({ error: "Missing credentials" }, 400);

        const user = await env.DB.prepare(
          "SELECT * FROM admin_users WHERE username = ?"
        )
          .bind(username)
          .first();

        if (!user) return json({ error: "Invalid username or password" }, 401);

        const ok = await verifyPassword(password, user.password_salt, user.password_hash);
        if (!ok) return json({ error: "Invalid username or password" }, 401);

        const token = await createSessionToken(env.SESSION_SECRET, {
          sub: user.id,
          username: user.username,
        });

        return json({
          token,
          mustChangePassword: !!user.must_change_password,
        });
      }

      // POST /admin/change-password  { currentPassword, newPassword }  (auth required)
      if (path === "/admin/change-password" && request.method === "POST") {
        const auth = await requireAuth(request, env);
        if (!auth) return json({ error: "Unauthorized" }, 401);

        const { currentPassword, newPassword } = await request.json();
        if (!currentPassword || !newPassword || newPassword.length < 8) {
          return json({ error: "New password must be at least 8 characters" }, 400);
        }

        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?")
          .bind(auth.sub)
          .first();
        if (!user) return json({ error: "Unauthorized" }, 401);

        const ok = await verifyPassword(currentPassword, user.password_salt, user.password_hash);
        if (!ok) return json({ error: "Current password is incorrect" }, 401);

        const { hash, salt } = await hashPassword(newPassword);
        await env.DB.prepare(
          `UPDATE admin_users
           SET password_hash = ?, password_salt = ?, must_change_password = 0,
               updated_at = ?
           WHERE id = ?`
        )
          .bind(hash, salt, Date.now(), user.id)
          .run();

        return json({ success: true });
      }

      // POST /admin/forgot-password  { username }
      if (path === "/admin/forgot-password" && request.method === "POST") {
        const { username } = await request.json();
        const generic = { success: true, message: "If that account exists, a reset link has been sent." };
        if (!username) return json(generic); // never reveal whether the user exists

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

        return json(generic);
      }

      // POST /admin/reset-password  { token, newPassword }
      if (path === "/admin/reset-password" && request.method === "POST") {
        const { token, newPassword } = await request.json();
        if (!token || !newPassword || newPassword.length < 8) {
          return json({ error: "New password must be at least 8 characters" }, 400);
        }

        const user = await env.DB.prepare(
          "SELECT * FROM admin_users WHERE reset_token = ?"
        )
          .bind(token)
          .first();

        if (!user || !user.reset_token_expires_at || user.reset_token_expires_at < Date.now()) {
          return json({ error: "Reset link is invalid or has expired" }, 400);
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

        return json({ success: true });
      }

      // GET /admin/me  (auth required) — sanity check endpoint for the admin panel
      if (path === "/admin/me" && request.method === "GET") {
        const auth = await requireAuth(request, env);
        if (!auth) return json({ error: "Unauthorized" }, 401);
        return json({ username: auth.username });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: "Server error", detail: String(err) }, 500);
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
