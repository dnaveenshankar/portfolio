// Shared sidebar navigation + toast notifications for the admin panel.
const ICONS = {
  dashboard:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  profile:`<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>`,
  skills:`<svg viewBox="0 0 24 24"><path d="m14.7 6.3 3-3a3 3 0 0 1 4 4l-3 3"/><path d="m17 7-10.5 10.5a2.1 2.1 0 1 1-3-3L14 4"/><path d="m5 19 2 2"/></svg>`,
  experience:`<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>`,
  education:`<svg viewBox="0 0 24 24"><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c3 2.5 7 2.5 10 0v-5M21 9v6"/></svg>`,
  projects:`<svg viewBox="0 0 24 24"><path d="M4 19 19 4"/><path d="M9 4h10v10"/><path d="M4 9V4h5"/></svg>`,
  certifications:`<svg viewBox="0 0 24 24"><path d="M6 3h12v15H6z"/><path d="M9 7h6M9 11h6"/><path d="m9 18 3 3 3-3"/></svg>`,
  achievements:`<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>`,
  workshops:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m8 21 4-3 4 3M7 8h10M7 12h6"/></svg>`,
  blog:`<svg viewBox="0 0 24 24"><path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4Z"/><path d="M8 8h7M8 12h7M8 16h5"/></svg>`,
  quotes:`<svg viewBox="0 0 24 24"><path d="M7 17H5a2 2 0 0 1-2-2v-3a5 5 0 0 1 5-5h1v4H8a2 2 0 0 0-2 2h3v4H7ZM18 17h-2a2 2 0 0 1-2-2v-3a5 5 0 0 1 5-5h1v4h-1a2 2 0 0 0-2 2h3v4h-2Z"/></svg>`,
  availability:`<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3v3H8z"/></svg>`,
  testimonials:`<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  social:`<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 11 7.5-4M8.2 13l7.5 4"/></svg>`,
  services:`<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="17" r="2"/></svg>`,
  logout:`<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M21 4v16"/></svg>`
};

const ADMIN_NAV_SECTIONS = [
  {name:"Dashboard",icon:"dashboard",href:"/dashboard.html"},{name:"Profile",icon:"profile",href:"/profile-edit.html"},
  {name:"Skills",icon:"skills",href:"/skills.html"},{name:"Experience",icon:"experience",href:"/data.html?table=experience"},
  {name:"Education",icon:"education",href:"/data.html?table=education"},{name:"Projects",icon:"projects",href:"/data.html?table=projects"},
  {name:"Certifications",icon:"certifications",href:"/data.html?table=certifications"},{name:"Achievements",icon:"achievements",href:"/data.html?table=achievements"},
  {name:"Workshops",icon:"workshops",href:"/data.html?table=workshops"},{name:"Blog",icon:"blog",href:"/blog.html"},
  {name:"Quotes",icon:"quotes",href:"/quotes.html"},{name:"Availability",icon:"availability",href:"/availability.html"},
  {name:"Testimonials",icon:"testimonials",href:"/data.html?table=testimonials"},{name:"Social Links",icon:"social",href:"/data.html?table=social_links"},
  {name:"Services",icon:"services",href:"/data.html?table=services"}
];

function renderSidebar(){
  const slot=document.getElementById("sidebarSlot"); if(!slot)return;
  const currentPath=window.location.pathname+window.location.search;
  const currentTable=new URLSearchParams(window.location.search).get("table");
  slot.innerHTML=`<aside class="sidebar"><div class="sidebar-brand"><span>naveenshankar.in</span></div><nav class="sidebar-nav">${ADMIN_NAV_SECTIONS.map(s=>{const active=currentPath===s.href||(s.href.includes("table=")&&currentTable&&s.href.includes(`table=${currentTable}`));return `<a href="${s.href}" class="${active?"active":""}"><span class="icon">${ICONS[s.icon]}</span><span>${s.name}</span></a>`}).join("")}</nav><button class="sidebar-logout" id="sidebarLogoutBtn"><span class="icon">${ICONS.logout}</span> Log out</button></aside><button class="sidebar-toggle" id="sidebarToggleBtn" aria-label="Toggle menu">☰</button>`;
  document.getElementById("sidebarLogoutBtn").addEventListener("click",()=>{sessionStorage.removeItem("admin_token");window.location.href="/login.html"});
  document.getElementById("sidebarToggleBtn").addEventListener("click",()=>{const sidebar=document.querySelector(".sidebar");if(sidebar)sidebar.classList.toggle("open")});
}
function ensureToastRoot(){let root=document.getElementById("toastRoot");if(!root){root=document.createElement("div");root.id="toastRoot";root.className="toast-root";document.body.appendChild(root)}return root}
function showToast(message,type="info"){const root=ensureToastRoot(),toast=document.createElement("div");toast.className=`toast toast-${type}`;const icon=type==="success"?"✓":type==="error"?"!":"i";toast.innerHTML=`<span>${icon}</span><span>${message}</span>`;root.appendChild(toast);requestAnimationFrame(()=>toast.classList.add("show"));setTimeout(()=>{toast.classList.remove("show");setTimeout(()=>toast.remove(),250)},3200)}
document.addEventListener("DOMContentLoaded",renderSidebar);
