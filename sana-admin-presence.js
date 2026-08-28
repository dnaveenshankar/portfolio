(() => {
  const token = sessionStorage.getItem("admin_token");
  if (!token) return;
  const send = () => fetch("https://api.naveenshankar.in/admin/sana/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  send();
  setInterval(send, 15000);
})();
