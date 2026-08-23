export default async (request) => {
  const url = new URL(request.url);

  // Keep the real portfolio available only at the explicit preview URL.
  if (url.pathname === "/index.html") {
    return;
  }

  // Serve the maintenance page for every other public path without
  // changing the requested URL in the browser.
  return new URL("/maintenance.html", request.url);
};
