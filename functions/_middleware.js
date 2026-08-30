export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const isMainSanaPage = url.hostname.endsWith("naveenshankar.in") && !url.hostname.startsWith("admin.") && (url.pathname === "/" || url.pathname === "/index.html");
  const isAdminPage = url.hostname.startsWith("admin.") && url.pathname.endsWith(".html") && url.pathname !== "/login.html";
  if (!isMainSanaPage && !isAdminPage) return response;

  const html = await response.text();
  let injected = html;
  if (isMainSanaPage && !html.includes('/sana.js')) {
    injected = injected.replace(/<\/body>/i, '  <script src="/sana.js?v=3" defer></script>\n</body>');
  }
  if (isAdminPage && !html.includes('/sana-admin-presence.js')) {
    injected = injected.replace(/<\/body>/i, '  <script src="/sana-admin-presence.js?v=2" defer></script>\n</body>');
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  // Admin pages contain authenticated/live state and must not be served from a stale edge cache.
  if (isAdminPage) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Pragma", "no-cache");
  }
  return new Response(injected, { status: response.status, statusText: response.statusText, headers });
}
