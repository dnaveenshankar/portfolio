(() => {
  const API = "https://api.naveenshankar.in";
  const SESSION_KEY = "sana_session_id";
  const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const session = (() => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "");
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  })();
  let liveConversation = null;
  let connectRequest = null;
  let livePoll = null;

  const $ = (id) => document.getElementById(id);
  const headers = () => ({ "Content-Type": "application/json", "X-Sana-Session": session, "X-Sana-Timezone": TIMEZONE });
  const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(new Date()));
  const greeting = (h) => h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : h >= 17 && h < 21 ? "Good evening" : "Hi";
  const indiaTimeText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
  const isIndia = TIMEZONE === "Asia/Kolkata" || /^en-IN$/i.test(navigator.language || "");

  function injectStyles() {
    if ($("sanaEnhancedStyles")) return;
    const style = document.createElement("style");
    style.id = "sanaEnhancedStyles";
    style.textContent = `
      .sana-typing-dots{display:inline-flex;align-items:center;gap:4px;padding:3px 2px}.sana-typing-dots i{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.35;animation:sanaDot 1.2s infinite ease-in-out}.sana-typing-dots i:nth-child(2){animation-delay:.15s}.sana-typing-dots i:nth-child(3){animation-delay:.3s}@keyframes sanaDot{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-3px);opacity:.9}}
      .sana-actions{display:flex;gap:7px;flex-wrap:wrap;padding:0 12px 10px}.sana-action{border:1px solid var(--line);background:rgba(56,189,248,.08);color:var(--text);border-radius:999px;padding:7px 10px;font-size:.72rem;font-weight:800;cursor:pointer}.sana-action:hover{border-color:var(--line-2)}
      .sana-countdown{margin:0 12px 10px;padding:8px 10px;border-radius:10px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.16);color:var(--muted);font-size:.72rem}.sana-countdown b{color:var(--text)}
      .sana-live .chat-header{box-shadow:inset 0 -2px 0 #22c55e}.sana-live .chat-input-row input::placeholder{color:#22c55e}
    `;
    document.head.appendChild(style);
  }

  function addMessage(text, who = "bot") {
    const root = $("chatMessages");
    if (!root) return null;
    const div = document.createElement("div");
    div.className = `chat-msg ${who}`;
    div.textContent = text;
    root.appendChild(div);
    root.scrollTop = root.scrollHeight;
    return div;
  }
  function addTyping() {
    const root = $("chatMessages");
    const div = document.createElement("div");
    div.className = "chat-msg bot typing sana-typing";
    div.innerHTML = '<span class="sana-typing-dots"><i></i><i></i><i></i></span>';
    root.appendChild(div);
    root.scrollTop = root.scrollHeight;
    return div;
  }
  function showCountdown(expiresAt) {
    let box = $("sanaCountdown");
    if (!box) {
      box = document.createElement("div");
      box.id = "sanaCountdown";
      box.className = "sana-countdown";
      $("chatPanel")?.insertBefore(box, $("chatMessages"));
    }
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      box.innerHTML = `<b>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}</b> · connecting with Naveen…`;
      if (seconds <= 0) { box.remove(); return; }
      setTimeout(tick, 1000);
    };
    tick();
  }
  function addActions() {
    const panel = $("chatPanel");
    if (!panel || $("sanaActions")) return;
    const row = document.createElement("div");
    row.id = "sanaActions";
    row.className = "sana-actions";
    row.innerHTML = `<button type="button" class="sana-action" id="sanaConnectBtn">💬 Chat with Naveen</button><button type="button" class="sana-action" id="sanaBookBtn">📅 Book a service</button>`;
    panel.insertBefore(row, $("chatInputRow") || $("chatForm"));
    $("sanaConnectBtn").addEventListener("click", connectToNaveen);
    $("sanaBookBtn").addEventListener("click", () => { $("chatInput").value = "I'd like to book a service"; $("chatForm").requestSubmit(); });
  }
  function greetingText() {
    const base = `${greeting(localHour)}! I'm Sana, Naveen's personal AI assistant. I'm happy to help here. 😊`;
    return isIndia ? base : `${base} It's ${indiaTimeText} in India right now. 🇮🇳`;
  }
  async function connectToNaveen() {
    if (liveConversation) return;
    const typing = addTyping();
    try {
      const status = await fetch(`${API}/public/sana/status`, { headers: headers() }).then(r => r.json());
      typing.remove();
      if (!status.online) { addMessage(`${greeting(localHour)}! Naveen is offline right now. I can pass a message to him, and he'll get back to you. 💛`, "bot"); return; }
      addMessage(`${greeting(localHour)}! Of course 😊 I'll check the live connection for you.`, "bot");
      const r = await fetch(`${API}/public/sana/connect`, { method: "POST", headers: headers(), body: "{}" }).then(x => x.json());
      if (r.offline) { addMessage("Naveen is offline right now. I can pass a message to him for you. 💛", "bot"); return; }
      if (r.approved && r.conversation_id) return enterLive(r.conversation_id);
      connectRequest = r.request_id;
      showCountdown(r.expires_at);
      pollConnection(r.request_id);
    } catch { typing.remove(); addMessage("Oops 😊 I couldn't check the live connection right now. Please try again in a moment.", "bot"); }
  }
  function pollConnection(id) {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/public/sana/connect/${id}`, { headers: headers() }).then(x => x.json());
        if (r.approved && r.conversation_id) return enterLive(r.conversation_id);
        if (r.status === "expired" || r.status === "rejected") { $("sanaCountdown")?.remove(); if (r.status === "expired") addMessage(`${greeting(localHour)}! The live connection window has closed for now. Naveen is offline for live chat, but I can pass him a message. 💛`, "bot"); return; }
        setTimeout(poll, 2000);
      } catch { setTimeout(poll, 4000); }
    };
    poll();
  }
  async function enterLive(conversationId) {
    liveConversation = conversationId;
    $("chatPanel")?.classList.add("sana-live");
    $("sanaCountdown")?.remove();
    $("sanaConnectBtn")?.remove();
    addMessage(`${greeting(localHour)}! You're connected with Naveen now. 😊👋`, "bot");
    startLivePolling();
  }
  async function startLivePolling() {
    if (livePoll) clearInterval(livePoll);
    const poll = async () => {
      if (!liveConversation) return;
      try {
        const r = await fetch(`${API}/public/sana/messages?conversation_id=${encodeURIComponent(liveConversation)}`, { headers: headers() }).then(x => x.json());
        const root = $("chatMessages");
        if (!root) return;
        const seen = new Set([...root.querySelectorAll("[data-sana-message-id]")].map(x => x.dataset.sanaMessageId));
        (r.messages || []).forEach(m => { if (!seen.has(String(m.id)) && m.sender === "naveen") { const el = addMessage(m.message, "bot"); el.dataset.sanaMessageId = m.id; } });
      } catch {}
    };
    await poll();
    livePoll = setInterval(poll, 2000);
  }

  async function sendLive(message) {
    const typing = addTyping();
    try {
      const r = await fetch(`${API}/public/sana/message`, { method: "POST", headers: headers(), body: JSON.stringify({ conversation_id: liveConversation, message }) }).then(x => x.json());
      typing.remove();
      if (!r.success) addMessage("The live chat is no longer connected. I can still pass your message to Naveen. 💛", "bot");
    } catch { typing.remove(); addMessage("I couldn't send that just now. Please try again 😊", "bot"); }
  }
  async function sendAi(message) {
    const typing = addTyping();
    try {
      const r = await fetch(`${API}/public/chat`, { method: "POST", headers: headers(), body: JSON.stringify({ message }) }).then(x => x.json());
      typing.remove();
      addMessage(r.reply || r.error || "Sorry, I couldn't get a response just now. 😊", "bot");
    } catch { typing.remove(); addMessage("Oops, something went wrong. Give me another try? 😊", "bot"); }
  }
  async function handleSubmit(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const input = $("chatInput");
    const message = input?.value.trim();
    if (!message) return;
    input.value = "";
    addMessage(message, "user");
    if (liveConversation) return sendLive(message);
    return sendAi(message);
  }
  function enhance() {
    injectStyles();
    const form = $("chatForm");
    const panel = $("chatPanel");
    if (!form || !panel) return;
    addActions();
    const initial = $("chatMessages")?.querySelector(".chat-msg.bot");
    if (initial) initial.textContent = greetingText();
    form.addEventListener("submit", handleSubmit, true);
    $("chatToggleBtn")?.addEventListener("click", () => setTimeout(() => { addActions(); }, 0));
    window.sana = { connectToNaveen, sendAi, session, timezone: TIMEZONE };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance, { once: true }); else enhance();
})();
