(() => {
  const API = "https://api.naveenshankar.in";
  const SESSION_KEY = "sana_session";
  const TZ_KEY = "sana_timezone";
  const state = { session: null, timezone: "Asia/Kolkata" };
  const session = () => { let id = localStorage.getItem(SESSION_KEY); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0,40); localStorage.setItem(SESSION_KEY,id); } return id; };
  const timezone = () => localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  state.session=session(); state.timezone=timezone();
  async function send(message) {
    const r=await fetch(`${API}/public/chat`,{method:"POST",headers:{"Content-Type":"application/json","X-Sana-Session":state.session,"X-Sana-Timezone":state.timezone},body:JSON.stringify({message})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||"Chat request failed");
    return data;
  }
  window.SanaAPI={send,state};
  document.addEventListener("DOMContentLoaded",()=>{
    document.querySelectorAll("[data-sana-chat-form]").forEach(form=>{
      if(form.dataset.sanaWired)return; form.dataset.sanaWired="1";
      const input=form.querySelector("[data-sana-input]"); const list=form.closest("[data-sana-widget]")?.querySelector("[data-sana-messages]"); if(!input||!list)return;
      form.addEventListener("submit",async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;input.value="";const u=document.createElement("div");u.textContent=text;u.className="sana-user-message";list.appendChild(u);const dots=document.createElement("div");dots.className="sana-typing";dots.innerHTML="<span></span><span></span><span></span>";list.appendChild(dots);try{const data=await send(text);dots.remove();const b=document.createElement("div");b.textContent=data.reply||"I'm here — tell me what's on your mind. 💙";b.className="sana-bot-message";list.appendChild(b);}catch(err){dots.remove();const b=document.createElement("div");b.textContent="I'm having a little trouble connecting right now. Please try again. 💙";b.className="sana-bot-message";list.appendChild(b);}list.scrollTop=list.scrollHeight;});
    });
  });
})();
