(() => {
  const token = sessionStorage.getItem("admin_token");
  if (!token) return;
  const send = () => fetch("https://api.naveenshankar.in/admin/sana/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  send();
  setInterval(send, 15000);

  if (window.location.pathname !== "/sana-chat.html") {
    const link = document.createElement("a");
    link.href = "/sana-chat.html";
    link.textContent = "Sana Chat";
    link.setAttribute("aria-label", "Open Sana Chat");
    link.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:9999;padding:9px 13px;border-radius:999px;background:linear-gradient(135deg,#38bdf8,#8b5cf6);color:#020617;font:800 12px Inter,system-ui,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(56,189,248,.28);";
    document.body.appendChild(link);
  }
})();
