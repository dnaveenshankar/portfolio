// Shared sidebar navigation + toast notifications for the admin panel.
// Every admin page includes this file and provides #sidebarSlot.

const ADMIN_NAV_SECTIONS = [
  { name: "Dashboard", icon: "⌂", href: "/dashboard.html" },
  { name: "Profile", icon: "◉", href: "/profile-edit.html" },
  { name: "Skills", icon: "✦", href: "/skills.html" },
  { name: "Experience", icon: "▣", href: "/data.html?table=experience" },
  { name: "Education", icon: "◇", href: "/data.html?table=education" },
  { name: "Projects", icon: "↗", href: "/data.html?table=projects" },
  { name: "Certifications", icon: "✓", href: "/data.html?table=certifications" },
  { name: "Achievements", icon: "★", href: "/data.html?table=achievements" },
  { name: "Workshops", icon: "♧", href: "/data.html?table=workshops" },
  { name: "Blog", icon: "✎", href: "/blog.html" },
  { name: "Quotes", icon: "❝", href: "/quotes.html" },
  { name: "Availability", icon: "◷", href: "/availability.html" },
  { name: "Testimonials", icon: "☆", href: "/data.html?table=testimonials" },
  { name: "Social Links", icon: "↗", href: "/data.html?table=social_links" },
  { name: "Services", icon: "⊞", href: "/data.html?table=services" },
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
          const isActive =
            currentPath === s.href ||
            (s.href.includes("table=") && currentTable && s.href.includes(`table=${currentTable}`));
          return `<a href="${s.href}" class="${isActive ? "active" : ""}"><span class="icon">${s.icon}</span><span>${s.name}</span></a>`;
        }).join("")}
      </nav>
      <button class="sidebar-logout" id="sidebarLogoutBtn">↪ &nbsp; Log out</button>
    </aside>
    <button class="sidebar-toggle" id="sidebarToggleBtn" aria-label="Toggle menu">☰</button>
  `;

  document.getElementById("sidebarLogoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("admin_token");
    window.location.href = "/login.html";
  });

  document.getElementById("sidebarToggleBtn").addEventListener("click", () => {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.classList.toggle("open");
  });
}

function ensureToastRoot() {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
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
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

document.addEventListener("DOMContentLoaded", renderSidebar);
