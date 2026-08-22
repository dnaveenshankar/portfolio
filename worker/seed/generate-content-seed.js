// Run: node generate-content-seed.js
// Produces seed_content.sql from the actual content currently hardcoded in index.html,
// so the database starts out matching what's already live on the site.
const fs = require("fs");

function esc(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function jsonCol(val) {
  return esc(JSON.stringify(val));
}

const now = Date.now();
const lines = [];

// --- Profile ---
lines.push(`UPDATE profile SET
  full_name = ${esc("Naveen Shankar D")},
  title = ${esc("Network Engineer")},
  bio = ${esc("Network Engineer specializing in enterprise network operations, Cisco, Meraki, Aruba, SD-WAN, SolarWinds, ServiceNow and incident management.")},
  location = ${esc("Tirupur, Tamil Nadu")},
  email = ${esc("dnaveenshankar.2003@gmail.com")},
  updated_at = ${now}
WHERE id = 1;`);

// --- Skills (bar type) ---
const barSkills = [
  ["Network Troubleshooting", 95],
  ["TCP/IP, LAN/WAN, VLAN", 92],
  ["Cisco, Meraki, Aruba", 88],
  ["SD-WAN Support", 82],
  ["SolarWinds / OpsRamp", 88],
  ["ServiceNow / Jira", 90],
  ["Incident & Change Management", 90],
  ["Vendor / ISP Coordination", 86],
];
barSkills.forEach(([name, pct], i) => {
  lines.push(`INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES (${esc(name)}, NULL, ${pct}, 'bar', ${i}, ${now}, ${now});`);
});

// --- Skills (chip type) ---
const chipSkills = [
  "DHCP", "DNS", "LAN/WAN", "Wireless Infrastructure", "Meraki Dashboard",
  "AWS Prompt Engineering", "GitHub Copilot L1", "HTML/CSS/JS", "Python", "SQL",
];
chipSkills.forEach((name, i) => {
  lines.push(`INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES (${esc(name)}, NULL, NULL, 'chip', ${barSkills.length + i}, ${now}, ${now});`);
});

// --- Experience ---
const experience = [
  {
    meta: "March 2025 - Present",
    title: "Network Engineer - Wipro Limited",
    summary: "Supporting enterprise network infrastructure across multiple customer environments under Wipro's EDOH model.",
    details: [["Company", "Wipro Limited"], ["Role", "Network Engineer"], ["Model", "EDOH enterprise support"], ["Accounts", "5 enterprise customer accounts"], ["Tools", "SolarWinds, ServiceNow, Jira, Meraki Dashboard"], ["Infrastructure", "Cisco, Meraki, Aruba, SD-WAN"]],
    bullets: ["Supported 5 enterprise customer accounts under Wipro's EDOH model.", "Troubleshot Cisco, Meraki and Aruba wired/wireless infrastructure.", "Supported Silver Peak SD-WAN and monitored networks using SolarWinds.", "Managed Incidents, Service Requests and Changes through ServiceNow and Jira.", "Coordinated with ISPs and OEM vendors for issue resolution.", "Achieved 100% SLA compliance while providing 24x7 production support."],
    note: "Enterprise network operations experience across monitored production environments.",
  },
  {
    meta: "21 Dec 2022 - 31 Dec 2022",
    title: "Web Developer Intern - Kaizen Technosoft",
    summary: "Early software development exposure, retained as a supporting strength behind the primary networking profile.",
    details: [["Company", "Kaizen Technosoft"], ["Role", "Web Developer Intern"], ["Type", "Internship"], ["Skills", "HTML, CSS, Bootstrap, web development"]],
    bullets: ["Contributed to web development tasks during internship.", "Gained early exposure to project delivery, UI structure and professional development workflow."],
    note: "Early web development experience supporting a broader technical foundation.",
  },
];
experience.forEach((e, i) => {
  lines.push(`INSERT INTO experience (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES (${esc(e.meta)}, ${esc(e.title)}, ${esc(e.summary)}, ${jsonCol(e.details)}, ${jsonCol(e.bullets)}, ${esc(e.note)}, ${i}, ${now}, ${now});`);
});

// --- Education ---
const education = [
  {
    meta: "2024 - Present",
    title: "Master of Computer Applications (MCA)",
    summary: "Bharathiar University School of Distance Education, Online Mode. Percentage: 75.51%.",
    details: [["University", "Bharathiar University School of Distance Education"], ["Mode", "Online Mode"], ["Percentage", "75.51%"], ["Status", "Ongoing"], ["Location", "Coimbatore / Online"]],
    bullets: ["Postgraduate learning in computer applications.", "Supports technical breadth in software, systems and IT operations."],
    note: "MCA program through Bharathiar University School of Distance Education in online mode.",
  },
  {
    meta: "2021 - 2024",
    title: "B.Voc Networking and Mobile Application",
    summary: "PSG College of Arts & Science, Coimbatore. CGPA: 8.6.",
    details: [["College", "PSG College of Arts & Science"], ["City", "Coimbatore"], ["Degree", "B.Voc"], ["Specialization", "Networking and Mobile Application"], ["CGPA", "8.6"], ["Status", "Completed"]],
    bullets: ["Built the foundation for networking, mobile application and web technology learning.", "Held leadership roles during college journey including IIC and student council responsibilities."],
    note: "Core academic foundation for the networking career path.",
  },
  {
    meta: "2019 - 2021",
    title: "Higher Secondary Education",
    summary: "Bharathi Vikas Matric Hr. Sec. School, Tirupur. Science stream and school leadership exposure.",
    details: [["School", "Bharathi Vikas Matric Hr. Sec. School"], ["City", "Tirupur"], ["Board", "Tamil Nadu State Board"], ["Stream", "Maths, Computer Science, Physics, Chemistry"], ["Grade", "80% and above"]],
    bullets: ["Completed higher secondary education in science stream.", "Served in student representation and school activities."],
    note: "Completed higher secondary education with 80% and above academic performance.",
  },
  {
    meta: "2007 - 2019",
    title: "SSLC / Schooling",
    summary: "Kongu Matriculation School, Tirupur. Foundation from LKG to Class 10.",
    details: [["School", "Kongu Matriculation School"], ["City", "Tirupur"], ["Board", "Tamil Nadu State Board"], ["Duration", "LKG to Class 10"], ["Grade", "80% and above"]],
    bullets: ["Completed foundational schooling from LKG to Class 10.", "Built academic discipline and early learning foundation."],
    note: "Completed foundational schooling with 80% and above academic performance.",
  },
];
education.forEach((e, i) => {
  lines.push(`INSERT INTO education (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES (${esc(e.meta)}, ${esc(e.title)}, ${esc(e.summary)}, ${jsonCol(e.details)}, ${jsonCol(e.bullets)}, ${esc(e.note)}, ${i}, ${now}, ${now});`);
});

// --- Certifications ---
const certifications = [
  { icon: "☁️", title: "Cisco Meraki Training", summary: "Networking certification focused on Meraki environment fundamentals.", details: [["Category", "Networking"], ["Issuer", "Udemy"], ["Credential Type", "Training"], ["Skills", "Meraki Dashboard, cloud-managed networking, wireless fundamentals"]], bullets: ["Supports practical exposure to Cisco Meraki environments.", "Useful for enterprise wireless and dashboard-based network operations."], note: "Networking learning aligned with Cisco Meraki environments and dashboard-based operations." },
  { icon: "🧩", title: "Complete Networking Fundamentals", summary: "Core networking fundamentals including TCP/IP, LAN/WAN and foundation concepts.", details: [["Category", "Networking"], ["Issuer", "Udemy"], ["Skills", "TCP/IP, LAN/WAN, addressing, network basics"]], bullets: ["Strengthens core network engineering fundamentals.", "Relevant to incident troubleshooting and device connectivity analysis."], note: "Networking fundamentals used for daily incident analysis and troubleshooting." },
  { icon: "🔀", title: "Basic Routing & Switching", summary: "Routing and switching foundation for network operations and troubleshooting.", details: [["Category", "Networking"], ["Issuer", "Udemy"], ["Skills", "Routing basics, switching basics, network connectivity"]], bullets: ["Foundational routing and switching learning for enterprise network support.", "Helps with VLAN, gateway, interface and reachability troubleshooting."], note: "Routing and switching fundamentals supporting VLAN, gateway and reachability troubleshooting." },
  { icon: "🤖", title: "AWS Prompt Engineering", summary: "Cloud and AI learning credential.", details: [["Category", "Cloud and AI"], ["Skill", "Prompt engineering"], ["Use", "AI-assisted productivity and cloud awareness"]], bullets: ["Adds modern AI literacy to technical support and documentation workflows."], note: "Cloud and AI learning supporting modern technical productivity." },
  { icon: "💡", title: "GitHub Copilot L1", summary: "AI-assisted development skill credential.", details: [["Category", "AI-assisted development"], ["Skill", "Copilot usage, coding assistance, productivity"]], bullets: ["Supports documentation, automation ideas and developer productivity."], note: "AI-assisted productivity learning for documentation, automation ideas and development support." },
  { icon: "➕", title: "More Credentials", summary: "Additional networking, cloud, monitoring and ITSM learning credentials.", details: [["Networking", "Cisco, Meraki, routing, switching"], ["Cloud", "AWS, Azure, distributed systems"], ["Operations", "ITSM, ServiceNow, monitoring, incident management"]], bullets: ["Additional learning includes networking, cloud, ITSM, monitoring and AI-assisted productivity programs."], note: "Continuous learning across networking, cloud, ITSM, monitoring and AI-assisted productivity." },
];
certifications.forEach((c, i) => {
  lines.push(`INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES (${esc(c.icon)}, ${esc(c.title)}, ${esc(c.summary)}, ${jsonCol(c.details)}, ${jsonCol(c.bullets)}, ${esc(c.note)}, ${i}, ${now}, ${now});`);
});

// --- Achievements / Leadership ---
const achievements = [
  { meta: "PSG College of Arts & Science", title: "IIC Student Ambassador", summary: "Promoted innovation and student engagement.", details: [["Institution", "PSG College of Arts & Science"], ["Role", "IIC Student Ambassador"], ["Focus", "Innovation and entrepreneurship"]], bullets: ["Encouraged innovation culture among students.", "Supported events and student engagement initiatives."], note: "Student innovation leadership experience from PSG College of Arts & Science." },
  { meta: "Department Association", title: "Association Chairperson", summary: "Led department events and student initiatives.", details: [["Institution", "PSG College of Arts & Science"], ["Role", "Association Chairperson"], ["Focus", "Team leadership, events, coordination"]], bullets: ["Led departmental initiatives and event planning.", "Managed responsibilities across teams, logistics and student coordination."], note: "Leadership experience from academic and technical event environments." },
  { meta: "College Governance", title: "Student Council Member", summary: "Represented student interests and coordinated campus activities.", details: [["Institution", "PSG College of Arts & Science"], ["Role", "Student Council Member"], ["Focus", "Representation and coordination"]], bullets: ["Represented student concerns and supported communication between students and faculty.", "Contributed to campus event and activity coordination."], note: "Shows communication, responsibility and stakeholder handling." },
  { meta: "Award", title: "Techathon '22 Winner", summary: "Won for E-Museum project and innovation contribution.", details: [["Event", "Techathon '22"], ["Position", "Winner"], ["Project", "E-Museum"], ["Role", "Backend developer / project contributor"]], bullets: ["Won recognition for E-Museum project.", "Presented an innovative technology solution."], note: "Recognized for project innovation and technical problem-solving through the E-Museum project." },
  { meta: "Organizer", title: "Netronics '23 and 2.0", summary: "Organized major technical events with large participant engagement.", details: [["Event", "Netronics '23 / Netronics 2.0"], ["Role", "Organizer / Chairperson"], ["Scale", "Large student participation"], ["Focus", "Technical event leadership"]], bullets: ["Coordinated technical event activities and logistics.", "Handled team responsibilities and participant coordination."], note: "Evidence of leadership, planning and execution in technical event environments." },
  { meta: "Organizer", title: "Gateway '24", summary: "Inter-college technical symposium coordination and logistics.", details: [["Event", "Gateway '24"], ["Type", "Inter-college technical symposium"], ["Role", "Organizer"], ["Focus", "Logistics and coordination"]], bullets: ["Supported inter-college communication and event execution.", "Managed event flow and coordination responsibilities."], note: "Inter-college event coordination experience with technical symposium exposure." },
];
achievements.forEach((a, i) => {
  lines.push(`INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES (${esc(a.meta)}, ${esc(a.title)}, ${esc(a.summary)}, ${jsonCol(a.details)}, ${jsonCol(a.bullets)}, ${esc(a.note)}, ${i}, ${now}, ${now});`);
});

// --- Social links ---
const socials = [
  ["LinkedIn", "https://www.linkedin.com/in/d-naveens/"],
  ["GitHub", "https://github.com/dnaveenshankar"],
];
socials.forEach(([platform, url], i) => {
  lines.push(`INSERT INTO social_links (platform, url, sort_order, created_at, updated_at)
VALUES (${esc(platform)}, ${esc(url)}, ${i}, ${now}, ${now});`);
});

fs.writeFileSync(__dirname + "/seed_content.sql", lines.join("\n\n") + "\n");
console.log(`Wrote seed_content.sql with ${lines.length} statements.`);
