// Run: node generate-seed.js
// Generates seed.sql with a hashed default admin user (username: admin, password: admin@123).
// The password is only used once, right here, to compute a hash — it is never written in plaintext.
// must_change_password = 1 forces a password change on first login.
const crypto = require("crypto");
const fs = require("fs");

const ITERATIONS = 100000;
const KEY_LEN = 32;

const username = "admin";
const password = "admin@123"; // default — must be changed on first login
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, "sha256");

const now = Date.now();
const sql = `INSERT INTO admin_users (username, email, password_hash, password_salt, must_change_password, created_at, updated_at)
VALUES ('${username}', NULL, '${hash.toString("hex")}', '${salt.toString("hex")}', 1, ${now}, ${now});
`;

fs.writeFileSync(__dirname + "/seed.sql", sql);
console.log("Wrote seed.sql — apply with: wrangler d1 execute naveenshankar-db --file=./seed.sql");
