export async function onRequest(context) {
  const response = await context.next();
  const path = new URL(context.request.url).pathname;
  if (path !== "/" && path !== "/index.html") return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  if (html.includes('/sana.js')) return new Response(html, response);

  const injected = html.replace(/<\/body>/i, '  <script src="/sana.js?v=1" defer></script>\n</body>');
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(injected, { status: response.status, statusText: response.statusText, headers });
}
