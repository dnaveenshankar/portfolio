UPDATE profile SET
  full_name = 'Naveen Shankar D',
  title = 'Network Engineer',
  bio = 'Network Engineer specializing in enterprise network operations, Cisco, Meraki, Aruba, SD-WAN, SolarWinds, ServiceNow and incident management.',
  location = 'Tirupur, Tamil Nadu',
  email = 'dnaveenshankar.2003@gmail.com',
  updated_at = 1787374204818
WHERE id = 1;

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Network Troubleshooting', NULL, 95, 'bar', 0, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('TCP/IP, LAN/WAN, VLAN', NULL, 92, 'bar', 1, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Cisco, Meraki, Aruba', NULL, 88, 'bar', 2, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('SD-WAN Support', NULL, 82, 'bar', 3, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('SolarWinds / OpsRamp', NULL, 88, 'bar', 4, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('ServiceNow / Jira', NULL, 90, 'bar', 5, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Incident & Change Management', NULL, 90, 'bar', 6, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Vendor / ISP Coordination', NULL, 86, 'bar', 7, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('DHCP', NULL, NULL, 'chip', 8, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('DNS', NULL, NULL, 'chip', 9, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('LAN/WAN', NULL, NULL, 'chip', 10, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Wireless Infrastructure', NULL, NULL, 'chip', 11, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Meraki Dashboard', NULL, NULL, 'chip', 12, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('AWS Prompt Engineering', NULL, NULL, 'chip', 13, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('GitHub Copilot L1', NULL, NULL, 'chip', 14, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('HTML/CSS/JS', NULL, NULL, 'chip', 15, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('Python', NULL, NULL, 'chip', 16, 1787374204818, 1787374204818);

INSERT INTO skills (name, category, proficiency, display_type, sort_order, created_at, updated_at)
VALUES ('SQL', NULL, NULL, 'chip', 17, 1787374204818, 1787374204818);

INSERT INTO experience (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('March 2025 - Present', 'Network Engineer - Wipro Limited', 'Supporting enterprise network infrastructure across multiple customer environments under Wipro''s EDOH model.', '[["Company","Wipro Limited"],["Role","Network Engineer"],["Model","EDOH enterprise support"],["Accounts","5 enterprise customer accounts"],["Tools","SolarWinds, ServiceNow, Jira, Meraki Dashboard"],["Infrastructure","Cisco, Meraki, Aruba, SD-WAN"]]', '["Supported 5 enterprise customer accounts under Wipro''s EDOH model.","Troubleshot Cisco, Meraki and Aruba wired/wireless infrastructure.","Supported Silver Peak SD-WAN and monitored networks using SolarWinds.","Managed Incidents, Service Requests and Changes through ServiceNow and Jira.","Coordinated with ISPs and OEM vendors for issue resolution.","Achieved 100% SLA compliance while providing 24x7 production support."]', 'Enterprise network operations experience across monitored production environments.', 0, 1787374204818, 1787374204818);

INSERT INTO experience (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('21 Dec 2022 - 31 Dec 2022', 'Web Developer Intern - Kaizen Technosoft', 'Early software development exposure, retained as a supporting strength behind the primary networking profile.', '[["Company","Kaizen Technosoft"],["Role","Web Developer Intern"],["Type","Internship"],["Skills","HTML, CSS, Bootstrap, web development"]]', '["Contributed to web development tasks during internship.","Gained early exposure to project delivery, UI structure and professional development workflow."]', 'Early web development experience supporting a broader technical foundation.', 1, 1787374204818, 1787374204818);

INSERT INTO education (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('2024 - Present', 'Master of Computer Applications (MCA)', 'Bharathiar University School of Distance Education, Online Mode. Percentage: 75.51%.', '[["University","Bharathiar University School of Distance Education"],["Mode","Online Mode"],["Percentage","75.51%"],["Status","Ongoing"],["Location","Coimbatore / Online"]]', '["Postgraduate learning in computer applications.","Supports technical breadth in software, systems and IT operations."]', 'MCA program through Bharathiar University School of Distance Education in online mode.', 0, 1787374204818, 1787374204818);

INSERT INTO education (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('2021 - 2024', 'B.Voc Networking and Mobile Application', 'PSG College of Arts & Science, Coimbatore. CGPA: 8.6.', '[["College","PSG College of Arts & Science"],["City","Coimbatore"],["Degree","B.Voc"],["Specialization","Networking and Mobile Application"],["CGPA","8.6"],["Status","Completed"]]', '["Built the foundation for networking, mobile application and web technology learning.","Held leadership roles during college journey including IIC and student council responsibilities."]', 'Core academic foundation for the networking career path.', 1, 1787374204818, 1787374204818);

INSERT INTO education (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('2019 - 2021', 'Higher Secondary Education', 'Bharathi Vikas Matric Hr. Sec. School, Tirupur. Science stream and school leadership exposure.', '[["School","Bharathi Vikas Matric Hr. Sec. School"],["City","Tirupur"],["Board","Tamil Nadu State Board"],["Stream","Maths, Computer Science, Physics, Chemistry"],["Grade","80% and above"]]', '["Completed higher secondary education in science stream.","Served in student representation and school activities."]', 'Completed higher secondary education with 80% and above academic performance.', 2, 1787374204818, 1787374204818);

INSERT INTO education (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('2007 - 2019', 'SSLC / Schooling', 'Kongu Matriculation School, Tirupur. Foundation from LKG to Class 10.', '[["School","Kongu Matriculation School"],["City","Tirupur"],["Board","Tamil Nadu State Board"],["Duration","LKG to Class 10"],["Grade","80% and above"]]', '["Completed foundational schooling from LKG to Class 10.","Built academic discipline and early learning foundation."]', 'Completed foundational schooling with 80% and above academic performance.', 3, 1787374204818, 1787374204818);

INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('☁️', 'Cisco Meraki Training', 'Networking certification focused on Meraki environment fundamentals.', '[["Category","Networking"],["Issuer","Udemy"],["Credential Type","Training"],["Skills","Meraki Dashboard, cloud-managed networking, wireless fundamentals"]]', '["Supports practical exposure to Cisco Meraki environments.","Useful for enterprise wireless and dashboard-based network operations."]', 'Networking learning aligned with Cisco Meraki environments and dashboard-based operations.', 0, 1787374204818, 1787374204818);

INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('🧩', 'Complete Networking Fundamentals', 'Core networking fundamentals including TCP/IP, LAN/WAN and foundation concepts.', '[["Category","Networking"],["Issuer","Udemy"],["Skills","TCP/IP, LAN/WAN, addressing, network basics"]]', '["Strengthens core network engineering fundamentals.","Relevant to incident troubleshooting and device connectivity analysis."]', 'Networking fundamentals used for daily incident analysis and troubleshooting.', 1, 1787374204818, 1787374204818);

INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('🔀', 'Basic Routing & Switching', 'Routing and switching foundation for network operations and troubleshooting.', '[["Category","Networking"],["Issuer","Udemy"],["Skills","Routing basics, switching basics, network connectivity"]]', '["Foundational routing and switching learning for enterprise network support.","Helps with VLAN, gateway, interface and reachability troubleshooting."]', 'Routing and switching fundamentals supporting VLAN, gateway and reachability troubleshooting.', 2, 1787374204818, 1787374204818);

INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('🤖', 'AWS Prompt Engineering', 'Cloud and AI learning credential.', '[["Category","Cloud and AI"],["Skill","Prompt engineering"],["Use","AI-assisted productivity and cloud awareness"]]', '["Adds modern AI literacy to technical support and documentation workflows."]', 'Cloud and AI learning supporting modern technical productivity.', 3, 1787374204818, 1787374204818);

INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('💡', 'GitHub Copilot L1', 'AI-assisted development skill credential.', '[["Category","AI-assisted development"],["Skill","Copilot usage, coding assistance, productivity"]]', '["Supports documentation, automation ideas and developer productivity."]', 'AI-assisted productivity learning for documentation, automation ideas and development support.', 4, 1787374204818, 1787374204818);

INSERT INTO certifications (icon, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('➕', 'More Credentials', 'Additional networking, cloud, monitoring and ITSM learning credentials.', '[["Networking","Cisco, Meraki, routing, switching"],["Cloud","AWS, Azure, distributed systems"],["Operations","ITSM, ServiceNow, monitoring, incident management"]]', '["Additional learning includes networking, cloud, ITSM, monitoring and AI-assisted productivity programs."]', 'Continuous learning across networking, cloud, ITSM, monitoring and AI-assisted productivity.', 5, 1787374204818, 1787374204818);

INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('PSG College of Arts & Science', 'IIC Student Ambassador', 'Promoted innovation and student engagement.', '[["Institution","PSG College of Arts & Science"],["Role","IIC Student Ambassador"],["Focus","Innovation and entrepreneurship"]]', '["Encouraged innovation culture among students.","Supported events and student engagement initiatives."]', 'Student innovation leadership experience from PSG College of Arts & Science.', 0, 1787374204818, 1787374204818);

INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('Department Association', 'Association Chairperson', 'Led department events and student initiatives.', '[["Institution","PSG College of Arts & Science"],["Role","Association Chairperson"],["Focus","Team leadership, events, coordination"]]', '["Led departmental initiatives and event planning.","Managed responsibilities across teams, logistics and student coordination."]', 'Leadership experience from academic and technical event environments.', 1, 1787374204818, 1787374204818);

INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('College Governance', 'Student Council Member', 'Represented student interests and coordinated campus activities.', '[["Institution","PSG College of Arts & Science"],["Role","Student Council Member"],["Focus","Representation and coordination"]]', '["Represented student concerns and supported communication between students and faculty.","Contributed to campus event and activity coordination."]', 'Shows communication, responsibility and stakeholder handling.', 2, 1787374204818, 1787374204818);

INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('Award', 'Techathon ''22 Winner', 'Won for E-Museum project and innovation contribution.', '[["Event","Techathon ''22"],["Position","Winner"],["Project","E-Museum"],["Role","Backend developer / project contributor"]]', '["Won recognition for E-Museum project.","Presented an innovative technology solution."]', 'Recognized for project innovation and technical problem-solving through the E-Museum project.', 3, 1787374204818, 1787374204818);

INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('Organizer', 'Netronics ''23 and 2.0', 'Organized major technical events with large participant engagement.', '[["Event","Netronics ''23 / Netronics 2.0"],["Role","Organizer / Chairperson"],["Scale","Large student participation"],["Focus","Technical event leadership"]]', '["Coordinated technical event activities and logistics.","Handled team responsibilities and participant coordination."]', 'Evidence of leadership, planning and execution in technical event environments.', 4, 1787374204818, 1787374204818);

INSERT INTO achievements (meta, title, summary, details_json, bullets_json, note, sort_order, created_at, updated_at)
VALUES ('Organizer', 'Gateway ''24', 'Inter-college technical symposium coordination and logistics.', '[["Event","Gateway ''24"],["Type","Inter-college technical symposium"],["Role","Organizer"],["Focus","Logistics and coordination"]]', '["Supported inter-college communication and event execution.","Managed event flow and coordination responsibilities."]', 'Inter-college event coordination experience with technical symposium exposure.', 5, 1787374204818, 1787374204818);

INSERT INTO social_links (platform, url, sort_order, created_at, updated_at)
VALUES ('LinkedIn', 'https://www.linkedin.com/in/d-naveens/', 0, 1787374204818, 1787374204818);

INSERT INTO social_links (platform, url, sort_order, created_at, updated_at)
VALUES ('GitHub', 'https://github.com/dnaveenshankar', 1, 1787374204818, 1787374204818);
