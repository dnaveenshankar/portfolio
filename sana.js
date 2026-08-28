(() => {
  const API = "https://api.naveenshankar.in";
  const SESSION_KEY = "sana_session";
  const TZ_KEY = "sana_timezone";
  const state = { session: null, timezone: "Asia/Kolkata", conversationId: null, liveStatus: null, lastMessageId: 0, liveTimer: null, connectNameRequested: false };

  const session = () => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  };

  const timezone = () => localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  state.session = session();
  state.timezone = timezone();

  async function request(path, options = {}) {
    const r = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Sana-Session": state.session,
        "X-Sana-Timezone": state.timezone,
        ...(options.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Sana request failed");
    return data;
  }

  async function send(message) {
    if (state.conversationId && state.liveStatus === "accepted") {
      return request("/public/sana/message", {
        method: "POST",
        body: JSON.stringify({ conversation_id: state.conversationId, message }),
      });
    }
    return request("/public/chat", { method: "POST", body: JSON.stringify({ message }) });
  }

  async function requestLiveConnection(name) {
    return request("/public/sana/connect", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async function pollLive(render) {
    if (!state.conversationId) return;
    try {
      const data = await request(`/public/sana/live?conversation_id=${encodeURIComponent(state.conversationId)}&after=${state.lastMessageId}`);
      const previous = state.liveStatus;
      state.liveStatus = data.status;
      (data.messages || []).forEach(m => {
        state.lastMessageId = Math.max(state.lastMessageId, Number(m.id) || 0);
        if (m.sender !== "visitor" && typeof render === "function") render(m.message, m.sender);
      });
      if (data.status === "accepted" && previous !== "accepted" && typeof render === "function") {
        render("You're connected with Naveen now. 💬", "naveen-status");
      }
      if ((data.status === "declined" || data.status === "expired") && previous !== data.status && typeof render === "function") {
        render(
          data.status === "declined"
            ? "Naveen couldn't accept the connection right now. I can still help you here. 💙"
            : "The live connection request has expired. If you'd like, you can request another connection.",
          "sana-status"
        );
        if (data.status !== "accepted") {
          state.conversationId = null;
          state.liveStatus = null;
        }
      }
    } catch {}
  }

  window.SanaAPI = { send, state, pollLive };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-sana-chat-form]").forEach(form => {
      if (form.dataset.sanaWired) return;
      form.dataset.sanaWired = "1";

      const input = form.querySelector("[data-sana-input]");
      const list = form.closest("[data-sana-widget]")?.querySelector("[data-sana-messages]");
      if (!input || !list) return;

      const add = (text, kind) => {
        const b = document.createElement("div");
        b.textContent = text;
        b.className = kind === "visitor" ? "sana-user-message" : "sana-bot-message";
        list.appendChild(b);
        list.scrollTop = list.scrollHeight;
      };

      const startLivePolling = () => {
        if (state.liveTimer) clearInterval(state.liveTimer);
        state.liveTimer = setInterval(() => pollLive((text, sender) => {
          if (sender !== "naveen-status") add(text, sender);
        }), 2000);
      };

      form.addEventListener("submit", async e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        add(text, "visitor");

        const dots = document.createElement("div");
        dots.className = "sana-typing";
        dots.innerHTML = "<span></span><span></span><span></span>";
        list.appendChild(dots);

        try {
          let data;

          // Live connection deliberately bypasses the AI chat endpoint so Sana
          // never creates a request without collecting the visitor's name.
          if (!state.conversationId && /\b(live|talk|connect|speak|call|chat with naveen|talk to naveen|connect me)\b/i.test(text)) {
            state.connectNameRequested = true;
            dots.remove();
            add("Of course! 😊 Before I send the live connection request, may I have your name?", "sana");
            input.placeholder = "Your name…";
            list.scrollTop = list.scrollHeight;
            return;
          }

          if (state.connectNameRequested && !state.conversationId) {
            state.connectNameRequested = false;
            data = await requestLiveConnection(text);
            input.placeholder = "Type a message…";
          } else {
            data = await send(text);
          }

          dots.remove();
          if (data.reply) add(data.reply, "sana");

          if (data.conversation_id) {
            state.conversationId = data.conversation_id;
            state.liveStatus = data.status || "pending";
            state.lastMessageId = 0;
            startLivePolling();
          }

          if (data.action === "naveen_offline") {
            state.conversationId = null;
            state.liveStatus = null;
          }
        } catch (err) {
          dots.remove();
          add("I'm having a little trouble connecting right now. Please try again. 💙", "sana");
        }
        list.scrollTop = list.scrollHeight;
      });
    });

    document.querySelectorAll("[data-sana-messages]").forEach(list => {
      const first = [...list.querySelectorAll(".sana-bot-message")].find(el => /Sana/i.test(el.textContent || ""));
      if (first) {
        first.textContent = "Hi I'm Sana, Naveen's personal assistant. I'm happy to help here. 💙";
        first.setAttribute("data-sana-default", "1");
      } else {
        const b = document.createElement("div");
        b.textContent = "Hi I'm Sana, Naveen's personal assistant. I'm happy to help here. 💙";
        b.className = "sana-bot-message";
        b.setAttribute("data-sana-default", "1");
        list.insertBefore(b, list.firstChild);
      }
    });
  });
})();
