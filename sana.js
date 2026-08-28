(() => {
  const API = "https://api.naveenshankar.in";
  const SESSION_KEY = "sana_session";
  const TZ_KEY = "sana_timezone";
  const messages = [];
  const state = { session: null, timezone: "Asia/Kolkata" };

  function getSession() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40); localStorage.setItem(SESSION_KEY, id); }
    return id;
  }
  function getTimezone() { return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; }
  state.session = getSession(); state.timezone = getTimezone();

  function wire(form, input, list) {
    if (!form || !input || !list) return;
    let busy = false;
    async function send(text) {
      if (busy || !text.trim()) return;
      busy = true;
      const user = document.createElement("div"); user.className = "sana-user-message"; user.textContent = text; list.appendChild(user);
      const dots = document.createElement("div"); dots.className = "sana-typing"; dots.innerHTML = "<span></span><span></span><span></span>"; list.appendChild(dots);
      try {
        const response = await fetch(`${API}/public/chat`, { method: "POST", headers: { "Content-Type": "application/json", "X-Sana-Session": state.session, "X-Sana-Timezone": state.timezone }, body: JSON.stringify({ message: text }) });
        const data = await response.json().catch(() => ({}));
        dots.remove();
        const answer = data.reply || "I'm having a little trouble right now. Please try again in a moment. 💙";
        const bot = document.createElement("div"); bot.className = "sana-bot-message"; bot.textContent = answer; list.appendChild(bot);
      } catch (e) { dots.remove(); const bot = document.createElement("div"); bot.className = "sana-bot-message"; bot.textContent = "I'm having a little trouble reaching my chat service right now. Please try again. 💙"; list.appendChild(bot); }
      list.scrollTop = list.scrollHeight; busy = false; input.focus();
    }
    form.addEventListener("submit", e => { e.preventDefault(); const text=input.value; input.value=""; send(text); });
  }

  function findUI() {
    const form = document.querySelector("#sana-chat-form, form[data-sana-chat], .sana-chat-form");
    const input = document.querySelector("#sana-chat-input, textarea[data-sana-input], input[data-sana-input]");
    const list = document.querySelector("#sana-chat-messages, [data-sana-messages], .sana-chat-messages");
    if (form && input && list) wire(form,input,list);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", findUI); else findUI();
})();
