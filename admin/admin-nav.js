// Shared sidebar navigation + toast notifications for the admin panel.
// Every admin page includes this file and provides #sidebarSlot.

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.4 3.2-5.2 7-5.2s6.2 1.8 7 5.2"/></svg>`,
  skills: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6.5 3-3 3 3-3 3"/><path d="M4 20 15.5 8.5"/><path d="m6 14 4 4"/><path d="m3 21 4-1 14-14"/></svg>`,
  experience: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2"/></svg>`,
  education: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11.5V16c3 2 7 2 10 0v-4.5M21 9v6"/></svg>`,
  projects: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/></svg>`,
  certifications: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="m9 13-1 8 4-2 4 2-1-8M9.5 8 11 9.5 14.5 6"/></svg>`,
  achievements: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  workshops: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5V3h8v2M7 10h10M7 14h6"/></svg>`,
  blog: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 1-3-3V4Z"/><path d="M8 8h7M8 12h7M8 16h5"/></svg>`,
  quotes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17H5a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h2v5H6v2h3v2a3 3 0 0 1-2 3Zm10 0h-2a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h2v5h-3v2h3v2a3 3 0 0 1-2 3Z"/></svg>`,
  availability: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>`,
  testimonials: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>`,
  social: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.6M8.3 13.2l7.4 4.6"/></svg>`,
  services: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M17 14v6M14 17h6"/></svg>`,
};

// Local preview mode: mock only the dashboard's read-only API calls.
// This is deliberately limited to localhost/127.0.0.1 and never affects production.
(function installLocalDashboardPreview() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return;
  const realFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("api.naveenshankar.in/admin/")) return realFetch(input, init);
    const path = new URL(url, window.location.origin).pathname;
    const localResponse = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
    if (path === "/admin/me") return localResponse({ username: "admin (local preview)" });
    if (path === "/admin/stats") return localResponse({
      configured: true,
      daily: [
        { date: new Date(Date.now()-6*86400000).toISOString(), requests: 182, pageViews: 96, uniqueVisitors: 54 },
        { date: new Date(Date.now()-5*86400000).toISOString(), requests: 241, pageViews: 128, uniqueVisitors: 73 },
        { date: new Date(Date.now()-4*86400000).toISOString(), requests: 214, pageViews: 117, uniqueVisitors: 69 },
        { date: new Date(Date.now()-3*86400000).toISOString(), requests: 326, pageViews: 174, uniqueVisitors: 101 },
        { date: new Date(Date.now()-2*86400000).toISOString(), requests: 289, pageViews: 153, uniqueVisitors: 88 },
        { date: new Date(Date.now()-1*86400000).toISOString(), requests: 371, pageViews: 205, uniqueVisitors: 119 },
        { date: new Date().toISOString(), requests: 318, pageViews: 176, uniqueVisitors: 104 }
      ]
    });
    if (path === "/admin/activity") return localResponse({ activity: [
      { username: "admin", action: "profile_update", detail: "Local preview", created_at: Date.now()-8*60000, ip: "127.0.0.1" },
      { username: "admin", action: "dashboard_preview", detail: "Local-only mock data", created_at: Date.now()-22*60000, ip: "127.0.0.1" },
      { username: "admin", action: "login", detail: "Local preview", created_at: Date.now()-41*60000, ip: "127.0.0.1" }
    ] });
    return realFetch(input, init);
  };
})();

const ADMIN_NAV_SECTIONS = [
  { name: "Dashboard", icon: ICONS.dashboard, href: "/dashboard.html" },
  { name: "Profile", icon: ICONS.profile, href: "/profile-edit.html" },
  { name: "Skills", icon: ICONS.skills, href: "/skills.html" },
  { name: "Experience", icon: ICONS.experience, href: "/data.html?table=experience" },
  { name: "Education", icon: ICONS.education, href: "/data.html?table=education" },
  { name: "Projects", icon: ICONS.projects, href: "/data.html?table=projects" },
  { name: "Certifications", icon: ICONS.certifications, href: "/data.html?table=certifications" },
  { name: "Achievements", icon: ICONS.achievements, href: "/data.html?table=achievements" },
  { name: "Workshops", icon: ICONS.workshops, href: "/data.html?table=workshops" },
  { name: "Blog", icon: ICONS.blog, href: "/blog.html" },
  { name: "Quotes", icon: ICONS.quotes, href: "/quotes.html" },
  { name: "Availability", icon: ICONS.availability, href: "/availability.html" },
  { name: "Testimonials", icon: ICONS.testimonials, href: "/data.html?table=testimonials" },
  { name: "Social Links", icon: ICONS.social, href: "/data.html?table=social_links" },
  { name: "Services", icon: ICONS.services, href: "/data.html?table=services" },
];

function renderSidebar() {
  const slot = document.getElementById("sidebarSlot");
  if (!slot) return;
  const currentPath = window.location.pathname + window.location.search;
  const currentTable = new URLSearchParams(window.location.search).get("table");
  slot.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand"><span>naveenshankar.in</span></div>
      <nav class="sidebar-nav">
        ${ADMIN_NAV_SECTIONS.map((s) => {
          const isActive = currentPath === s.href || (s.href.includes("table=") && currentTable && s.href.includes(`table=${currentTable}`));
          return `<a href="${s.href}" class="${isActive ? "active" : ""}"><span class="icon">${s.icon}</span><span>${s.name}</span></a>`;
        }).join("")}
      </nav>
      <button class="sidebar-logout" id="sidebarLogoutBtn"><span class="icon">${ICONS.social}</span> Log out</button>
    </aside>
    <button class="sidebar-toggle" id="sidebarToggleBtn" aria-label="Toggle menu">☰</button>
  `;
  document.getElementById("sidebarLogoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_local_preview");
    window.location.href = "/login.html";
  });
  document.getElementById("sidebarToggleBtn").addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("open"));
}

function ensureToastRoot() {
  let root = document.getElementById("toastRoot");
  if (!root) { root = document.createElement("div"); root.id = "toastRoot"; root.className = "toast-root"; document.body.appendChild(root); }
  return root;
}
function showToast(message, type = "info") {
  const root = ensureToastRoot();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 250); }, 3200);
}

document.addEventListener("DOMContentLoaded", renderSidebar);
