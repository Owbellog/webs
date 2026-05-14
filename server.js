const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { Firestore } = require("@google-cloud/firestore");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const CAMPAIGNS_FILE = path.join(ROOT, "campaigns.json");
const USERS_FILE = path.join(ROOT, "users.json");
const WIELAND_CONTACTS_FILE = path.join(ROOT, "wieland-contacts.json");
const WIELAND_UPLOAD_LOGS_FILE = path.join(ROOT, "wieland-upload-logs.json");

loadEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_API_URL = process.env.THRIO_API_URL || "https://mancity.thrio.io/data/api/ai/prediction";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || "nextiq-campaigns-salt-v1";
const FIRESTORE_PREFIX = sanitizeFirestorePrefix(process.env.FIRESTORE_PREFIX || "nextiq");
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || `${FIRESTORE_PREFIX}_campaigns`;
const USERS_COLLECTION = `${FIRESTORE_PREFIX}_users`;
const WIELAND_CONTACTS_COLLECTION = `${FIRESTORE_PREFIX}_wieland_contacts`;
const WIELAND_UPLOAD_LOGS_COLLECTION = `${FIRESTORE_PREFIX}_wieland_upload_logs`;
const SESSION_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours
const SESSION_COOKIE_NAME = "niq_sess";
const WIELAND_SESSION_COOKIE_NAME = "niq_w_sess";
const WIELAND_SESSION_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours
const CAMPAIGN_PERMISSIONS = ["createCampaign", "editCampaign", "deleteCampaign"];

const firestore = createFirestoreClient();

// Rate limiter for admin authentication (in-memory, per IP)
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000; // 15 minutes
const adminLoginAttempts = new Map(); // ip -> { count, blockedUntil }

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function isAdminRateLimited(ip) {
  const record = adminLoginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() < record.blockedUntil) return true;
  adminLoginAttempts.delete(ip); // block expired, reset
  return false;
}

function recordFailedAdminAttempt(ip) {
  const record = adminLoginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  record.count += 1;
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    record.blockedUntil = Date.now() + RATE_LIMIT_BLOCK_MS;
  }
  adminLoginAttempts.set(ip, record);
}

function clearAdminAttempts(ip) {
  adminLoginAttempts.delete(ip);
}

// ── Encryption helpers ─────────────────────────────────────────────────────
// AES-256-GCM. Key is derived from ADMIN_PASSWORD + ENCRYPTION_SALT using
// PBKDF2 (100,000 iterations) so the raw password is never stored.
// Encrypted values are stored as: "enc:v1:<iv>:<authTag>:<ciphertext>" (hex).
// Plain-text values (legacy) are accepted on read for backward compatibility.

const ENCRYPT_PREFIX = "enc:v1:";
let _encryptionKey = null;

function getEncryptionKey() {
  if (_encryptionKey) return _encryptionKey;
  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD is required for campaign secret encryption.");
  }
  _encryptionKey = crypto.pbkdf2Sync(
    ADMIN_PASSWORD,
    ENCRYPTION_SALT,
    100_000,
    32,
    "sha256"
  );
  return _encryptionKey;
}

function encryptSecret(plaintext) {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPT_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(value) {
  if (!value) return value;
  // Legacy plaintext — return as-is for backward compatibility
  if (!value.startsWith(ENCRYPT_PREFIX)) return value;
  const key = getEncryptionKey();
  const rest = value.slice(ENCRYPT_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret format.");
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// Fields that must be encrypted at rest
const SECRET_FIELDS = ["token", "cookie", "geminiApiKey", "questionsGeminiApiKey", "wielandNccCredential", "summaryagenticAiApiKey", "summaryagenticHubspotToken", "pulseformsAiApiKey"];

function encryptCampaignSecrets(campaign) {
  const result = { ...campaign };
  for (const field of SECRET_FIELDS) {
    if (result[field]) result[field] = encryptSecret(result[field]);
  }
  return result;
}

function decryptCampaignSecrets(campaign) {
  const result = { ...campaign };
  for (const field of SECRET_FIELDS) {
    if (result[field]) result[field] = decryptSecret(result[field]);
  }
  return result;
}
// ──────────────────────────────────────────────────────────────────────────

// ── Session auth ───────────────────────────────────────────────────────────
function getSessionSecret() {
  if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is required for session signing.");
  return crypto.createHmac("sha256", ADMIN_PASSWORD + ENCRYPTION_SALT)
    .update("nextiq-session-v1")
    .digest();
}

function createSessionToken(user) {
  const normalized = normalizeUser(user);
  const payload = Buffer.from(JSON.stringify({
    sub: normalized.id,
    name: normalized.username,
    role: normalized.role,
    permissions: normalized.permissions,
    exp: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expectedSig;
  try {
    expectedSig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  } catch {
    return null;
  }
  try {
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.sub || !data.exp || Math.floor(Date.now() / 1000) > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const result = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    result[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return result;
}

function getSessionFromRequest(req) {
  return verifySessionToken(parseCookies(req)[SESSION_COOKIE_NAME]);
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_EXPIRY_SECONDS}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  );
}

// ── Wieland SSO session (NCC JWT → short-lived cookie) ───────────────────────
function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { return null; }
}

function getWielandSessionSecret() {
  if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD required for Wieland sessions.");
  return crypto.createHmac("sha256", ADMIN_PASSWORD + ENCRYPTION_SALT)
    .update("nextiq-wieland-session-v1")
    .digest();
}

function createWielandSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.userId,
    name: user.username,
    tenant: user.tenantId,
    exp: Math.floor(Date.now() / 1000) + WIELAND_SESSION_EXPIRY_SECONDS
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", getWielandSessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyWielandSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expectedSig;
  try {
    expectedSig = crypto.createHmac("sha256", getWielandSessionSecret()).update(payload).digest("hex");
  } catch { return null; }
  try {
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) return null;
  } catch { return null; }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.sub || !data.exp || Math.floor(Date.now() / 1000) > data.exp) return null;
    return data;
  } catch { return null; }
}

function getWielandSessionFromRequest(req) {
  return verifyWielandSessionToken(parseCookies(req)[WIELAND_SESSION_COOKIE_NAME]);
}

// SameSite=None is required for cross-site iframes (NCC embeds our page)
function setWielandCookie(res, token) {
  res.setHeader("Set-Cookie",
    `${WIELAND_SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${WIELAND_SESSION_EXPIRY_SECONDS}`
  );
}

function clearWielandCookie(res) {
  res.setHeader("Set-Cookie",
    `${WIELAND_SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`
  );
}

function getWielandTokenFromHeader(req) {
  const auth = req.headers["authorization"] || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return verifyWielandSessionToken(token) ? token : null;
}

function isAuthorizedWieland(req) {
  return Boolean(getWielandSessionFromRequest(req))
    || Boolean(getWielandTokenFromHeader(req))
    || isAuthorizedAdmin(req);
}

function getWielandUser(req) {
  return getWielandSessionFromRequest(req)
    || (getWielandTokenFromHeader(req) ? verifyWielandSessionToken(getWielandTokenFromHeader(req)) : null);
}

async function handleWielandAuth(req, res, url) {
  const campaignParam = url.searchParams.get("campaign") || "";
  if (!campaignParam) {
    sendJson(res, 400, { error: "Missing ?campaign= parameter." });
    return;
  }

  let body;
  try { body = await readJson(req); } catch {
    sendJson(res, 400, { error: "Invalid JSON." }); return;
  }

  const nccToken = String(body.nccToken || "").trim();
  if (!nccToken) {
    sendJson(res, 400, { error: "nccToken is required." }); return;
  }

  // Find campaign to determine auth mode
  const campaigns = await readCampaigns();
  const campaign = campaigns.find(c => c.id === campaignParam);
  if (!campaign) {
    sendJson(res, 404, { error: `Campaign "${campaignParam}" not found.` }); return;
  }

  const campaignAuthType = campaign.wieland?.nccAuthType || "token";

  let userId, username, tenantId;

  if (campaignAuthType === "none") {
    // No NCC validation — accept any non-empty string as identity
    userId = nccToken.slice(0, 64);
    username = nccToken.slice(0, 64);
    tenantId = "";
  } else {
    // Expect a JWT for token/key modes
    const jwtPayload = decodeJwtPayload(nccToken);
    if (!jwtPayload) {
      sendJson(res, 401, { error: "Invalid token format. Paste your NCC session JWT (starts with eyJ…)." }); return;
    }
    if (jwtPayload.exp && Math.floor(Date.now() / 1000) > jwtPayload.exp) {
      sendJson(res, 401, { error: "NCC token has expired." }); return;
    }

    // For token mode: validate by calling NCC API with the user's JWT
    if (campaignAuthType === "token") {
      const nccBase = `https://${campaign.domain}/data/api/types`;
      try {
        const testRes = await fetch(`${nccBase}/contact?pageSize=1`, {
          headers: { "Authorization": `Bearer ${nccToken}` }
        });
        if (!testRes.ok) {
          sendJson(res, 401, { error: "NCC token is invalid or unauthorized." }); return;
        }
      } catch (err) {
        sendJson(res, 502, { error: "Could not verify token with NCC.", details: err.message }); return;
      }
    }
    // key mode: trust the JWT's own expiry

    userId = jwtPayload.sub || jwtPayload.userId || "ncc-user";
    username = jwtPayload.username || jwtPayload.sub || "ncc-user";
    tenantId = jwtPayload.tenantId || "";
  }

  // Create Wieland session
  const sessionToken = createWielandSessionToken({ userId, username, tenantId });
  setWielandCookie(res, sessionToken);
  // Also return the token in the body so the client can store it in sessionStorage
  // (fallback for browsers that block third-party cookies in iframes)
  sendJson(res, 200, { ok: true, sessionToken, user: { username, tenantId } });
}

async function handleWielandMe(req, res, url) {
  const ws = getWielandSessionFromRequest(req) || getWielandUser(req);
  if (ws) {
    sendJson(res, 200, { user: { username: ws.name || ws.username, tenantId: ws.tenant || ws.tenantId } });
    return;
  }
  if (isAuthorizedAdmin(req)) {
    const as = getSessionFromRequest(req);
    sendJson(res, 200, { user: { username: as?.name || "admin" } });
    return;
  }
  // If campaign uses nccAuthType=none, allow anonymous access
  const campaignParam = url.searchParams.get("campaign") || "";
  if (campaignParam) {
    const campaigns = await readCampaigns();
    const campaign = campaigns.find(c => c.id === campaignParam);
    if (campaign?.wieland?.nccAuthType === "none") {
      sendJson(res, 200, { user: { username: "guest" }, nccAuthType: "none" });
      return;
    }
  }
  sendJson(res, 401, { error: "Not authenticated." });
}
// ──────────────────────────────────────────────────────────────────────────

// ── User management ────────────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  let computed;
  try {
    computed = crypto.pbkdf2Sync(password, storedSalt, 100_000, 64, "sha512").toString("hex");
  } catch {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

async function readUsers() {
  const normalizeList = (users) => users.map(normalizeUser).filter((user) => user.id && user.username);
  if (firestore) {
    const snapshot = await firestore.collection(USERS_COLLECTION).get();
    return normalizeList(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }
  if (!fs.existsSync(USERS_FILE)) return [];
  const raw = fs.readFileSync(USERS_FILE, "utf8").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeList(parsed) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  if (firestore) {
    const existing = await firestore.collection(USERS_COLLECTION).get();
    const batch = firestore.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);
    for (const user of users) {
      const ref = firestore.collection(USERS_COLLECTION).doc(user.id);
      batch.set(ref, user);
    }
    await batch.commit();
    return;
  }
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function sanitizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._%+@-]/g, "");
}

function normalizeUserPermissions(value, role = "editor") {
  if (role === "admin") {
    return Object.fromEntries(CAMPAIGN_PERMISSIONS.map((permission) => [permission, true]));
  }

  const source = value && typeof value === "object" ? value : {};
  const hasExplicitPermissions = CAMPAIGN_PERMISSIONS.some((permission) => permission in source)
    || "create_campaign" in source
    || "edit_campaign" in source
    || "delete_campaign" in source;
  if (!hasExplicitPermissions) {
    return Object.fromEntries(CAMPAIGN_PERMISSIONS.map((permission) => [permission, true]));
  }

  return {
    createCampaign: Boolean(source.createCampaign || source.create_campaign),
    editCampaign: Boolean(source.editCampaign || source.edit_campaign),
    deleteCampaign: Boolean(source.deleteCampaign || source.delete_campaign)
  };
}

function normalizeUser(user) {
  const role = user?.role === "admin" ? "admin" : "editor";
  return {
    ...user,
    id: String(user?.id || user?.username || "").trim(),
    username: sanitizeUsername(user?.username || user?.id || ""),
    role,
    permissions: normalizeUserPermissions(user?.permissions, role)
  };
}

function publicUser(user) {
  const normalized = normalizeUser(user);
  return {
    id: normalized.id,
    username: normalized.username,
    role: normalized.role,
    permissions: normalized.permissions,
    createdAt: normalized.createdAt
  };
}

function hasAdminPermission(session, permission) {
  if (!session) return true; // Legacy ADMIN_PASSWORD access keeps full permissions.
  if (session.role === "admin") return true;
  return Boolean(normalizeUserPermissions(session.permissions, session.role)?.[permission]);
}

// ── Admin auth route handlers (public — no session required) ───────────────
async function handleAdminLogin(req, res) {
  let body;
  try { body = await readJson(req); } catch {
    sendJson(res, 400, { error: "Invalid JSON." });
    return;
  }
  const username = sanitizeUsername(body.username);
  const password = String(body.password || "");
  if (!username || !password) {
    sendJson(res, 400, { error: "Username and password are required." });
    return;
  }
  const users = await readUsers();
  if (!users.length) {
    sendJson(res, 403, { error: "No users configured. Complete the setup first." });
    return;
  }
  const user = users.find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    sendJson(res, 401, { error: "Invalid username or password." });
    return;
  }
  const token = createSessionToken(user);
  setSessionCookie(res, token);
  sendJson(res, 200, { ok: true, user: publicUser(user) });
}

function handleAdminLogout(res) {
  clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
}

function handleAdminMe(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) { sendJson(res, 401, { error: "Not authenticated." }); return; }
  sendJson(res, 200, {
    user: {
      id: session.sub,
      username: session.name,
      role: session.role,
      permissions: normalizeUserPermissions(session.permissions, session.role)
    }
  });
}

async function handleAdminSetupStatus(res) {
  try {
    const users = await readUsers();
    sendJson(res, 200, { needsSetup: users.length === 0 });
  } catch (err) {
    console.error("[setup-status] readUsers error:", err.message);
    // Fail safe: assume setup is done to avoid showing setup screen on Firestore timeout
    sendJson(res, 200, { needsSetup: false });
  }
}

async function handleAdminSetup(req, res) {
  const users = await readUsers();
  if (users.length > 0) {
    sendJson(res, 403, { error: "Setup already completed." });
    return;
  }
  let body;
  try { body = await readJson(req); } catch {
    sendJson(res, 400, { error: "Invalid JSON." });
    return;
  }
  const setupKey = String(body.setupKey || "").trim();
  if (!ADMIN_PASSWORD || setupKey !== ADMIN_PASSWORD) {
    sendJson(res, 401, { error: "Invalid setup key." });
    return;
  }
  const username = sanitizeUsername(body.username);
  const password = String(body.password || "");
  if (!username || username.length < 3) {
    sendJson(res, 400, { error: "Username must be at least 3 characters (letters, numbers, dots, hyphens, underscores)." });
    return;
  }
  if (!password || password.length < 8) {
    sendJson(res, 400, { error: "Password must be at least 8 characters." });
    return;
  }
  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: username,
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role: "admin",
    permissions: normalizeUserPermissions({}, "admin"),
    createdAt: new Date().toISOString()
  };
  await writeUsers([newUser]);
  const token = createSessionToken(newUser);
  setSessionCookie(res, token);
  sendJson(res, 200, { ok: true, user: publicUser(newUser) });
}
// ──────────────────────────────────────────────────────────────────────────

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

// ── Widget API token validation ───────────────────────────────────────────────
// If a campaign has `apiAccessToken` configured, requests to widget API routes
// must include Authorization: Bearer <token> matching that value.
const WIDGET_API_PATHS = new Set([
  "/api/config", "/api/workitem", "/api/tts", "/api/prediction",
  "/api/agent-next-step", "/api/questions-check", "/api/client-questions",
  "/api/ticket", "/api/agent-quality-board"
]);

async function checkWidgetApiToken(req, res, url) {
  if (!WIDGET_API_PATHS.has(url.pathname)) return true;
  const campaignId = url.searchParams.get("campaign") || "";
  if (!campaignId) return true; // no campaign = use default, no token enforced
  try {
    const campaigns = await readCampaigns();
    const campaign = campaigns.find(c => c.id === campaignId);
    const requiredToken = campaign?.apiAccessToken ? String(campaign.apiAccessToken).trim() : "";
    if (!requiredToken) return true; // not configured → no restriction
    const auth = req.headers["authorization"] || "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (provided !== requiredToken) {
      sendJson(res, 401, { error: "Unauthorized: invalid or missing API token." });
      return false;
    }
  } catch { /* readCampaigns error → allow through */ }
  return true;
}

async function handleRequest(req, res) {
  // Cloud Functions Gen2 may prepend /nextiq to the path — strip it
  const rawUrl = req.url.replace(/^\/nextiq(?=\/|$)/, "") || "/";
  const url = new URL(rawUrl, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, getHealthStatus());
    return;
  }

  if (!(await checkWidgetApiToken(req, res, url))) return;

  if (req.method === "GET" && url.pathname === "/api/config") {
    await handleConfig(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/workitem") {
    await handleWorkitem(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/questions-check") {
    await handleQuestionsCheck(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/client-questions") {
    await handleClientQuestions(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ticket") {
    await handleSaveTicket(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ticket") {
    await handleGetTicket(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/agent-next-step") {
    await handleAgentNextStep(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tts") {
    await handleTts(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/agent-quality-board") {
    await handleAgentQualityBoard(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/agent-chat/workitems") {
    await handleAgentChatWorkitems(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/agent-chat/workitem") {
    await handleAgentChatWorkitem(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/agent-chat/auth/login") {
    await handleAgentChatLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/agent-chat/auth/logout") {
    await handleAgentChatLogout(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/agent-chat/messages") {
    await handleAgentChatMessage(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/agent-chat/acd-status") {
    await handleAgentChatAcdStatus(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/prediction") {
    await handlePrediction(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/summaryagentic/summary") {
    await handleSummaryAgenticSummary(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/test-source") {
    await handleSummaryAgenticTestSource(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/analyze-url") {
    await handleSummaryAgenticAnalyzeUrl(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/suggest-fields") {
    await handleSummaryAgenticSuggestFields(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/widget-from-template") {
    await handleSummaryAgenticWidgetFromTemplate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/widget-from-chat") {
    await handleSummaryAgenticWidgetFromChat(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/save-widget") {
    await handleSummaryAgenticSaveWidget(req, res);
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/summaryagentic/save-widget") {
    await handleSummaryAgenticDeleteWidget(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/hubspot-test") {
    await handleSummaryAgenticHubspotTest(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/generate-layouts") {
    await handleSummaryAgenticGenerateLayouts(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/summaryagentic/warm") {
    await handleSummaryAgenticWarm(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/pulseforms/analyze-url") {
    await handlePulseFormsAnalyzeUrl(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/pulseforms/generate-layouts") {
    await handlePulseFormsGenerateLayouts(req, res);
    return;
  }

  // Public admin auth routes (no session required)
  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    await handleAdminLogin(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    handleAdminLogout(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/me") {
    handleAdminMe(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/setup-status") {
    await handleAdminSetupStatus(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/setup") {
    await handleAdminSetup(req, res);
    return;
  }

  if (url.pathname.startsWith("/api/admin/")) {
    await handleAdmin(req, res, url);
    return;
  }

  // Public Wieland auth routes (no session required)
  if (req.method === "POST" && url.pathname === "/api/wieland/auth") {
    await handleWielandAuth(req, res, url);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/wieland/me") {
    await handleWielandMe(req, res, url);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/wieland/logout") {
    clearWielandCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/wieland/")) {
    await handleWieland(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/thrio-data/")) {
    await handleThrioData(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/ncc-builder/")) {
    await handleNccCampaignBuilder(req, res, url);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  serveStatic(url.pathname, req.method === "HEAD", res);
}

const server = http.createServer(handleRequest);

async function handleConfig(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const config = await resolveCampaignConfigAsync(selection);
    const visibleTabs = normalizeWielandVisibleTabs(config.wieland?.visibleTabs || {});
    const listButtons = normalizeWielandListButtons(config.wieland?.listButtons || {});

    sendJson(res, 200, {
      configured: true,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        apiUrl: config.apiUrl,
        workitemApiUrl: config.workitemApiUrl,
        allowedKbIds: config.allowedKbIds,
        wieland: { visibleTabs, listButtons },
        ui: config.ui
      },
      request: {
        campaignId: config.id,
        domain: config.domain,
        kbIds: config.requestKbIds
      }
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 500;
    sendJson(res, status, { configured: false, error: error.message });
  }
}

async function handleWorkitem(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const workitemId = String(
      url.searchParams.get("workitemid")
      || url.searchParams.get("workitemId")
      || ""
    ).trim();

    if (!workitemId) {
      throwConfig('Missing workitem id. Provide ?workitemid=... in the URL.');
    }

    const config = applyTokenOverride(await resolveCampaignConfigAsync(selection), req);
    const workitemData = await fetchWorkitem(config, workitemId);

    sendJson(res, 200, {
      ok: true,
      workitemId,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        workitemApiUrl: config.workitemApiUrl,
        sentimentProvider: config.sentimentProvider,
        transcriptRefreshSeconds: config.transcriptRefreshSeconds,
        clientQuestionsRefreshSeconds: config.ui?.questions?.clientQuestionsRefreshSeconds,
        ui: config.ui
      },
      summary: summarizeWorkitem(workitemData),
      messages: await extractClientMessages(workitemData, config),
      transcript: extractChecklistMessages(workitemData)
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to reach workitem API",
      details: error.message
    });
  }
}

const TICKETS_COLLECTION = `${FIRESTORE_PREFIX}_tickets`;

async function handleSaveTicket(req, res, url) {
  try {
    const body = await readJson(req);
    const campaignId = String(body.campaign || url.searchParams?.get("campaign") || "").trim();
    const workitemId = String(body.workitemId || body.workitem_id || "").trim();
    if (!campaignId || !workitemId) throwConfig("Missing campaign or workitemId.");

    const docId = `${campaignId}_${workitemId}`;
    const data = {
      campaign: campaignId,
      workitemId,
      updatedAt: Date.now(),
      nombre: String(body.nombre || "").trim(),
      apellido: String(body.apellido || "").trim(),
      telefono: String(body.telefono || "").trim(),
      email: String(body.email || "").trim(),
      clienteId: String(body.clienteId || "").trim(),
      contrato: String(body.contrato || "").trim(),
      motivo: String(body.motivo || "").trim(),
      prioridad: String(body.prioridad || "").trim(),
      tipo: String(body.tipo || "").trim(),
      estado: String(body.estado || "").trim(),
      referencia: String(body.referencia || "").trim(),
      seguimiento: String(body.seguimiento || "").trim(),
      notas: String(body.notas || "").trim()
    };

    if (firestore) {
      await firestore.collection(TICKETS_COLLECTION).doc(docId).set(data, { merge: true });
    }

    sendJson(res, 200, { ok: true, docId });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 500;
    sendJson(res, status, { ok: false, error: error.message });
  }
}

async function handleGetTicket(req, res, url) {
  try {
    const campaignId = String(url.searchParams.get("campaign") || "").trim();
    const workitemId = String(url.searchParams.get("workitemid") || url.searchParams.get("workitemId") || "").trim();
    if (!campaignId || !workitemId) throwConfig("Missing campaign or workitemId.");

    const docId = `${campaignId}_${workitemId}`;
    let ticket = null;
    if (firestore) {
      const doc = await firestore.collection(TICKETS_COLLECTION).doc(docId).get();
      if (doc.exists) ticket = doc.data();
    }

    sendJson(res, 200, { ok: true, ticket });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 500;
    sendJson(res, status, { ok: false, error: error.message });
  }
}

async function handleClientQuestions(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const workitemId = String(
      url.searchParams.get("workitemid") || url.searchParams.get("workitemId") || ""
    ).trim();

    if (!workitemId) throwConfig("Missing workitem id.");

    const config = await resolveCampaignConfigAsync(selection);
    const workitemData = await fetchWorkitem(config, workitemId);
    const messages = extractChecklistMessages(workitemData);
    const clientMessages = messages.filter(m => m.role !== "agent");

    if (!clientMessages.length) {
      return sendJson(res, 200, { ok: true, workitemId, questions: [] });
    }

    const useGemini = config?.ui?.questions?.clientQuestionsUseGemini !== false;
    let questions;
    if (useGemini) {
      questions = await detectClientQuestionsWithGemini(clientMessages, config);
    } else {
      questions = detectClientQuestionsHeuristically(clientMessages);
    }

    sendJson(res, 200, { ok: true, workitemId, questions, updatedAt: Date.now() });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to detect client questions",
      details: status === 400 ? undefined : error.message
    });
  }
}

function detectClientQuestionsHeuristically(messages) {
  const QUESTION_WORDS = /\b(qué|que|cómo|como|cuándo|cuando|dónde|donde|cuánto|cuanto|cuál|cual|por qué|por que|puede|podría|podria|tienen|hay|existe|funciona|es posible|me puede|me podría|what|how|when|where|why|can|could|would|is there|do you)\b/i;
  const seen = new Set();
  const questions = [];
  messages.forEach(msg => {
    const sentences = msg.text.split(/(?<=[.!?])\s+|(?=\?)/);
    sentences.forEach(s => {
      const clean = s.trim().replace(/\?+$/, "").trim();
      if (!clean || clean.length < 8) return;
      const isQ = msg.text.includes("?") || QUESTION_WORDS.test(clean);
      if (isQ && !seen.has(clean)) {
        seen.add(clean);
        questions.push(clean + "?");
      }
    });
  });
  return questions.slice(0, 8);
}

async function detectClientQuestionsWithGemini(messages, config) {
  const apiKey = config.questionsGeminiApiKey || config.geminiApiKey;
  if (!apiKey) throwConfig(`Campaign "${config.id}" is missing a Gemini API key.`);

  const isSpanish = normalizeLanguage(config?.ui?.shared?.language || "en") === "es";
  const model = config.questionsGeminiModel || config.geminiModel || "gemini-2.5-flash";
  const endpoint = buildGeminiEndpoint(
    config.questionsGeminiApiUrl || config.geminiApiUrl || "https://generativelanguage.googleapis.com",
    model
  );

  const instruction = [
    "You analyze a call transcript and extract questions or doubts expressed by the client.",
    "Return strict JSON only: an array of strings, each being a clear question.",
    isSpanish
      ? "Write all questions in Spanish. Maximum 8 questions."
      : "Write all questions in English. Maximum 8 questions.",
    "Only include genuine questions or doubts from the client messages.",
    "If no questions are found, return an empty array [].",
    "Do not include agent messages.",
    "Make each question concise and self-contained (under 15 words)."
  ].join(" ");

  const body = {
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [{
      parts: [{
        text: JSON.stringify({
          task: "Extract client questions from the transcript.",
          messages: messages.map(m => ({ role: m.role, text: m.text }))
        })
      }]
    }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  };

  const upstream = await fetch(`${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await upstream.json();
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(q => typeof q === "string" && q.trim()).slice(0, 8) : [];
  } catch (_) {
    return [];
  }
}

async function handleQuestionsCheck(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const workitemId = String(
      url.searchParams.get("workitemid")
      || url.searchParams.get("workitemId")
      || ""
    ).trim();

    if (!workitemId) {
      throwConfig('Missing workitem id. Provide ?workitemid=... in the URL.');
    }

    const config = await resolveCampaignConfigAsync(selection);
    const questionsConfig = resolveQuestionsConfig(config);
    const questions = normalizeQuestionItems(questionsConfig.items || []);

    if (!questions.length) {
      throwConfig(`Campaign "${config.id}" is missing checklist questions.`);
    }

    const workitemData = await fetchWorkitem(config, workitemId);
    const messages = extractChecklistMessages(workitemData);
    const results = config?.ui?.questions?.useGemini === false
      ? analyzeChecklistHeuristically(messages, questions)
      : await analyzeChecklistWithGemini(messages, questions, config, questionsConfig);

    sendJson(res, 200, {
      ok: true,
      workitemId,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        ui: config.ui
      },
      summary: summarizeWorkitem(workitemData),
      questions: results,
      updatedAt: Date.now()
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to evaluate checklist",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentNextStep(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const workitemId = String(
      url.searchParams.get("workitemid")
      || url.searchParams.get("workitemId")
      || ""
    ).trim();

    if (!workitemId) {
      throwConfig('Missing workitem id. Provide ?workitemid=... in the URL.');
    }

    const config = await resolveCampaignConfigAsync(selection);
    const workitemData = await fetchWorkitem(config, workitemId);
    const transcriptMessages = extractChecklistMessages(workitemData);
    const clientMessages = await extractClientMessages(workitemData, config);
    const transcriptSignature = createTranscriptSignature(transcriptMessages);
    const nextStep = await buildAgentNextStep(transcriptMessages, config);
    const article = await fetchRecommendedArticle(config, nextStep.kbQuery || nextStep.actionTitle || nextStep.suggestedPhrase, workitemId);

    sendJson(res, 200, {
      ok: true,
      workitemId,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        ui: config.ui
      },
      summary: summarizeWorkitem(workitemData),
      nextStep,
      article,
      messages: clientMessages,
      transcriptSignature,
      transcriptCount: transcriptMessages.length,
      updatedAt: Date.now()
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to generate next step",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleTts(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const workitemId = String(
      url.searchParams.get("workitemid")
      || url.searchParams.get("workitemId")
      || ""
    ).trim();

    if (!workitemId) {
      sendJson(res, 400, { error: "Missing workitemid" });
      return;
    }

    const config = applyTokenOverride(await resolveCampaignConfigAsync(selection), req);
    const body = await readJson(req);
    const text = String(body.text || "").trim();
    const voiceName = String(body.voiceName || "").trim();

    if (!text) {
      sendJson(res, 400, { error: "Missing text" });
      return;
    }

    const ttsUrl = `https://${sanitizeDomain(config.domain)}/users/api/calls/${encodeURIComponent(workitemId)}/tts`;
    const headers = { "Authorization": config.token, "Content-Type": "application/json" };
    if (config.cookie) headers["Cookie"] = config.cookie;

    const ttsBody = { text };
    if (voiceName) ttsBody.voiceName = voiceName;
    const upstream = await fetch(ttsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(ttsBody)
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error(`[tts] Thrio ${upstream.status} | detail=${detail.slice(0,200)}`);
      sendJson(res, upstream.status, { error: `TTS upstream error ${upstream.status}`, detail });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, { error: status === 400 ? error.message : "TTS request failed", details: error.message });
  }
}

async function handleAgentQualityBoard(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const config = await resolveCampaignConfigAsync(selection);
    const limit = Math.max(1, Math.min(24, Number(url.searchParams.get("limit") || 12) || 12));
    const questionsConfig = resolveQuestionsConfig(config);
    const questions = normalizeQuestionItems(questionsConfig.items || []);
    const workitems = await fetchWorkitems(config);
    const ranked = rankWorkitemsForBoard(workitems).slice(0, limit);

    const agents = await Promise.all(ranked.map(async (workitem) => {
      const clientMessages = await extractClientMessages(workitem, config);
      const transcriptMessages = extractChecklistMessages(workitem);
      const summary = summarizeWorkitem(workitem);
      const sentiment = summarizeAgentSentiment(clientMessages);
      const checklist = questions.length
        ? (config?.ui?.questions?.useGemini === false
          ? analyzeChecklistHeuristically(transcriptMessages, questions)
          : await analyzeChecklistWithGemini(transcriptMessages, questions, config, questionsConfig))
        : [];
      const compliance = summarizeCompliance(checklist);
      const alerts = buildAgentAlerts(summary, sentiment, compliance);

      return {
        summary,
        sentiment,
        compliance,
        alerts,
        checklist,
        messageCount: clientMessages.length,
        updatedAt: latestWorkitemTimestamp(workitem)
      };
    }));

    sendJson(res, 200, {
      ok: true,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        ui: config.ui
      },
      overview: summarizeQualityBoard(agents),
      agents,
      updatedAt: Date.now()
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to build agent quality board",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentChatWorkitems(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const config = await resolveCampaignSelectionAsync(selection);
    const auth = readAgentChatAuth(req);
    const scopedConfig = buildAgentChatScopedConfig(config, auth);
    const workitems = await fetchWorkitems(scopedConfig);
    const ranked = rankWorkitemsForBoard(workitems);

    sendJson(res, 200, {
      ok: true,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        agentUserId: scopedConfig.agentUserId,
        ui: config.ui
      },
      workitems: ranked.map((workitem) => summarizeAgentChatWorkitem(workitem))
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to load workitems",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentChatWorkitem(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const workitemId = String(
      url.searchParams.get("workitemid")
      || url.searchParams.get("workitemId")
      || ""
    ).trim();

    if (!workitemId) {
      throwConfig('Missing workitem id. Provide ?workitemid=... in the URL.');
    }

    const config = await resolveCampaignSelectionAsync(selection);
    const auth = readAgentChatAuth(req);
    const scopedConfig = buildAgentChatScopedConfig(config, auth);
    const workitemData = await fetchWorkitem(scopedConfig, workitemId);

    sendJson(res, 200, {
      ok: true,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain,
        agentUserId: scopedConfig.agentUserId,
        ui: config.ui
      },
      summary: summarizeWorkitem(workitemData),
      messages: extractAgentChatMessages(workitemData)
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to load workitem conversation",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentChatLogin(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  try {
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      throwConfig("Username and password are required.");
    }

    const config = await resolveCampaignSelectionAsync({
      campaignId: body.campaignId || body.campaign || "",
      domain: body.domain || "",
      kbIds: []
    });

    const token = await fetchAgentChatUserToken(username, password);
    try {
      await loginAgentChatUser(config, token);
    } catch (error) {
      // Some tenants reject /users/api/login even with a valid token.
      // Keep sign-in working and let downstream endpoints use the token directly.
    }
    const agentUserId = inferAgentUserIdFromToken(token);

    sendJson(res, 200, {
      ok: true,
      token,
      agentUserId,
      campaign: {
        id: config.id,
        name: config.name,
        domain: config.domain
      }
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to authenticate user",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentChatLogout(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  try {
    const auth = readAgentChatAuth(req, body);
    const token = String(auth.token || "").trim();
    if (!token) {
      throwConfig("Missing user token.");
    }

    const config = await resolveCampaignSelectionAsync({
      campaignId: body.campaignId || body.campaign || "",
      domain: body.domain || "",
      kbIds: []
    });

    await logoutAgentChatUser(config, token);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to logout user",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentChatMessage(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  try {
    const workitemId = String(body.workitemId || body.workitemid || body.toId || "").trim();
    const text = String(body.textMsg || body.text || "").trim();

    if (!workitemId) {
      throwConfig("Missing workitem id.");
    }

    if (!text) {
      throwConfig("Message text is required.");
    }

    const config = await resolveCampaignSelectionAsync({
      campaignId: body.campaignId || body.campaign || "",
      domain: body.domain || "",
      kbIds: body.kb_ids || body.kbIds || []
    });

    const auth = readAgentChatAuth(req, body);
    const scopedConfig = buildAgentChatScopedConfig(config, auth);
    const fromId = String(body.fromId || scopedConfig.agentUserId || "").trim();
    if (!fromId) {
      throwConfig(`Campaign "${config.id}" is missing an agent user id.`);
    }

    const upstream = await sendAgentChatMessage(scopedConfig, {
      workitemId,
      fromId,
      text
    });

    const responseText = await upstream.text();
    let payload = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      payload = { raw: responseText };
    }

    if (!upstream.ok) {
      sendJson(res, 502, {
        error: "Failed to send message",
        details: payload?.error || responseText || `Upstream returned ${upstream.status}.`
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      sent: {
        workitemId,
        fromId,
        text
      },
      upstream: payload
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to send chat message",
      details: status === 400 ? undefined : error.message
    });
  }
}

async function handleAgentChatAcdStatus(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  try {
    const config = await resolveCampaignSelectionAsync({
      campaignId: body.campaignId || body.campaign || "",
      domain: body.domain || "",
      kbIds: []
    });

    const auth = readAgentChatAuth(req, body);
    const scopedConfig = buildAgentChatScopedConfig(config, auth);
    const enabled = parseBoolean(body.enabled, null);
    if (enabled === null) {
      throwConfig("Missing ACD status.");
    }

    const payload = buildAcdStatusPayload(scopedConfig, enabled);

    const upstream = await fetch(`https://${sanitizeDomain(scopedConfig.domain)}/users/api/acd/login`, {
      method: "POST",
      headers: {
        "Authorization": scopedConfig.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await upstream.text();
    let responseBody = {};
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      responseBody = { raw: responseText };
    }

    if (!upstream.ok) {
      sendJson(res, 502, {
        error: "Failed to update ACD status",
        details: responseBody?.error || responseText || `Upstream returned ${upstream.status}.`
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      enabled,
      payload,
      upstream: responseBody
    });
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to update ACD status",
      details: status === 400 ? undefined : error.message
    });
  }
}

function readAgentChatAuth(req, body) {
  return {
    token: String(
      req.headers["x-agent-chat-token"]
      || req.headers["x-agent-token"]
      || body?.token
      || body?.authToken
      || ""
    ).trim(),
    agentUserId: String(
      req.headers["x-agent-user-id"]
      || body?.agentUserId
      || body?.agent_user_id
      || ""
    ).trim()
  };
}

function buildAgentChatScopedConfig(config, auth) {
  const token = String(auth?.token || "").trim();
  if (!token) {
    throwConfig("Missing user token. Sign in again.");
  }

  const agentUserId = String(auth?.agentUserId || "").trim()
    || inferAgentUserIdFromToken(token)
    || String(config.agentUserId || "").trim();

  return {
    ...config,
    token,
    agentUserId
  };
}

function buildAcdStatusPayload(config, enabled) {
  const configuredPayload = enabled ? config?.acdEnabledPayload : config?.acdDisabledPayload;
  if (configuredPayload && typeof configuredPayload === "object") {
    return configuredPayload;
  }

  const enabledStatusId = String(
    config?.acdEnabledStatusId
    || config?.acd?.enabledStatusId
    || ""
  ).trim();
  const disabledStatusId = String(
    config?.acdDisabledStatusId
    || config?.acd?.disabledStatusId
    || ""
  ).trim();
  const enabledStatusCode = parseInteger(config?.acdEnabledStatusCode ?? config?.acd?.enabledStatusCode, 0);
  const disabledStatusCode = parseInteger(config?.acdDisabledStatusCode ?? config?.acd?.disabledStatusCode, 3);
  const statusId = enabled ? enabledStatusId : disabledStatusId;
  const status = enabled ? enabledStatusCode : disabledStatusCode;

  if (!statusId) {
    throwConfig(`Campaign "${config?.id || "unknown"}" is missing ACD status IDs. Configure acdEnabledStatusId and acdDisabledStatusId in admin.`);
  }

  return { statusId, status };
}

async function handlePrediction(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  try {
    const config = applyTokenOverride(await resolveCampaignConfigAsync({
      campaignId: body.campaignId || body.campaign || "",
      domain: body.domain || "",
      kbIds: body.kb_ids || body.kbIds || []
    }), req);

    const upstream = await fetchPredictionUpstream(config, {
      message: body.message || "",
      workitem_id: body.workitem_id || ""
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
    });
    res.end(text);
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to reach prediction API",
      details: status === 400 ? undefined : error.message
    });
  }
}

// ── Summary Agentic ───────────────────────────────────────────────────────────
const SUMMARY_CACHE_COLLECTION = `${FIRESTORE_PREFIX}_summary_cache`;

function normalizeCacheId(value) {
  // Strip all non-alphanumeric chars so +34672420697, 34672420697, " 34672420697" all map to the same key
  return String(value || "").replace(/[^a-zA-Z0-9]/g, "");
}

async function getCachedSummary(cacheKey) {
  if (!firestore) return null;
  try {
    const doc = await firestore.collection(SUMMARY_CACHE_COLLECTION).doc(cacheKey).get();
    if (!doc.exists) return null;
    const entry = doc.data();
    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  } catch (err) {
    console.error("[summary-cache] read error:", err.message);
    return null;
  }
}

async function setCachedSummary(cacheKey, data, ttlMs) {
  if (!firestore || ttlMs <= 0) return;
  try {
    await firestore.collection(SUMMARY_CACHE_COLLECTION).doc(cacheKey).set({
      data,
      expiresAt: Date.now() + ttlMs,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error("[summary-cache] write error:", err.message);
  }
}

// ── Core summary generation (shared by /summary and /warm) ───────────────────
async function generateSummaryData(config, identifiers, extraParams) {
  const saConfig = config.summaryagentic || {};
  const { phone = "", customerId = "" } = identifiers;
  const enabledSources = (saConfig.dataSources || []).filter((s) => s.enabled && s.url);

  // Fetch custom data sources + HubSpot in parallel
  const hubspotCfg = saConfig.hubspot || {};
  const hubspotToken = config.summaryagenticHubspotToken || "";
  const hubspotEnabled = hubspotCfg.enabled && hubspotToken && hubspotCfg.objects?.length;

  const [sourceResults, hubspotResult] = await Promise.all([
    Promise.allSettled(enabledSources.map((source) => fetchSummaryDataSource(source, identifiers))),
    hubspotEnabled
      ? fetchHubspotData(hubspotToken, hubspotCfg.objects, identifiers).catch((err) => ({ __error: err.message }))
      : Promise.resolve(null)
  ]);

  const sourceData = enabledSources.map((source, i) => {
    const result = sourceResults[i];
    if (result.status === "fulfilled") {
      const rawData = result.value;
      const filtered = source.selectedFields?.length
        ? filterBySelectedFields(rawData, source.selectedFields)
        : rawData;
      return { id: source.id, name: source.name, data: filtered, error: null };
    }
    return { id: source.id, name: source.name, data: null, error: result.reason?.message || "Failed" };
  });

  if (hubspotEnabled) {
    if (hubspotResult?.__error) {
      console.error("[summaryagentic] HubSpot fetch error:", hubspotResult.__error);
      sourceData.push({ id: "hubspot", name: "HubSpot", data: null, error: hubspotResult.__error });
    } else if (Array.isArray(hubspotResult)) {
      sourceData.push(...hubspotResult);
    }
  }

  const aiProvider = saConfig.aiProvider || "claude";
  const aiApiKey = config.summaryagenticAiApiKey || "";
  const aiModel = saConfig.aiModel || defaultAiModel(aiProvider);
  const aiPrompt = saConfig.aiPrompt || defaultSummaryPrompt();

  if (!aiApiKey) throwConfig(`Campaign "${config.id}" is missing the AI API key for Summary Agentic.`);

  console.log("[summaryagentic] building context, sourceData count:", sourceData.length);
  const contextText = buildSummaryContext(identifiers, sourceData, enabledSources);
  console.log("[summaryagentic] context chars:", contextText.length);

  let rawText;
  const activeLayout = saConfig.activeLayout;
  console.log("[summaryagentic] calling AI, provider:", aiProvider, "model:", aiModel, "activeLayout:", !!activeLayout?.sections?.length);
  if (activeLayout?.sections?.length) {
    rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, buildLayoutFillPrompt(activeLayout.sections), contextText);
  } else {
    rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, aiPrompt, contextText);
  }
  console.log("[summaryagentic] AI response chars:", rawText.length, "tail:", rawText.slice(-100));
  const sections = parseSummarySections(rawText);
  console.log("[summaryagentic] parsed sections:", sections ? sections.length : null);

  const responseData = {
    ok: true,
    campaign: { id: config.id, name: config.name },
    identifiers,
    sections,
    summary: rawText,
    sources: sourceData.map((s) => ({ id: s.id, name: s.name, ok: !s.error, error: s.error })),
    generatedAt: Date.now()
  };

  // Store in Firestore cache
  const extraKey = Object.entries(extraParams || {}).sort().map(([k,v]) => `${k}=${v}`).join("&");
  const cacheKey = `${config.id}:${normalizeCacheId(phone || customerId)}${extraKey ? "_" + extraKey.replace(/[^a-zA-Z0-9_-]/g, "_") : ""}`;
  const cacheTtl = (saConfig.cacheSeconds || 60) * 1000;
  await setCachedSummary(cacheKey, responseData, cacheTtl);

  return { responseData, cacheKey };
}

async function handleSummaryAgenticSummary(req, res, url) {
  try {
    const selection = readSelection(url.searchParams);
    const phone = String(url.searchParams.get("phone") || "").trim();
    const customerId = String(url.searchParams.get("customer_id") || url.searchParams.get("customerId") || "").trim();

    if (!phone && !customerId) {
      throwConfig("Missing identifier. Provide ?phone= or ?customer_id= in the URL.");
    }

    // Collect ALL extra URL params — they become template variables in data source URLs/bodies
    const RESERVED = new Set(["campaign", "domain", "kb_id", "kb_ids", "phone", "customer_id", "customerId", "embed"]);
    const extraParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (!RESERVED.has(key)) extraParams[key] = value;
    }

    const config = await resolveCampaignConfigAsync(selection);
    const saConfig = config.summaryagentic || {};

    if (!saConfig.enabled) {
      throwConfig(`Summary Agentic is not enabled for campaign "${config.id}".`);
    }

    // Check Firestore cache
    const extraKey = Object.entries(extraParams).sort().map(([k,v]) => `${k}=${v}`).join("&");
    const cacheKey = `${config.id}:${normalizeCacheId(phone || customerId)}${extraKey ? "_" + extraKey.replace(/[^a-zA-Z0-9_-]/g, "_") : ""}`;
    const cached = await getCachedSummary(cacheKey);
    if (cached) {
      sendJson(res, 200, { ...cached, fromCache: true });
      return;
    }

    const identifiers = { phone, customerId, ...extraParams };
    const { responseData } = await generateSummaryData(config, identifiers, extraParams);
    sendJson(res, 200, responseData);
  } catch (error) {
    const status = error.code === "CONFIG" ? 400 : 502;
    sendJson(res, status, {
      error: status === 400 ? error.message : "Failed to generate summary",
      details: status === 400 ? undefined : error.message
    });
  }
}

// ── Warm endpoint: pre-generate summary before agent opens widget ─────────────
async function handleSummaryAgenticWarm(req, res) {
  try {
    const body = await readJson(req);
    const campaignId = String(body.campaign || body.campaignId || "").trim();
    const phone = String(body.phone || "").trim();
    const customerId = String(body.customer_id || body.customerId || "").trim();
    const token = String(body.token || "").trim();

    if (!campaignId) return sendJson(res, 400, { error: "Missing campaign" });
    if (!phone && !customerId) return sendJson(res, 400, { error: "Missing phone or customer_id" });

    const config = await resolveCampaignConfigAsync({ campaignId });
    const saConfig = config.summaryagentic || {};

    if (!saConfig.enabled) return sendJson(res, 400, { error: "Summary Agentic not enabled" });

    // Validate warm token
    const warmToken = config.summaryagenticWarmToken || "";
    if (!warmToken || token !== warmToken) {
      return sendJson(res, 401, { error: "Invalid warm token" });
    }

    // Check if already cached — nothing to do
    const cacheKey = `${config.id}:${normalizeCacheId(phone || customerId)}`;
    const cached = await getCachedSummary(cacheKey);
    if (cached) {
      return sendJson(res, 200, { ok: true, status: "already_cached" });
    }

    // Generate and cache — wait for completion so Cloud Function doesn't kill the task
    const identifiers = { phone, customerId };
    try {
      await generateSummaryData(config, identifiers, {});
      sendJson(res, 200, { ok: true, status: "warmed" });
    } catch (err) {
      console.error("[summaryagentic:warm] generation error:", err.message);
      sendJson(res, 500, { ok: false, error: err.message });
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleSummaryAgenticTestSource(req, res) {
  try {
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    // Validate session — test-source requires admin auth
    const session = getSessionFromRequest(req);
    if (!session) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const { url: sourceUrl, method = "GET", headersJson = "{}", bodyTemplate = "", testPhone = "1234567890", testCustomerId = "", extraParams = {} } = body;
    if (!sourceUrl) {
      sendJson(res, 400, { error: "url is required" });
      return;
    }

    try {
      JSON.parse(headersJson || "{}");
    } catch {
      sendJson(res, 400, { error: "headersJson is not valid JSON" });
      return;
    }

    const identifiers = { phone: testPhone, customerId: testCustomerId, ...extraParams };
    const source = { url: sourceUrl, method, headersJson, bodyTemplate };

    const data = await fetchSummaryDataSource(source, identifiers);
    const fields = flattenObjectKeys(data);

    sendJson(res, 200, { ok: true, data, fields });
  } catch (error) {
    sendJson(res, 502, { error: "Source test failed", details: error.message });
  }
}

async function handleSummaryAgenticSuggestFields(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { data, sourceName = "Data source", description = "", campaignId } = body;
    if (!data) { sendJson(res, 400, { error: "data is required" }); return; }

    // Load campaign AI config
    let aiProvider = "claude", aiApiKey = "", aiModel = "";
    if (campaignId) {
      try {
        const campaigns = await getEffectiveCampaigns();
        const config = campaigns.find((c) => c.id === campaignId);
        if (config) {
          aiProvider = config.summaryagentic?.aiProvider || "claude";
          aiApiKey   = config.summaryagenticAiApiKey || "";
          aiModel    = config.summaryagentic?.aiModel || "";
        }
      } catch { /* ignore */ }
    }

    if (!aiApiKey) {
      sendJson(res, 400, { error: "No AI API key configured for this campaign." });
      return;
    }

    const systemPrompt = `You are a UX analyst for a call center agent dashboard. Analyze the provided JSON data from an API and suggest which fields would be most useful to display to an agent before answering a customer call.

Return ONLY a valid JSON object with this structure:
{
  "suggestions": [
    {
      "id": "unique_snake_case_id",
      "title": "Section display title",
      "icon": "single emoji",
      "type": "kv|calllog|caselist|flags|recommendation",
      "placement": "left|right",
      "rationale": "1 sentence explaining why this section is useful for an agent",
      "fields": ["field.path", "field.path2"],
      "preview": [
        { "label": "Field label", "value": "example value from the data" }
      ]
    }
  ]
}

Rules:
- type "kv" → for profile/account data (key-value pairs), placement "left"
- type "calllog" → for call/interaction history lists, placement "right"
- type "caselist" → for open tickets/cases, placement "right"
- type "flags" → for risk indicators, anomalies, or important alerts, placement "left"
- type "recommendation" → one actionable suggestion for the agent, placement "right"
- Only suggest sections for which real data exists
- For preview, use actual values from the data (max 4 items)
- Focus on actionable information the agent needs right now
- Return 2-5 suggestions maximum`;

    const userMsg = `Source name: ${sourceName}${description ? `\nDescription: ${description}` : ""}

Data sample:
${JSON.stringify(truncateSourceData(data, 5), null, 2)}`;

    let rawText;
    try {
      rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, systemPrompt, userMsg);
    } catch (err) {
      sendJson(res, 502, { error: `AI call failed: ${err.message}` });
      return;
    }

    let suggestions;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      suggestions = parsed.suggestions || [];
    } catch {
      sendJson(res, 502, { error: "AI returned invalid JSON", raw: rawText.slice(0, 300) });
      return;
    }

    sendJson(res, 200, { ok: true, suggestions });
  } catch (error) {
    sendJson(res, 500, { error: `Suggest fields failed: ${error.message}` });
  }
}

async function handleSummaryAgenticWidgetFromTemplate(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { templateId, data, sourceName = "Data source", description = "", campaignId } = body;
    if (!templateId) { sendJson(res, 400, { error: "templateId is required" }); return; }
    if (!data) { sendJson(res, 400, { error: "data is required" }); return; }

    const WIDGET_TEMPLATES = {
      profile_kv:     { title: "Customer Profile",       icon: "👤", type: "kv",             placement: "left",  hint: "Extract name, phone, email, address and any account identifiers" },
      recent_calls:   { title: "Recent Calls",            icon: "📞", type: "calllog",        placement: "right", hint: "Extract call history: date, reason/queue, agent, duration, status" },
      metrics:        { title: "Quick Metrics",           icon: "📊", type: "kv",             placement: "left",  hint: "Extract numeric counters: total calls, inbound, outbound, SMS, chats, today/week/month counts" },
      open_cases:     { title: "Open Cases",              icon: "📋", type: "caselist",       placement: "right", hint: "Extract open tickets or cases: id, status, description" },
      risk_flags:     { title: "Risk Indicators",         icon: "🚩", type: "flags",          placement: "left",  hint: "Identify patterns suggesting risk: complaints, escalations, SLA breach, frequent contacts" },
      notes:          { title: "Customer Notes",          icon: "📝", type: "text",           placement: "right", hint: "Extract any free-text notes, comments or observations about the customer" },
      recommendation: { title: "Agent Recommendation",   icon: "💡", type: "recommendation", placement: "right", hint: "Write one actionable recommendation for the agent based on all data" },
      subscriptions:  { title: "Subscriptions",          icon: "💳", type: "kv",             placement: "left",  hint: "Extract active products, plans, subscriptions or services" },
    };

    const template = WIDGET_TEMPLATES[templateId];
    if (!template) { sendJson(res, 400, { error: `Unknown templateId: ${templateId}` }); return; }

    // Load campaign AI config
    let aiProvider = "claude", aiApiKey = "", aiModel = "";
    if (campaignId) {
      try {
        const campaigns = await getEffectiveCampaigns();
        const config = campaigns.find((c) => c.id === campaignId);
        if (config) {
          aiProvider = config.summaryagentic?.aiProvider || "claude";
          aiApiKey   = config.summaryagenticAiApiKey || "";
          aiModel    = config.summaryagentic?.aiModel || "";
        }
      } catch { /* ignore */ }
    }

    if (!aiApiKey) {
      sendJson(res, 400, { error: "No AI API key configured for this campaign." });
      return;
    }

    const prompt = `Given this data sample from source '${sourceName}'${description ? ": " + description : ""}, generate a '${template.title}' section (${template.type} type). ${template.hint}. Return ONLY a JSON object with fields: id (snake_case), title, icon, type, placement, rationale (1 sentence), fields (array of field paths used), preview (array of {label, value} from real data, max 4 items)

Data sample:
${JSON.stringify(truncateSourceData(data, 5), null, 2)}`;

    let rawText;
    try {
      rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, "You are a widget designer for a call center agent dashboard. Return ONLY valid JSON, no markdown.", prompt);
    } catch (err) {
      sendJson(res, 502, { error: `AI call failed: ${err.message}` });
      return;
    }

    let suggestion;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      suggestion = JSON.parse(cleaned);
    } catch {
      sendJson(res, 502, { error: "AI returned invalid JSON", raw: rawText.slice(0, 300) });
      return;
    }

    sendJson(res, 200, { ok: true, suggestion });
  } catch (error) {
    sendJson(res, 500, { error: `Widget from template failed: ${error.message}` });
  }
}

async function handleSummaryAgenticWidgetFromChat(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { message, data, sourceName = "Data source", description = "", campaignId } = body;
    if (!message) { sendJson(res, 400, { error: "message is required" }); return; }
    if (!data) { sendJson(res, 400, { error: "data is required" }); return; }

    // Load campaign AI config
    let aiProvider = "claude", aiApiKey = "", aiModel = "";
    if (campaignId) {
      try {
        const campaigns = await getEffectiveCampaigns();
        const config = campaigns.find((c) => c.id === campaignId);
        if (config) {
          aiProvider = config.summaryagentic?.aiProvider || "claude";
          aiApiKey   = config.summaryagenticAiApiKey || "";
          aiModel    = config.summaryagentic?.aiModel || "";
        }
      } catch { /* ignore */ }
    }

    if (!aiApiKey) {
      sendJson(res, 400, { error: "No AI API key configured for this campaign." });
      return;
    }

    const systemPrompt = `You are a widget designer for a call center dashboard. The user wants to add a custom visual section to their agent summary widget. Given a data sample, create the section they describe. Return ONLY JSON: { id, title, icon, type (kv|calllog|caselist|flags|recommendation|text), placement (left|right), rationale, fields, preview [{label, value}] }`;

    const userMsg = `Data source: '${sourceName}'${description ? " — " + description : ""}

Data sample:
${JSON.stringify(truncateSourceData(data, 5), null, 2)}

User request: ${message}`;

    let rawText;
    try {
      rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, systemPrompt, userMsg);
    } catch (err) {
      sendJson(res, 502, { error: `AI call failed: ${err.message}` });
      return;
    }

    let suggestion;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      suggestion = JSON.parse(cleaned);
    } catch {
      sendJson(res, 502, { error: "AI returned invalid JSON", raw: rawText.slice(0, 300) });
      return;
    }

    sendJson(res, 200, { ok: true, suggestion });
  } catch (error) {
    sendJson(res, 500, { error: `Widget from chat failed: ${error.message}` });
  }
}

async function handleSummaryAgenticSaveWidget(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { campaignId, widget } = body;
    if (!campaignId) { sendJson(res, 400, { error: "campaignId is required" }); return; }
    if (!widget || !widget.id) { sendJson(res, 400, { error: "widget with id is required" }); return; }

    const campaigns = await readCampaigns();
    const idx = campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) { sendJson(res, 404, { error: "Campaign not found" }); return; }

    const campaign = campaigns[idx];
    if (!campaign.summaryagentic) campaign.summaryagentic = {};
    if (!Array.isArray(campaign.summaryagentic.widgetLibrary)) campaign.summaryagentic.widgetLibrary = [];

    // Dedup by id
    campaign.summaryagentic.widgetLibrary = campaign.summaryagentic.widgetLibrary.filter((w) => w.id !== widget.id);
    campaign.summaryagentic.widgetLibrary.push(widget);

    await writeCampaigns(campaigns);

    sendJson(res, 200, { ok: true, library: campaign.summaryagentic.widgetLibrary });
  } catch (error) {
    sendJson(res, 500, { error: `Save widget failed: ${error.message}` });
  }
}

async function handleSummaryAgenticDeleteWidget(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { campaignId, widgetId } = body;
    if (!campaignId) { sendJson(res, 400, { error: "campaignId is required" }); return; }
    if (!widgetId) { sendJson(res, 400, { error: "widgetId is required" }); return; }

    const campaigns = await readCampaigns();
    const idx = campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) { sendJson(res, 404, { error: "Campaign not found" }); return; }

    const campaign = campaigns[idx];
    if (!campaign.summaryagentic) campaign.summaryagentic = {};
    if (!Array.isArray(campaign.summaryagentic.widgetLibrary)) campaign.summaryagentic.widgetLibrary = [];

    campaign.summaryagentic.widgetLibrary = campaign.summaryagentic.widgetLibrary.filter((w) => w.id !== widgetId);

    await writeCampaigns(campaigns);

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { error: `Delete widget failed: ${error.message}` });
  }
}

// ── HubSpot integration ───────────────────────────────────────────────────────

async function handleSummaryAgenticHubspotTest(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }
    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }
    const token = String(body.token || "").trim();
    if (!token) { sendJson(res, 400, { error: "token is required" }); return; }
    const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      sendJson(res, 200, { ok: false, error: err.message || `HTTP ${r.status}` });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function fetchHubspotData(token, selectedObjects, identifiers) {
  const authHeader = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  async function hs(method, path, body = null) {
    const opts = { method, headers: authHeader };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`https://api.hubapi.com${path}`, opts);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `HubSpot ${path} → HTTP ${r.status}`);
    }
    return r.json();
  }

  // 1. Find contact by phone (strip non-digits for flexible match)
  const phone = (identifiers.phone || "").replace(/[^0-9+]/g, "");
  const customerId = identifiers.customerId || "";
  if (!phone && !customerId) throw new Error("No phone or customer_id to search HubSpot.");

  console.log("[hubspot] searching contact phone:", phone, "customerId:", customerId);

  // Build phone format variants (max 5 filterGroups allowed by HubSpot)
  const digits = phone.replace(/\D/g, "");
  const phoneVariants = new Set([phone]);
  if (digits.length >= 9) {
    if (!digits.startsWith("+")) phoneVariants.add(`+${digits}`);
    if (digits.length === 9)  phoneVariants.add(`+34${digits}`);  // Spain local → E.164
    if (digits.startsWith("34") && digits.length === 11) phoneVariants.add(`+${digits.slice(2)}`); // strip country code
    if (digits.length === 10) phoneVariants.add(`+1${digits}`);   // US local → E.164
  }
  // HubSpot API allows max 5 filterGroups; each variant gets one group checking phone OR mobilephone
  const variantList = [...phoneVariants].slice(0, 5);
  const filterGroups = variantList.map((v) => ({
    filters: [
      { propertyName: "phone",       operator: "EQ", value: v },
    ]
  }));
  // Use a second search for mobilephone if needed
  const filterGroupsMobile = variantList.slice(0, 5).map((v) => ({
    filters: [{ propertyName: "mobilephone", operator: "EQ", value: v }]
  }));

  console.log("[hubspot] trying variants:", variantList.join(", "));

  let searchResult = await hs("POST", "/crm/v3/objects/contacts/search", {
    filterGroups,
    properties: ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hs_lead_status","lifecyclestage","createdate","lastmodifieddate","city","country"],
    limit: 1
  });
  // If not found on phone field, try mobilephone
  if (!searchResult.results?.length) {
    searchResult = await hs("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: filterGroupsMobile,
      properties: ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hs_lead_status","lifecyclestage","createdate","lastmodifieddate","city","country"],
      limit: 1
    });
  }

  console.log("[hubspot] search results total:", searchResult.total, "found:", searchResult.results?.length);

  const contact = searchResult.results?.[0];
  if (!contact) {
    console.log("[hubspot] no contact found — phone variants:", [...phoneVariants].join(", "));
    return [];
  }
  console.log("[hubspot] found contact id:", contact.id, "phone:", contact.properties?.phone);

  const contactId = contact.id;
  const sources = [];

  if (selectedObjects.includes("contacts")) {
    sources.push({ id: "hubspot_contact", name: "HubSpot Contact", data: contact.properties, error: null });
  }

  async function getAssocIds(type) {
    const r = await hs("GET", `/crm/v3/objects/contacts/${contactId}/associations/${type}`);
    const ids = (r.results || []).slice(0, 10).map((x) => ({ id: String(x.id) }));
    console.log(`[hubspot] associations ${type}:`, ids.length, ids.map(x => x.id).join(","));
    return ids;
  }

  async function batchRead(type, inputs, properties) {
    if (!inputs.length) return [];
    const propsParam = properties.join(",");
    const results = await Promise.allSettled(
      inputs.map(({ id }) => hs("GET", `/crm/v3/objects/${type}/${id}?properties=${propsParam}`))
    );
    const data = results.filter((r) => r.status === "fulfilled").map((r) => r.value.properties);
    console.log(`[hubspot] GET ${type}: ${data.length} records`);
    return data;
  }

  const tasks = [];

  if (selectedObjects.includes("deals")) {
    tasks.push(async () => {
      const ids = await getAssocIds("deals");
      const data = await batchRead("deals", ids, ["dealname","amount","dealstage","closedate","pipeline","hs_deal_stage_probability","createdate"]);
      sources.push({ id: "hubspot_deals", name: "HubSpot Deals", data, error: null });
    });
  }

  if (selectedObjects.includes("tickets")) {
    tasks.push(async () => {
      const ids = await getAssocIds("tickets");
      const data = await batchRead("tickets", ids, ["subject","content","hs_ticket_status","hs_pipeline_stage","createdate","hs_lastmodifieddate"]);
      sources.push({ id: "hubspot_tickets", name: "HubSpot Tickets", data, error: null });
    });
  }

  if (selectedObjects.includes("calls")) {
    tasks.push(async () => {
      const ids = await getAssocIds("calls");
      const data = await batchRead("calls", ids, ["hs_call_title","hs_call_direction","hs_call_duration","hs_call_status","hs_timestamp","hs_call_body","hs_call_disposition"]);
      sources.push({ id: "hubspot_calls", name: "HubSpot Calls", data, error: null });
    });
  }

  if (selectedObjects.includes("notes")) {
    tasks.push(async () => {
      const ids = await getAssocIds("notes");
      const data = await batchRead("notes", ids, ["hs_note_body","hs_timestamp","hs_lastmodifieddate"]);
      sources.push({ id: "hubspot_notes", name: "HubSpot Notes", data, error: null });
    });
  }

  const results = await Promise.allSettled(tasks.map((t) => t()));
  results.forEach((r) => {
    if (r.status === "rejected") {
      console.error("[hubspot] task error:", r.reason?.message);
    }
  });

  return sources;
}

// ── Layout generation ─────────────────────────────────────────────────────────

function buildLayoutFillPrompt(sections) {
  const schema = sections.map((s) =>
    `${s.id}|${s.title}|${s.icon||"📄"}|${s.type}|${s.placement}|fields:${(s.fields||[]).join(",")}`
  ).join("\n");
  return `You are a call center agent assistant. Fill the following widget sections with real data from the sources. Return ONLY compact JSON, no markdown.

Sections to fill (id|title|icon|type|placement|fields):
${schema}

Output format:
{"sections":[{"id":"...","title":"...","icon":"...","type":"...","placement":"...","items":[...]},{"id":"agent_recommendation","title":"Recommended Action","icon":"💡","type":"recommendation","placement":"right","items":[{"content":"..."}]}]}

Item formats by type:
kv: {"label":"...","value":"...","highlight":"green|red|yellow|blue"}
calllog: {"reason":"...","date":"...","agent":"...","duration":"...","status":"..."}
caselist: {"id":"...","status":"...","description":"..."}
flags: {"type":"escalation|vip|warning|info","message":"..."}
recommendation: {"content":"..."}

Rules: keep ALL sections from schema (add items:[] if no data). Last section MUST be agent_recommendation synthesizing ALL sources into a specific actionable briefing for the agent.`;
}

async function handleSummaryAgenticGenerateLayouts(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { campaignId, testPhone, testCustomerId } = body;
    if (!campaignId) { sendJson(res, 400, { error: "campaignId is required" }); return; }

    const campaigns = await getEffectiveCampaigns();
    const config = campaigns.find((c) => c.id === campaignId);
    if (!config) { sendJson(res, 404, { error: "Campaign not found" }); return; }

    const saConfig = config.summaryagentic || {};
    const aiProvider = saConfig.aiProvider || "claude";
    const aiApiKey = config.summaryagenticAiApiKey || "";
    const aiModel = saConfig.aiModel || defaultAiModel(aiProvider);
    if (!aiApiKey) { sendJson(res, 400, { error: "No AI API key configured" }); return; }

    // Fetch real data from all sources
    const phone = testPhone || "";
    const customerId = testCustomerId || "";
    const identifiers = { phone, customerId };
    const enabledSources = (saConfig.dataSources || []).filter((s) => s.enabled && s.url);

    const sourceResults = await Promise.allSettled(
      enabledSources.map((src) => fetchSummaryDataSource(src, identifiers))
    );
    const sourceData = enabledSources.map((src, i) => {
      const r = sourceResults[i];
      return r.status === "fulfilled"
        ? { id: src.id, name: src.name, data: r.value, error: null }
        : { id: src.id, name: src.name, data: null, error: r.reason?.message };
    });

    // HubSpot
    const hubspotToken = config.summaryagenticHubspotToken || "";
    if (saConfig.hubspot?.enabled && hubspotToken && phone) {
      try {
        const hsSources = await fetchHubspotData(hubspotToken, saConfig.hubspot.objects || [], identifiers);
        sourceData.push(...hsSources);
      } catch (err) {
        sourceData.push({ id: "hubspot", name: "HubSpot", data: null, error: err.message });
      }
    }

    // Use only a small sample for layout generation — we only need structure, not full data
    const sampleData = sourceData.map((s) => ({
      id: s.id, name: s.name, error: s.error,
      data: s.data ? truncateSourceData(s.data, 2) : null
    }));
    const contextText = buildSummaryContext(identifiers, sampleData, enabledSources);

    const sourceNames = sourceData.filter((s) => !s.error).map((s) => s.name).join(", ");

    const systemPrompt = `You are a UX designer for a call center agent dashboard.
Available data sources: ${sourceNames}.

Propose 3 different widget layout STRUCTURES (no need to fill all data — just define the sections).

Rules:
- Each layout must have 4-7 sections total
- Always include: Customer Profile (kv, left) + Agent Recommendation (recommendation, right, last)
- Use types: kv, calllog, caselist, flags, recommendation
- placement "left" = profile/status columns, "right" = activity/cases/recommendation
- Vary emphasis: one focused on calls history, one on open cases/tickets, one balanced
- items: include 2-3 example items max per section (real field names from data)
- fields: list of source field names this section uses

Return ONLY compact JSON, no markdown, no explanation:
{"layouts":[{"id":"layout_1","name":"...","description":"...","sections":[{"id":"...","title":"...","icon":"...","type":"...","placement":"...","fields":["..."],"items":[...]}]},{"id":"layout_2",...},{"id":"layout_3",...}]}`;

    const rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, systemPrompt, contextText);

    let layouts;
    try {
      // Strategy 1: strip markdown fences and parse directly
      const cleaned = rawText.trim()
        .replace(/^```json?\s*/i, "").replace(/\s*```\s*$/, "").trim();

      // Strategy 2: try fixing trailing commas and parse
      for (const attempt of [cleaned, rawText.trim()]) {
        try {
          const fixed = attempt.replace(/,\s*([}\]])/g, "$1");
          const parsed = JSON.parse(fixed);
          if (Array.isArray(parsed?.layouts) && parsed.layouts.length) { layouts = parsed.layouts; break; }
        } catch { /* try next */ }
      }

      // Strategy 3: extract complete layout objects via brace-counting (handles truncation)
      if (!layouts) {
        const arrStart = cleaned.indexOf('"layouts"');
        const bracketStart = arrStart !== -1 ? cleaned.indexOf("[", arrStart) : -1;
        if (bracketStart !== -1) {
          const extracted = [];
          let i = bracketStart + 1;
          while (i < cleaned.length) {
            while (i < cleaned.length && /[\s,]/.test(cleaned[i])) i++;
            if (cleaned[i] !== "{") break;
            let depth = 0, start = i;
            while (i < cleaned.length) {
              if (cleaned[i] === "{") depth++;
              else if (cleaned[i] === "}") { depth--; if (depth === 0) { i++; break; } }
              i++;
            }
            try {
              const layout = JSON.parse(cleaned.slice(start, i).replace(/,\s*([}\]])/g, "$1"));
              if (layout.id && Array.isArray(layout.sections)) extracted.push(layout);
            } catch { /* skip malformed */ }
          }
          if (extracted.length) layouts = extracted;
        }
      }

      if (!layouts?.length) throw new Error("No valid layouts found in AI response");
    } catch (err) {
      sendJson(res, 500, { error: "AI returned invalid layout JSON: " + err.message, raw: rawText.slice(0, 500) });
      return;
    }

    sendJson(res, 200, { ok: true, layouts });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleSummaryAgenticAnalyzeUrl(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }

    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }

    const { url: rawUrl, method = "GET", campaignId } = body;
    if (!rawUrl) { sendJson(res, 400, { error: "url is required" }); return; }

    // Load campaign AI config if campaignId provided
    let aiProvider = "claude", aiApiKey = "", aiModel = "";
    if (campaignId) {
      try {
        const campaigns = await getEffectiveCampaigns();
        const config = campaigns.find((c) => c.id === campaignId);
        if (config) {
          aiProvider = config.summaryagentic?.aiProvider || "claude";
          aiApiKey   = config.summaryagenticAiApiKey || "";
          aiModel    = config.summaryagentic?.aiModel || "";
        }
      } catch { /* ignore, fall through to no-key error */ }
    }

    if (!aiApiKey) { sendJson(res, 400, { error: "No AI API key configured for this campaign. Set it in Summary Agentic → AI Provider." }); return; }

    const systemPrompt = `You are an API configuration assistant for a call center platform. Analyze the provided URL and suggest how to configure it as a reusable data source template.

Available template placeholders:
- {{phone}} — customer phone number (main identifier)
- {{customer_id}} — alternative customer ID
- {{range_from_ms}} — start of date range as Unix ms (today - days + 1)
- {{range_to_ms}} — end of today as Unix ms
- {{today}} — today as YYYY-MM-DD
- {{date_from}} — start of date range as YYYY-MM-DD
- {{date_to}} — end of today as YYYY-MM-DD
- {{now_ms}} — current Unix timestamp in ms
- Any {{custom_variable}} that matches a fixed param key

Rules:
1. Replace hardcoded phone/customer numbers in the URL with {{phone}} or {{customer_id}}
2. Replace Unix ms timestamps in range-start positions (rangeFrom, start, from, since) with {{range_from_ms}}
3. Replace Unix ms timestamps in range-end positions (rangeTo, end, to, until) with {{range_to_ms}}
4. Move purely static query params (rows, limit, pageSize, format, etc.) to fixedParams instead of hardcoding them in the URL
5. Keep semantic/structural params (rangeType, type, format when meaningful) in the URL
6. Suggest a short, clear name for this data source
7. If the URL needs an Authorization header, suggest the pattern in headersJson

Return ONLY a valid JSON object (no markdown, no explanation outside the json) with exactly these fields:
{
  "name": "short descriptive name",
  "url": "URL template with {{placeholders}}",
  "fixedParams": "key=value lines (one per line) for static defaults",
  "headersJson": "{}",
  "bodyTemplate": "",
  "explanation": "2-3 sentences explaining what you detected and why"
}`;

    const userMsg = `URL: ${rawUrl}\nMethod: ${method}`;

    let rawText;
    try {
      rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, systemPrompt, userMsg);
    } catch (err) {
      sendJson(res, 502, { error: `AI call failed: ${err.message}` });
      return;
    }

    // Parse JSON from response
    let suggestion;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      suggestion = JSON.parse(cleaned);
    } catch {
      sendJson(res, 502, { error: "AI returned non-JSON response", raw: rawText.slice(0, 500) });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      name: String(suggestion.name || ""),
      url: String(suggestion.url || rawUrl),
      method,
      fixedParams: String(suggestion.fixedParams || ""),
      headersJson: String(suggestion.headersJson || "{}"),
      bodyTemplate: String(suggestion.bodyTemplate || ""),
      explanation: String(suggestion.explanation || "")
    });
  } catch (error) {
    sendJson(res, 500, { error: `Analyze failed: ${error.message}` });
  }
}

async function handlePulseFormsAnalyzeUrl(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }
    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }
    const { url: rawUrl, method = "GET", campaignId } = body;
    if (!rawUrl) { sendJson(res, 400, { error: "url is required" }); return; }

    let aiProvider = "claude", aiApiKey = "", aiModel = "";
    if (campaignId) {
      const campaigns = await getEffectiveCampaigns();
      const config = campaigns.find((c) => c.id === campaignId);
      if (config) {
        aiProvider = config.pulseforms?.aiProvider || "claude";
        aiApiKey = config.pulseformsAiApiKey || "";
        aiModel = config.pulseforms?.aiModel || "";
      }
    }
    if (!aiApiKey) { sendJson(res, 400, { error: "No AI API key configured for PulseForms." }); return; }

    const systemPrompt = `You are an API configuration assistant for CRM integrations, especially Sugar CRM. Analyze the provided URL and suggest a reusable PulseForms data source template.
Available placeholders: {{phone}}, {{customer_id}}, {{email}}, {{first_name}}, {{last_name}}, {{account_id}}, plus custom URL parameters.
Return ONLY valid JSON with fields: name, url, fixedParams, headersJson, bodyTemplate, mode ("query" or "submit"), explanation.`;
    const rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, systemPrompt, `URL: ${rawUrl}\nMethod: ${method}`);
    let suggestion;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      suggestion = JSON.parse(cleaned);
    } catch {
      sendJson(res, 502, { error: "AI returned invalid JSON", raw: rawText.slice(0, 500) });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      name: String(suggestion.name || ""),
      url: String(suggestion.url || rawUrl),
      method,
      mode: ["query", "submit"].includes(suggestion.mode) ? suggestion.mode : "query",
      fixedParams: String(suggestion.fixedParams || ""),
      headersJson: String(suggestion.headersJson || "{}"),
      bodyTemplate: String(suggestion.bodyTemplate || ""),
      explanation: String(suggestion.explanation || "")
    });
  } catch (error) {
    sendJson(res, 500, { error: `PulseForms analyze failed: ${error.message}` });
  }
}

async function handlePulseFormsGenerateLayouts(req, res) {
  try {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON body" }); return; }
    const session = getSessionFromRequest(req);
    if (!session) { sendJson(res, 401, { error: "Unauthorized" }); return; }
    const campaignId = String(body.campaignId || "").trim();
    if (!campaignId) { sendJson(res, 400, { error: "campaignId is required" }); return; }

    const campaigns = await getEffectiveCampaigns();
    const config = campaigns.find((c) => c.id === campaignId);
    if (!config) { sendJson(res, 404, { error: "Campaign not found" }); return; }
    const pf = config.pulseforms || {};
    const aiProvider = pf.aiProvider || "claude";
    const aiApiKey = config.pulseformsAiApiKey || "";
    const aiModel = pf.aiModel || defaultAiModel(aiProvider);
    if (!aiApiKey) { sendJson(res, 400, { error: "No AI API key configured for PulseForms." }); return; }

    const sources = (pf.dataSources || []).map((s) => ({
      id: s.id, name: s.name, mode: s.mode, method: s.method, url: s.url,
      description: s.description, bodyTemplate: s.bodyTemplate, fieldMappings: s.fieldMappings || {}
    }));
    const formFields = pf.formFields || [];
    const systemPrompt = `You are a UX designer for a CRM integration widget called PulseForms. Generate 3 layout options for a widget that can query or submit information to Sugar CRM or another CRM.
Return ONLY valid JSON: {"layouts":[{"id":"layout_1","name":"...","description":"...","sections":[{"id":"...","title":"...","type":"form|results|actions|status|notes","placement":"main|side","fields":["..."]}]}]}`;
    const rawText = await callAiForSummary(aiProvider, aiApiKey, aiModel, systemPrompt, JSON.stringify({ mode: pf.mode, formFields, sources }, null, 2));
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      sendJson(res, 200, { ok: true, layouts: Array.isArray(parsed.layouts) ? parsed.layouts : [] });
    } catch {
      sendJson(res, 502, { error: "AI returned invalid layout JSON", raw: rawText.slice(0, 500) });
    }
  } catch (error) {
    sendJson(res, 500, { error: `PulseForms layout generation failed: ${error.message}` });
  }
}

function parseFixedParams(fixedParamsStr) {
  const result = {};
  for (const line of String(fixedParamsStr || "").split(/\n|,/)) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

async function fetchSummaryDataSource(source, identifiers) {
  // Merge: fixedParams first (defaults), then identifiers (URL params override)
  const fixed = parseFixedParams(source.fixedParams);
  const merged = { ...fixed, ...identifiers };

  // 1. Interpolate the base URL (resolves {{phone}} etc in the path/existing query string)
  let resolvedUrl = interpolateSummaryTemplate(source.url, merged);

  // 2. Append fixed params as query string params (like Postman's Params tab).
  //    Each value is also interpolated so {{phone}} in a param value is resolved.
  //    Internal-only variables (days) that are not meant to reach the API are excluded.
  const INTERNAL_VARS = new Set(["days"]);
  if (Object.keys(fixed).length > 0) {
    const urlObj = new URL(resolvedUrl);
    for (const [k, v] of Object.entries(fixed)) {
      if (INTERNAL_VARS.has(k)) continue;
      // Only append if not already present in the URL
      if (!urlObj.searchParams.has(k)) {
        urlObj.searchParams.set(k, interpolateSummaryTemplate(String(v), merged));
      }
    }
    resolvedUrl = urlObj.toString();
  }

  const method = source.method || "GET";

  let parsedHeaders = {};
  try {
    parsedHeaders = JSON.parse(source.headersJson || "{}");
  } catch {
    parsedHeaders = {};
  }

  const fetchOptions = {
    method,
    headers: { "Content-Type": "application/json", ...parsedHeaders },
    signal: AbortSignal.timeout(8000)
  };

  if (method === "POST" && source.bodyTemplate) {
    fetchOptions.body = interpolateSummaryTemplate(source.bodyTemplate, merged);
  }

  const response = await fetch(resolvedUrl, fetchOptions);
  if (!response.ok) {
    throw new Error(`Data source returned HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildDateVars(identifiers) {
  const now = Date.now();
  const days = Math.max(1, parseInt(identifiers.days ?? 30) || 30);

  // Start of today (midnight local) in ms
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  // End of today (23:59:59.999) in ms
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const rangeFrom = todayStart.getTime() - (days - 1) * 86400000; // N days back from start of today
  const rangeTo   = todayEnd.getTime();

  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fromDate = new Date(rangeFrom);
  const fromStr  = `${fromDate.getFullYear()}-${pad(fromDate.getMonth()+1)}-${pad(fromDate.getDate())}`;

  return {
    now_ms:         String(now),
    range_from_ms:  String(rangeFrom),
    range_to_ms:    String(rangeTo),
    today:          todayStr,
    date_from:      fromStr,
    date_to:        todayStr
  };
}

function interpolateSummaryTemplate(template, identifiers) {
  // Built-in date variables computed fresh on each call
  const dateVars = buildDateVars(identifiers);

  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const k = key.trim();
    // Date variables (priority over user params)
    if (Object.prototype.hasOwnProperty.call(dateVars, k)) {
      return dateVars[k];
    }
    // Normalize customer_id / customerId
    if (k === "customer_id" || k === "customerId") {
      return encodeURIComponent(identifiers.customerId || identifiers.customer_id || "");
    }
    if (Object.prototype.hasOwnProperty.call(identifiers, k)) {
      return encodeURIComponent(identifiers[k] ?? "");
    }
    return match; // leave unreplaced if key not found
  });
}

function truncateSourceData(data, maxItems = 20) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    const sliced = data.slice(0, maxItems);
    return sliced.length < data.length
      ? [...sliced, { _truncated: `${data.length - sliced.length} more items omitted` }]
      : sliced;
  }
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = Array.isArray(v) ? truncateSourceData(v, maxItems) : v;
  }
  return result;
}

function buildSummaryContext(identifiers, sourceData, enabledSources = []) {
  const descMap = {};
  for (const src of enabledSources) {
    if (src.description) descMap[src.id] = src.description;
  }

  const lines = [
    `Customer identifier: phone=${identifiers.phone || "N/A"}, customer_id=${identifiers.customerId || "N/A"}`,
    ""
  ];

  // Build suggestion map: sourceId → accepted suggestion objects
  const sugMap = {};
  for (const src of enabledSources) {
    if (Array.isArray(src.suggestions) && src.suggestions.length > 0) {
      const accepted = new Set(src.selectedFields || []);
      sugMap[src.id] = accepted.size > 0
        ? src.suggestions.filter((s) => accepted.has(s.id))
        : src.suggestions;
    }
  }

  for (const source of sourceData) {
    lines.push(`=== ${source.name} ===`);
    const desc = descMap[source.id];
    if (desc) lines.push(`[Description: ${desc}]`);

    // Include accepted AI suggestions as rendering hints
    const sugs = sugMap[source.id];
    if (sugs?.length) {
      lines.push(`[Suggested sections to generate from this source:]`);
      sugs.forEach((s) => {
        lines.push(`  - Section "${s.title}" (type: ${s.type}, placement: ${s.placement}): use fields ${(s.fields || []).join(", ")}`);
      });
    }

    if (source.error) {
      lines.push(`[Error fetching data: ${source.error}]`);
    } else {
      const safe = truncateSourceData(source.data, 10);
      // Hard cap per source: 20000 chars to avoid token overflow
      const serialized = JSON.stringify(safe);
      lines.push(serialized.length > 20000 ? serialized.slice(0, 20000) + "…[truncated]" : serialized);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function filterBySelectedFields(data, selectedFields) {
  if (!selectedFields || selectedFields.length === 0) return data;
  const fieldSet = new Set(selectedFields);

  // Build a set of top-level keys and array-item keys needed
  // e.g. "workitems[0].queue" → top key "workitems", item key "queue"
  const topKeys = new Set();
  const arrayItemKeys = {}; // topKey → Set of sub-keys

  for (const path of fieldSet) {
    const arrMatch = path.match(/^([^[.]+)\[0\]\.(.+)$/);
    if (arrMatch) {
      const [, topKey, subKey] = arrMatch;
      topKeys.add(topKey);
      if (!arrayItemKeys[topKey]) arrayItemKeys[topKey] = new Set();
      arrayItemKeys[topKey].add(subKey);
    } else {
      const topKey = path.split(".")[0];
      topKeys.add(topKey);
    }
  }

  function filterItem(item, subKeys) {
    if (!subKeys || !subKeys.size) return item;
    const out = {};
    for (const k of subKeys) out[k] = item?.[k];
    return out;
  }

  if (Array.isArray(data)) {
    // Root is an array — filter each item using all array-item sub-keys
    const allSubKeys = new Set(selectedFields.map((f) => f.replace(/^[^.]*\./, "")));
    const filtered = data.map((item) => filterItem(item, allSubKeys));
    return filtered.length > 0 ? filtered : data;
  }

  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (!topKeys.has(k)) continue;
    if (Array.isArray(v) && arrayItemKeys[k]) {
      out[k] = v.map((item) => filterItem(item, arrayItemKeys[k]));
    } else {
      out[k] = v;
    }
  }
  // If nothing matched (stale selectedFields), fall back to full data
  return Object.keys(out).length > 0 ? out : data;
}

function flattenObjectKeys(obj, prefix = "", depth = 0) {
  if (depth > 4 || typeof obj !== "object" || obj === null) return [];
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    keys.push(fullKey);
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys.push(...flattenObjectKeys(v, fullKey, depth + 1));
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
      keys.push(...flattenObjectKeys(v[0], `${fullKey}[0]`, depth + 1));
    }
  }
  return keys;
}

function defaultAiModel(provider) {
  if (provider === "claude") return "claude-sonnet-4-6";
  if (provider === "openai") return "gpt-4o";
  return "gemini-2.5-flash";
}

function defaultSummaryPrompt() {
  return [
    "You are an intelligent assistant for a BPO call center agent.",
    "The agent is about to answer a call from a customer.",
    "Based ONLY on the data actually available below, generate a structured JSON summary.",
    "IMPORTANT: Only include sections for which there is real data. Do NOT invent or hallucinate information.",
    "If a data source returned an error or is empty, skip that section entirely.",
    "",
    "Return a JSON object with a single key 'sections', which is an array of section objects.",
    "Each section object has:",
    "  - id: string (snake_case unique identifier)",
    "  - title: string (display title for the section)",
    "  - icon: string (single emoji that represents the section)",
    "  - placement: 'left' or 'right' (left = compact profile-like info, right = lists and main content)",
    "  - type: one of: 'kv' | 'calllog' | 'caselist' | 'flags' | 'text' | 'recommendation'",
    "  - items: array of objects depending on type:",
    "    - kv:             [{ label, value, highlight? }] (highlight: 'green'|'yellow'|'red')",
    "    - calllog:        [{ date, reason, agent?, duration?, status }] (status: 'resolved'|'escalated'|'pending'|'missed')",
    "    - caselist:       [{ id, status, description }] (status: 'Open'|'Closed'|'Escalated'|'Pending')",
    "    - flags:          [{ type: 'warning'|'info'|'vip'|'escalation', message }]",
    "    - text:           [{ content }]",
    "    - recommendation: [{ content }]",
    "",
    "Example section types to consider (only if data exists): customer profile, account status, recent calls,",
    "open cases, active subscriptions, pending orders, loyalty/points, last purchases, escalation history,",
    "recommended approach.",
    "Return ONLY the JSON object. No markdown, no explanation.",
    "IMPORTANT: Be concise. Limit each section to a maximum of 8 items. For call logs show only the most recent 8 calls.",
    "Keep text values short (under 120 characters). The response must be a complete, valid JSON object — never truncate it."
  ].join(" ");
}

function parseSummarySections(rawText) {
  if (!rawText) return null;

  // Strategy 1: strip markdown fences and parse directly
  const cleaned = rawText.trim()
    .replace(/^```json?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  const attempts = [cleaned, rawText.trim()];

  // Strategy 2: extract the outermost JSON object via regex
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) attempts.push(jsonMatch[0]);

  for (const text of attempts) {
    try {
      const parsed = JSON.parse(text);
      const sections = parsed?.sections;
      if (Array.isArray(sections) && sections.length > 0) return sections;
    } catch { /* try next */ }
  }

  // Strategy 3: response was truncated — extract complete section objects
  try {
    const sectionsStart = cleaned.indexOf('"sections"');
    if (sectionsStart !== -1) {
      // Find the array start
      const arrStart = cleaned.indexOf("[", sectionsStart);
      if (arrStart !== -1) {
        // Collect complete section objects by counting braces
        const sections = [];
        let i = arrStart + 1;
        while (i < cleaned.length) {
          // Skip whitespace/commas
          while (i < cleaned.length && /[\s,]/.test(cleaned[i])) i++;
          if (cleaned[i] !== "{") break;
          let depth = 0, start = i;
          while (i < cleaned.length) {
            if (cleaned[i] === "{") depth++;
            else if (cleaned[i] === "}") { depth--; if (depth === 0) { i++; break; } }
            i++;
          }
          try {
            const sec = JSON.parse(cleaned.slice(start, i));
            if (sec.id && sec.type && Array.isArray(sec.items)) sections.push(sec);
          } catch { /* skip malformed section */ }
        }
        if (sections.length > 0) return sections;
      }
    }
  } catch { /* ignore */ }

  return null;
}

async function callAiForSummary(provider, apiKey, model, systemPrompt, contextText) {
  if (provider === "claude") {
    return callClaudeForSummary(apiKey, model, systemPrompt, contextText);
  }
  if (provider === "openai") {
    return callOpenAiForSummary(apiKey, model, systemPrompt, contextText);
  }
  // Default: Gemini
  return callGeminiForSummary(apiKey, model, systemPrompt, contextText);
}

async function callClaudeForSummary(apiKey, model, systemPrompt, contextText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: contextText }]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Claude API returned ${response.status}${errText ? `: ${errText}` : ""}`);
  }

  const payload = await response.json();
  const text = payload?.content?.[0]?.text || "";
  if (!text) throw new Error("Claude returned an empty response.");
  return text;
}

async function callOpenAiForSummary(apiKey, model, systemPrompt, contextText) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI API returned ${response.status}${errText ? `: ${errText}` : ""}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("OpenAI returned an empty response.");
  return text;
}

async function callGeminiForSummary(apiKey, model, systemPrompt, contextText) {
  const endpoint = buildGeminiEndpoint("https://generativelanguage.googleapis.com", model || "gemini-2.5-flash");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: contextText }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" }
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini API returned ${response.status}${errText ? `: ${errText}` : ""}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPredictionUpstream(config, input) {
  const payload = JSON.stringify({
    message: input.message || "",
    kb_ids: config.requestKbIds,
    regenerate: "true",
    workitem_id: input.workitem_id || ""
  });

  const headers = {
    "Authorization": config.token,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  };

  if (config.cookie) {
    headers["Cookie"] = config.cookie;
  }

  return fetch(config.apiUrl, {
    method: "POST",
    headers,
    body: payload
  });
}

async function fetchAgentChatUserToken(username, password) {
  const credentials = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  const upstream = await fetch("https://login.thrio.com/provider/token-with-authorities", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`
    }
  });

  const responseText = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Login provider returned ${upstream.status}${responseText ? `: ${responseText}` : "."}`);
  }

  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    payload = { token: responseText };
  }

  const token = String(payload?.access_token || payload?.token || payload?.id_token || "").trim();
  if (!token) {
    throw new Error("Login provider did not return a token.");
  }

  return token;
}

async function resolveCampaignSelectionAsync(selection) {
  const campaigns = await getEffectiveCampaigns();
  if (!campaigns.length) {
    throwConfig("No campaign configuration found. Add one in /admin.html or set THRIO_AUTH_TOKEN in .env.");
  }

  const campaignId = String(selection?.campaignId || selection?.campaign || "").trim();
  const domain = sanitizeDomain(selection?.domain);

  let match = null;

  if (campaignId) {
    match = campaigns.find((item) => item.id === campaignId);
    if (!match) {
      throwConfig(`Unknown campaign "${campaignId}".`);
    }
  }

  if (!match && domain) {
    match = campaigns.find((item) => item.domain === domain);
    if (!match) {
      throwConfig(`Unknown domain "${domain}".`);
    }
  }

  if (!match) {
    if (campaigns.length === 1) {
      match = campaigns[0];
    } else {
      throwConfig("Missing campaign selection. Provide ?campaign=... in the URL.");
    }
  }

  return match;
}

async function loginAgentChatUser(config, token) {
  const upstream = await fetch(`https://${sanitizeDomain(config.domain)}/users/api/login`, {
    method: "POST",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json"
    }
  });

  const responseText = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`User login API returned ${upstream.status}${responseText ? `: ${responseText}` : "."}`);
  }
}

async function logoutAgentChatUser(config, token) {
  const upstream = await fetch(`https://${sanitizeDomain(config.domain)}/users/api/logout`, {
    method: "POST",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json"
    }
  });

  const responseText = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`User logout API returned ${upstream.status}${responseText ? `: ${responseText}` : "."}`);
  }
}

async function handleAdmin(req, res, url) {
  const ip = getClientIp(req);

  if (isAdminRateLimited(ip)) {
    sendJson(res, 429, { error: "Too many failed attempts. Try again in 15 minutes." });
    return;
  }

  if (!isAuthorizedAdmin(req)) {
    recordFailedAdminAttempt(ip);
    res.writeHead(401, {
      "Content-Type": "application/json; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="NextIQ Admin"'
    });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  clearAdminAttempts(ip);

  // ── User management (admin role required) ──────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "admin") {
      sendJson(res, 403, { error: "Admin role required to view users." });
      return;
    }
    const users = await readUsers();
    sendJson(res, 200, { users: users.map(publicUser) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "admin") {
      sendJson(res, 403, { error: "Admin role required to manage users." });
      return;
    }
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." });
      return;
    }
    const username = sanitizeUsername(body.username);
    const password = String(body.password || "");
    const role = body.role === "editor" ? "editor" : "admin";
    const permissions = normalizeUserPermissions(body.permissions, role);
    if (!username || username.length < 3) {
      sendJson(res, 400, { error: "Username must be at least 3 characters." });
      return;
    }
    if (!password || password.length < 8) {
      sendJson(res, 400, { error: "Password must be at least 8 characters." });
      return;
    }
    const users = await readUsers();
    if (users.find((u) => u.username === username)) {
      sendJson(res, 409, { error: `User "${username}" already exists.` });
      return;
    }
    const { hash, salt } = hashPassword(password);
    const newUser = { id: username, username, passwordHash: hash, passwordSalt: salt, role, permissions, createdAt: new Date().toISOString() };
    await writeUsers([...users, newUser]);
    sendJson(res, 200, { ok: true, user: publicUser(newUser) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users/delete") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "admin") {
      sendJson(res, 403, { error: "Admin role required to manage users." });
      return;
    }
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." });
      return;
    }
    const id = String(body.id || "").trim();
    if (!id) { sendJson(res, 400, { error: "Missing user id." }); return; }
    if (id === session.sub) { sendJson(res, 400, { error: "You cannot delete your own account." }); return; }
    const users = await readUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) { sendJson(res, 404, { error: "User not found." }); return; }
    await writeUsers(filtered);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users/change-password") {
    const session = getSessionFromRequest(req);
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." });
      return;
    }
    const targetId = String(body.id || "").trim();
    // Only admin can change others' passwords; any user can change their own
    if (session && session.sub !== targetId && session.role !== "admin") {
      sendJson(res, 403, { error: "Admin role required to change other users' passwords." });
      return;
    }
    const newPassword = String(body.password || "");
    if (!newPassword || newPassword.length < 8) {
      sendJson(res, 400, { error: "Password must be at least 8 characters." });
      return;
    }
    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === targetId);
    if (idx === -1) { sendJson(res, 404, { error: "User not found." }); return; }
    const { hash, salt } = hashPassword(newPassword);
    users[idx] = { ...users[idx], passwordHash: hash, passwordSalt: salt };
    await writeUsers(users);
    sendJson(res, 200, { ok: true });
    return;
  }
  // ──────────────────────────────────────────────────────────────────────

  if (req.method === "GET" && url.pathname === "/api/admin/campaigns") {
    try {
      const campaigns = await readCampaigns();
      sendJson(res, 200, { campaigns, adminConfigured: Boolean(ADMIN_PASSWORD) });
    } catch (error) {
      console.error("[admin/campaigns] readCampaigns error:", error.message, error.stack);
      sendJson(res, 500, { error: "Failed to load campaigns", details: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/campaigns") {
    const session = getSessionFromRequest(req);
    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    try {
      const campaign = normalizeCampaign(body);
      const campaigns = await readCampaigns();
      const index = campaigns.findIndex((item) => item.id === campaign.id);
      const permission = index >= 0 ? "editCampaign" : "createCampaign";
      if (!hasAdminPermission(session, permission)) {
        sendJson(res, 403, {
          error: index >= 0
            ? "You do not have permission to edit campaigns."
            : "You do not have permission to create campaigns."
        });
        return;
      }

      if (index >= 0) {
        campaigns[index] = campaign;
      } else {
        campaigns.push(campaign);
      }

      await writeCampaigns(campaigns);
      sendJson(res, 200, { ok: true, campaign });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/campaigns/delete") {
    const session = getSessionFromRequest(req);
    if (!hasAdminPermission(session, "deleteCampaign")) {
      sendJson(res, 403, { error: "You do not have permission to delete campaigns." });
      return;
    }
    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const id = String(body.id || "").trim();
    if (!id) {
      sendJson(res, 400, { error: "Missing campaign id" });
      return;
    }

    const campaigns = await readCampaigns();
    const filtered = campaigns.filter((item) => item.id !== id);
    await writeCampaigns(filtered);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/wieland/copy-contacts") {
    if (!firestore) {
      sendJson(res, 400, { error: "Firestore not available." });
      return;
    }
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const fromPrefix = String(body.fromPrefix || "nextiq").trim();
    const toPrefix = String(body.toPrefix || FIRESTORE_PREFIX).trim();
    if (!fromPrefix || !toPrefix || fromPrefix === toPrefix) {
      sendJson(res, 400, { error: "fromPrefix and toPrefix are required and must differ." });
      return;
    }
    const fromCollection = `${fromPrefix}_wieland_contacts`;
    const toCollection = `${toPrefix}_wieland_contacts`;
    const snapshot = await firestore.collection(fromCollection).get();
    if (snapshot.empty) {
      sendJson(res, 200, { ok: true, copied: 0, message: `Source collection "${fromCollection}" is empty.` });
      return;
    }
    const batch = firestore.batch();
    let count = 0;
    for (const doc of snapshot.docs) {
      batch.set(firestore.collection(toCollection).doc(doc.id), doc.data(), { merge: true });
      count++;
    }
    await batch.commit();
    sendJson(res, 200, { ok: true, copied: count, from: fromCollection, to: toCollection });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

function serveStatic(requestPath, isHeadRequest, res) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (requestPath !== "/" && path.extname(filePath) === "") {
        serveStatic("/index.html", isHeadRequest, res);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    if (isHeadRequest) {
      res.end();
      return;
    }

    res.end(data);
  });
}

function getHealthStatus() {
  try {
    return {
      configured: true,
      storage: firestore ? "firestore" : "file",
      adminConfigured: Boolean(ADMIN_PASSWORD)
    };
  } catch (error) {
    return {
      configured: false,
      error: error.message
    };
  }
}

async function resolveCampaignConfigAsync(selection) {
  const campaigns = await getEffectiveCampaigns();
  if (!campaigns.length) {
    throwConfig("No campaign configuration found. Add one in /admin.html or set THRIO_AUTH_TOKEN in .env.");
  }

  const campaignId = String(selection.campaignId || "").trim();
  const domain = sanitizeDomain(selection.domain);
  const requestedKbIds = normalizeKbIds(selection.kbIds);

  let match = null;

  if (campaignId) {
    match = campaigns.find((item) => item.id === campaignId);
    if (!match) {
      throwConfig(`Unknown campaign "${campaignId}".`);
    }
  }

  if (!match && domain) {
    match = campaigns.find((item) => item.domain === domain);
    if (!match) {
      throwConfig(`Unknown domain "${domain}".`);
    }
  }

  if (!match) {
    if (campaigns.length === 1) {
      match = campaigns[0];
    } else {
      throwConfig("Missing campaign selection. Provide ?campaign=... in the URL.");
    }
  }

  if (!match.token) {
    throwConfig(`Campaign "${match.id}" is missing a token.`);
  }

  let kbIds = requestedKbIds.length ? requestedKbIds : match.allowedKbIds;
  if (!kbIds.length) {
    throwConfig(`Campaign "${match.id}" is missing KB IDs.`);
  }

  if (match.allowedKbIds.length) {
    const invalid = kbIds.find((kbId) => !match.allowedKbIds.includes(kbId));
    if (invalid) {
      throwConfig(`KB ID "${invalid}" is not allowed for campaign "${match.id}".`);
    }
  }

  return {
    ...match,
    requestKbIds: kbIds
  };
}

async function getEffectiveCampaigns() {
  const campaigns = await readCampaigns();
  if (campaigns.length) {
    return campaigns;
  }

  const fallback = getFallbackCampaign();
  return fallback ? [fallback] : [];
}

function getFallbackCampaign() {
  const token = String(process.env.THRIO_AUTH_TOKEN || "").trim();
  if (!token || token === "replace-with-your-authorization-token") {
    return null;
  }

  return normalizeCampaign({
    id: process.env.DEFAULT_CAMPAIGN_ID || "default",
    name: process.env.DEFAULT_CAMPAIGN_NAME || "Default campaign",
    domain: process.env.THRIO_DOMAIN || getDomainFromUrl(DEFAULT_API_URL),
    apiUrl: DEFAULT_API_URL,
    token,
    cookie: process.env.THRIO_COOKIE || "",
    allowedKbIds: normalizeKbIds(process.env.THRIO_KB_ID || "")
  });
}

function readSelection(searchParams) {
  const kbParam = searchParams.getAll("kb_id");
  const kbIds = kbParam.length ? kbParam : searchParams.get("kb_ids") || "";

  return {
    campaignId: searchParams.get("campaign") || "",
    domain: searchParams.get("domain") || "",
    kbIds
  };
}

// Extrae un token override del header x-thrio-token o query param token.
// Si está presente, se usa en lugar del token de la campaña para llamadas a Thrio.
function getThrioTokenOverride(req) {
  const fromHeader = String(req.headers["x-thrio-token"] || "").trim();
  if (fromHeader) return fromHeader;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return String(url.searchParams.get("token") || "").trim();
  } catch { return ""; }
}

// Aplica el token override al config si viene en el request
function applyTokenOverride(config, req) {
  const override = getThrioTokenOverride(req);
  if (!override) return config;
  return { ...config, token: override };
}

async function readCampaigns() {
  if (firestore) {
    const snapshot = await firestore.collection(FIRESTORE_COLLECTION).get();
    return snapshot.docs.map((doc) =>
      decryptCampaignSecrets(normalizeCampaign({ id: doc.id, ...doc.data() }))
    );
  }

  if (!fs.existsSync(CAMPAIGNS_FILE)) {
    return [];
  }

  const raw = fs.readFileSync(CAMPAIGNS_FILE, "utf8").trim();
  if (!raw) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid campaigns.json: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid campaigns.json: expected an array.");
  }

  return parsed.map((item) => decryptCampaignSecrets(normalizeCampaign(item)));
}

async function writeCampaigns(campaigns) {
  const normalized = campaigns.map((campaign) =>
    encryptCampaignSecrets(stripUndefinedDeep(normalizeCampaign(campaign)))
  );

  if (firestore) {
    const existing = await firestore.collection(FIRESTORE_COLLECTION).get();
    const batch = firestore.batch();
    const incomingIds = new Set(normalized.map((item) => item.id));

    for (const doc of existing.docs) {
      if (!incomingIds.has(doc.id)) {
        batch.delete(doc.ref);
      }
    }

    for (const campaign of normalized) {
      const ref = firestore.collection(FIRESTORE_COLLECTION).doc(campaign.id);
      batch.set(ref, campaign);
    }

    await batch.commit();
    return;
  }

  fs.writeFileSync(CAMPAIGNS_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

function normalizeWielandVisibleTabs(visibleTabs = {}) {
  return {
    contacts: visibleTabs.contacts !== false,
    lists: visibleTabs.lists !== false,
    campaign: visibleTabs.campaign !== false,
    mapping: visibleTabs.mapping !== false
  };
}

function normalizeWielandListButtons(listButtons = {}) {
  return {
    activate: listButtons.activate !== false,
    assign: listButtons.assign !== false,
    update: listButtons.update !== false,
    refresh: listButtons.refresh !== false,
    log: listButtons.log !== false,
    delete: listButtons.delete !== false
  };
}

function normalizeCampaign(input) {
  const id = slugify(input.id || input.name || input.domain);
  if (!id) {
    throw new Error("Campaign id is required.");
  }

  const apiUrl = String(input.apiUrl || input.api_url || DEFAULT_API_URL).trim();
  if (!apiUrl) {
    throw new Error("API URL is required.");
  }

  return {
    id,
    name: String(input.name || id).trim() || id,
    domain: sanitizeDomain(input.domain || getDomainFromUrl(apiUrl)),
    apiUrl,
    workitemApiUrl: String(
      input.workitemApiUrl
      || input.workitem_api_url
      || buildWorkitemApiUrl(input.domain || getDomainFromUrl(apiUrl))
    ).trim(),
    agentChatApiUrl: String(
      input.agentChatApiUrl
      || input.agent_chat_api_url
      || buildAgentChatApiUrl(input.domain || getDomainFromUrl(apiUrl))
    ).trim(),
    token: String(input.token || "").trim(),
    cookie: String(input.cookie || "").trim(),
    agentUserId: String(
      input.agentUserId
      || input.agent_user_id
      || inferAgentUserIdFromToken(String(input.token || "").trim())
    ).trim(),
    sentimentProvider: normalizeSentimentProvider(input.sentimentProvider || input.sentiment_provider || ""),
    geminiApiKey: String(input.geminiApiKey || input.gemini_api_key || "").trim(),
    geminiModel: String(input.geminiModel || input.gemini_model || "gemini-2.5-flash").trim() || "gemini-2.5-flash",
    geminiApiUrl: String(input.geminiApiUrl || input.gemini_api_url || "https://generativelanguage.googleapis.com").trim() || "https://generativelanguage.googleapis.com",
    geminiPrompt: String(input.geminiPrompt || input.gemini_prompt || "").trim(),
    questionsGeminiApiKey: String(input.questionsGeminiApiKey || input.questions_gemini_api_key || "").trim(),
    questionsGeminiModel: String(input.questionsGeminiModel || input.questions_gemini_model || "gemini-2.5-flash").trim() || "gemini-2.5-flash",
    questionsGeminiApiUrl: String(input.questionsGeminiApiUrl || input.questions_gemini_api_url || "https://generativelanguage.googleapis.com").trim() || "https://generativelanguage.googleapis.com",
    questionsGeminiPrompt: String(input.questionsGeminiPrompt || input.questions_gemini_prompt || "").trim(),
    nextStepGeminiPrompt: String(input.nextStepGeminiPrompt || input.next_step_gemini_prompt || "").trim(),
    acdEnabledPayload: normalizeJsonObject(input.acdEnabledPayload || input.acd_enabled_payload || input.acd?.enabledPayload),
    acdDisabledPayload: normalizeJsonObject(input.acdDisabledPayload || input.acd_disabled_payload || input.acd?.disabledPayload),
    acdEnabledStatusId: String(
      input.acdEnabledStatusId
      || input.acd_enabled_status_id
      || input.acdOnlineStatusId
      || input.acd_online_status_id
      || input.acd?.enabledStatusId
      || ""
    ).trim(),
    acdDisabledStatusId: String(
      input.acdDisabledStatusId
      || input.acd_disabled_status_id
      || input.acdOfflineStatusId
      || input.acd_offline_status_id
      || input.acd?.disabledStatusId
      || ""
    ).trim(),
    acdEnabledStatusCode: parseInteger(
      input.acdEnabledStatusCode
      ?? input.acd_enabled_status_code
      ?? input.acd?.enabledStatusCode,
      0
    ),
    acdDisabledStatusCode: parseInteger(
      input.acdDisabledStatusCode
      ?? input.acd_disabled_status_code
      ?? input.acd?.disabledStatusCode,
      3
    ),
    transcriptRefreshSeconds: Math.max(1, parseInt(input.transcriptRefreshSeconds || input.transcript_refresh_seconds || 10) || 10),
    allowedKbIds: normalizeKbIds(input.allowedKbIds || input.allowed_kb_ids || input.kbIds || ""),
    wieland: {
      nccCampaignId: String(input.wieland?.nccCampaignId || input.wielandNccCampaignId || "").trim(),
      slotsNeeded: Math.max(1, parseInt(input.wieland?.slotsNeeded ?? input.wielandSlotsNeeded ?? 0) || 8),
      uploadFileName: String(input.wieland?.uploadFileName || input.wielandUploadFileName || "").trim(),
      nccFieldmappingId: String(input.wieland?.nccFieldmappingId || input.wielandNccFieldmappingId || "").trim(),
      visibleTabs: normalizeWielandVisibleTabs(input.wieland?.visibleTabs || input.wielandVisibleTabs || {}),
      listButtons: normalizeWielandListButtons(input.wieland?.listButtons || input.wielandListButtons || {}),
      widgetToContactMap: sanitizeStringMapping(input.wieland?.widgetToContactMap || input.wielandWidgetToContactMap || {}),
      contactToListMap: sanitizeStringMapping(input.wieland?.contactToListMap || input.wielandContactToListMap || {}),
      nccAuthType: (["token", "key", "none"].includes(input.wieland?.nccAuthType) ? input.wieland.nccAuthType : null)
        || (["token", "key", "none"].includes(input.wielandNccAuthType) ? input.wielandNccAuthType : "token")
    },
    wielandNccCredential: String(input.wielandNccCredential || "").trim(),
    summaryagenticAiApiKey: String(input.summaryagenticAiApiKey || "").trim(),
    summaryagenticHubspotToken: String(input.summaryagenticHubspotToken || "").trim(),
    summaryagenticWarmToken: String(input.summaryagenticWarmToken || "").trim(),
    summaryagentic: normalizeSummaryAgenticConfig(input.summaryagentic || {}),
    pulseformsAiApiKey: String(input.pulseformsAiApiKey || "").trim(),
    pulseforms: normalizePulseFormsConfig(input.pulseforms || {}),
    apiAccessToken: String(input.apiAccessToken || "").trim(),
    ui: normalizeUiConfig(input.ui || input)
  };
}

function normalizeUiConfig(input) {
  const source = input || {};
  const sharedSource = source.shared || source.common || {};
  const chatSource = source.chat || {};
  const workitemSource = source.workitem || {};
  const sentimentSource = source.sentiment || {};
  const questionsSource = source.questions || source.checklist || {};
  const nextStepSource = source.nextStep || source.next_step || source.agentNextStep || source.agent_next_step || {};

  return {
    shared: {
      language: normalizeLanguage(sharedSource.language || sharedSource.lang || source.language || source.lang || "en"),
      fontFamily: String(sharedSource.fontFamily || sharedSource.font_family || source.fontFamily || source.font_family || "").trim(),
      baseFontSize: normalizeCssSize(sharedSource.baseFontSize || sharedSource.base_font_size || source.baseFontSize || source.base_font_size || "", "16px")
    },
    chat: normalizePageUiConfig({
      source: chatSource,
      fallback: source,
      defaults: {
        titleText: "",
        titleSize: "2rem",
        metaSize: "0.82rem",
        showTitle: true,
        showMeta: true,
        showPageHeader: true,
        embedMinHeight: "180px",
        embedMaxHeight: "520px"
      }
    }),
    workitem: normalizePageUiConfig({
      source: workitemSource,
      fallback: source,
      defaults: {
        titleText: "",
        titleSize: "2rem",
        metaSize: "0.82rem",
        showTitle: true,
        showMeta: true,
        showPageHeader: true,
        embedMinHeight: "180px",
        embedMaxHeight: "520px"
      }
    }),
    sentiment: {
      ...normalizePageUiConfig({
        source: sentimentSource,
        fallback: source,
        defaults: {
          titleText: "",
          titleSize: "2rem",
          metaSize: "0.82rem",
          showTitle: true,
          showMeta: true,
          showPageHeader: true,
          embedMinHeight: "180px",
          embedMaxHeight: "520px"
        }
      }),
      sentimentLayout: normalizeSentimentLayout(sentimentSource.sentimentLayout || sentimentSource.sentiment_layout || source.sentimentLayout || source.sentiment_layout || ""),
      sentimentStylePreset: normalizeSentimentStylePreset(
        sentimentSource.sentimentStylePreset
        || sentimentSource.sentiment_style_preset
        || source.sentimentStylePreset
        || source.sentiment_style_preset
        || ""
      ),
      sentimentCardMaxWidth: normalizeCssSize(sentimentSource.sentimentCardMaxWidth || sentimentSource.sentiment_card_max_width || source.sentimentCardMaxWidth || source.sentiment_card_max_width || "", "560px"),
      sentimentCardMinHeight: normalizeCssSize(sentimentSource.sentimentCardMinHeight || sentimentSource.sentiment_card_min_height || source.sentimentCardMinHeight || source.sentiment_card_min_height || "", "0px"),
      sentimentCardMaxHeight: normalizeCssSize(sentimentSource.sentimentCardMaxHeight || sentimentSource.sentiment_card_max_height || source.sentimentCardMaxHeight || source.sentiment_card_max_height || "", "none"),
      sentimentCardPadding: normalizeCssSize(sentimentSource.sentimentCardPadding || sentimentSource.sentiment_card_padding || source.sentimentCardPadding || source.sentiment_card_padding || "", "34px 40px 28px"),
      sentimentCardRadius: normalizeCssSize(sentimentSource.sentimentCardRadius || sentimentSource.sentiment_card_radius || source.sentimentCardRadius || source.sentiment_card_radius || "", "38px"),
      sentimentOrbSize: normalizeCssSize(sentimentSource.sentimentOrbSize || sentimentSource.sentiment_orb_size || source.sentimentOrbSize || source.sentiment_orb_size || "", "180px"),
      sentimentDualPanelGlowSize: normalizeCssSize(
        sentimentSource.sentimentDualPanelGlowSize || sentimentSource.sentiment_dual_panel_glow_size || source.sentimentDualPanelGlowSize || source.sentiment_dual_panel_glow_size || "",
        "180px"
      ),
      sentimentDualPanelSectionGap: normalizeCssSize(
        sentimentSource.sentimentDualPanelSectionGap || sentimentSource.sentiment_dual_panel_section_gap || source.sentimentDualPanelSectionGap || source.sentiment_dual_panel_section_gap || "",
        "0px"
      ),
      sentimentDualPanelTextOrbGap: normalizeCssSize(
        sentimentSource.sentimentDualPanelTextOrbGap || sentimentSource.sentiment_dual_panel_text_orb_gap || source.sentimentDualPanelTextOrbGap || source.sentiment_dual_panel_text_orb_gap || "",
        "18px"
      ),
      sentimentDualPanelTextGap: normalizeCssSize(
        sentimentSource.sentimentDualPanelTextGap || sentimentSource.sentiment_dual_panel_text_gap || source.sentimentDualPanelTextGap || source.sentiment_dual_panel_text_gap || "",
        "6px"
      ),
      sentimentDualPanelHeartSize: normalizeCssSize(
        sentimentSource.sentimentDualPanelHeartSize || sentimentSource.sentiment_dual_panel_heart_size || source.sentimentDualPanelHeartSize || source.sentiment_dual_panel_heart_size || "",
        "68px"
      ),
      sentimentCardTitleFontSize: normalizeCssSize(
        sentimentSource.sentimentCardTitleFontSize || sentimentSource.sentiment_card_title_font_size || source.sentimentCardTitleFontSize || source.sentiment_card_title_font_size || "",
        "3.6rem"
      ),
      sentimentLabelFontSize: normalizeCssSize(
        sentimentSource.sentimentLabelFontSize || sentimentSource.sentiment_label_font_size || source.sentimentLabelFontSize || source.sentiment_label_font_size || "",
        "3rem"
      ),
      sentimentScoreFontSize: normalizeCssSize(
        sentimentSource.sentimentScoreFontSize || sentimentSource.sentiment_score_font_size || source.sentimentScoreFontSize || source.sentiment_score_font_size || "",
        "4rem"
      ),
      sentimentInsightTitleSize: normalizeCssSize(
        sentimentSource.sentimentInsightTitleSize || sentimentSource.sentiment_insight_title_size || source.sentimentInsightTitleSize || source.sentiment_insight_title_size || "",
        "1rem"
      ),
      sentimentInsightTextSize: normalizeCssSize(
        sentimentSource.sentimentInsightTextSize || sentimentSource.sentiment_insight_text_size || source.sentimentInsightTextSize || source.sentiment_insight_text_size || "",
        "0.98rem"
      ),
      sentimentMetaFontSize: normalizeCssSize(
        sentimentSource.sentimentMetaFontSize || sentimentSource.sentiment_meta_font_size || source.sentimentMetaFontSize || source.sentiment_meta_font_size || "",
        "0.82rem"
      ),
      sentimentDualPanelChartHeight: normalizeCssSize(
        sentimentSource.sentimentDualPanelChartHeight || sentimentSource.sentiment_dual_panel_chart_height || source.sentimentDualPanelChartHeight || source.sentiment_dual_panel_chart_height || "",
        "92px"
      ),
      sentimentDualPanelChartTopGap: normalizeCssSize(
        sentimentSource.sentimentDualPanelChartTopGap || sentimentSource.sentiment_dual_panel_chart_top_gap || source.sentimentDualPanelChartTopGap || source.sentiment_dual_panel_chart_top_gap || "",
        "18px"
      ),
      sentimentCompactBreakpoint: normalizeCssSize(
        sentimentSource.sentimentCompactBreakpoint || sentimentSource.sentiment_compact_breakpoint || source.sentimentCompactBreakpoint || source.sentiment_compact_breakpoint || "",
        "560px"
      ),
      sentimentCompactCardPadding: normalizeCssSize(
        sentimentSource.sentimentCompactCardPadding || sentimentSource.sentiment_compact_card_padding || source.sentimentCompactCardPadding || source.sentiment_compact_card_padding || "",
        "16px 14px 12px"
      ),
      sentimentCompactOrbSize: normalizeCssSize(
        sentimentSource.sentimentCompactOrbSize || sentimentSource.sentiment_compact_orb_size || source.sentimentCompactOrbSize || source.sentiment_compact_orb_size || "",
        "126px"
      ),
      sentimentCompactTitleFontSize: normalizeCssSize(
        sentimentSource.sentimentCompactTitleFontSize || sentimentSource.sentiment_compact_title_font_size || source.sentimentCompactTitleFontSize || source.sentiment_compact_title_font_size || "",
        "2.4rem"
      ),
      sentimentCompactLabelFontSize: normalizeCssSize(
        sentimentSource.sentimentCompactLabelFontSize || sentimentSource.sentiment_compact_label_font_size || source.sentimentCompactLabelFontSize || source.sentiment_compact_label_font_size || "",
        "2rem"
      ),
      sentimentCompactScoreFontSize: normalizeCssSize(
        sentimentSource.sentimentCompactScoreFontSize || sentimentSource.sentiment_compact_score_font_size || source.sentimentCompactScoreFontSize || source.sentiment_compact_score_font_size || "",
        "2.8rem"
      ),
      sentimentCompactInsightTitleSize: normalizeCssSize(
        sentimentSource.sentimentCompactInsightTitleSize || sentimentSource.sentiment_compact_insight_title_size || source.sentimentCompactInsightTitleSize || source.sentiment_compact_insight_title_size || "",
        "0.92rem"
      ),
      sentimentCompactInsightTextSize: normalizeCssSize(
        sentimentSource.sentimentCompactInsightTextSize || sentimentSource.sentiment_compact_insight_text_size || source.sentimentCompactInsightTextSize || source.sentiment_compact_insight_text_size || "",
        "0.88rem"
      ),
      sentimentCompactMetaFontSize: normalizeCssSize(
        sentimentSource.sentimentCompactMetaFontSize || sentimentSource.sentiment_compact_meta_font_size || source.sentimentCompactMetaFontSize || source.sentiment_compact_meta_font_size || "",
        "0.72rem"
      ),
      refreshIntervalSeconds: normalizeRefreshInterval(
        sentimentSource.refreshIntervalSeconds
        || sentimentSource.refresh_interval_seconds
        || sentimentSource.sentimentRefreshSeconds
        || sentimentSource.sentiment_refresh_seconds
        || source.refreshIntervalSeconds
        || source.refresh_interval_seconds
        || source.sentimentRefreshSeconds
        || source.sentiment_refresh_seconds
      ),
      useGemini: parseBoolean(
        sentimentSource.useGemini ?? sentimentSource.use_gemini,
        String(input.sentimentProvider || input.sentiment_provider || "").trim().toLowerCase() === "gemini"
      )
    }
    ,
    questions: {
      ...normalizePageUiConfig({
        source: questionsSource,
        fallback: source,
        defaults: {
          titleText: "Checklist",
          titleSize: "2rem",
          metaSize: "0.82rem",
        showTitle: true,
        showMeta: true,
        showEvidence: true,
        showCardShadow: true,
        showPageHeader: true,
        embedMinHeight: "220px",
        embedMaxHeight: "560px"
        }
      }),
      questionSize: normalizeCssSize(
        questionsSource.questionSize || questionsSource.question_size || source.questionSize || source.question_size || "",
        "1rem"
      ),
      evidenceSize: normalizeCssSize(
        questionsSource.evidenceSize || questionsSource.evidence_size || source.evidenceSize || source.evidence_size || "",
        "1rem"
      ),
      metaFontSize: normalizeCssSize(
        questionsSource.metaFontSize || questionsSource.meta_font_size || source.metaFontSize || source.meta_font_size || "",
        "0.82rem"
      ),
      refreshIntervalSeconds: normalizeRefreshInterval(
        questionsSource.refreshIntervalSeconds
        || questionsSource.refresh_interval_seconds
        || questionsSource.questionsRefreshSeconds
        || questionsSource.questions_refresh_seconds
        || source.questionsRefreshSeconds
        || source.questions_refresh_seconds
      ),
      useGemini: parseBoolean(
        questionsSource.useGemini ?? questionsSource.use_gemini,
        parseBoolean(source.useGemini ?? source.use_gemini, true)
      ),
      clientQuestionsUseGemini: parseBoolean(
        questionsSource.clientQuestionsUseGemini ?? questionsSource.client_questions_use_gemini,
        true
      ),
      clientQuestionsRefreshSeconds: Math.max(5, parseInt(
        questionsSource.clientQuestionsRefreshSeconds
        || questionsSource.client_questions_refresh_seconds
        || 30
      ) || 30),
      showCardShadow: parseBoolean(
        questionsSource.showCardShadow ?? questionsSource.show_card_shadow,
        parseBoolean(source.showCardShadow ?? source.show_card_shadow, true)
      ),
      items: normalizeQuestionItems(
        questionsSource.items
        || questionsSource.questions
        || source.questionItems
        || source.question_items
        || []
      )
    },
    nextStep: {
      ...normalizePageUiConfig({
        source: nextStepSource,
        fallback: source,
        defaults: {
          titleText: "NextIQ Assistant",
          titleSize: "2rem",
          metaSize: "0.82rem",
          showTitle: true,
          showMeta: true,
          showPageHeader: true,
          embedMinHeight: "220px",
          embedMaxHeight: "280px"
        }
      }),
      refreshIntervalSeconds: normalizeRefreshInterval(
        nextStepSource.refreshIntervalSeconds
        || nextStepSource.refresh_interval_seconds
        || nextStepSource.nextStepRefreshSeconds
        || nextStepSource.next_step_refresh_seconds
        || source.nextStepRefreshSeconds
        || source.next_step_refresh_seconds
      ),
      showCardShadow: parseBoolean(
        nextStepSource.showCardShadow ?? nextStepSource.show_card_shadow,
        parseBoolean(source.showCardShadow ?? source.show_card_shadow, true)
      ),
      useGemini: parseBoolean(
        nextStepSource.useGemini ?? nextStepSource.use_gemini,
        parseBoolean(source.useGemini ?? source.use_gemini, true)
      ),
      liveSize: normalizeCssSize(nextStepSource.liveSize || nextStepSource.live_size || source.liveSize || source.live_size || "", "1rem"),
      badgeSize: normalizeCssSize(nextStepSource.badgeSize || nextStepSource.badge_size || source.badgeSize || source.badge_size || "", "0.82rem"),
      kickerSize: normalizeCssSize(nextStepSource.kickerSize || nextStepSource.kicker_size || source.kickerSize || source.kicker_size || "", "0.86rem"),
      actionTitleSize: normalizeCssSize(nextStepSource.actionTitleSize || nextStepSource.action_title_size || source.actionTitleSize || source.action_title_size || "", "1.6rem"),
      actionTextSize: normalizeCssSize(nextStepSource.actionTextSize || nextStepSource.action_text_size || source.actionTextSize || source.action_text_size || "", "1rem"),
      suggestedLabelSize: normalizeCssSize(nextStepSource.suggestedLabelSize || nextStepSource.suggested_label_size || source.suggestedLabelSize || source.suggested_label_size || "", "0.84rem"),
      suggestedTextSize: normalizeCssSize(nextStepSource.suggestedTextSize || nextStepSource.suggested_text_size || source.suggestedTextSize || source.suggested_text_size || "", "1.35rem"),
      buttonTextSize: normalizeCssSize(nextStepSource.buttonTextSize || nextStepSource.button_text_size || source.buttonTextSize || source.button_text_size || "", "1rem"),
      articleTitleSize: normalizeCssSize(nextStepSource.articleTitleSize || nextStepSource.article_title_size || source.articleTitleSize || source.article_title_size || "", "1rem"),
      articleTextSize: normalizeCssSize(nextStepSource.articleTextSize || nextStepSource.article_text_size || source.articleTextSize || source.article_text_size || "", "0.84rem"),
      chipSize: normalizeCssSize(nextStepSource.chipSize || nextStepSource.chip_size || source.chipSize || source.chip_size || "", "0.84rem"),
      reasonSize: normalizeCssSize(nextStepSource.reasonSize || nextStepSource.reason_size || source.reasonSize || source.reason_size || "", "0.92rem"),
      metaFontSize: normalizeCssSize(nextStepSource.metaFontSize || nextStepSource.meta_font_size || source.metaFontSize || source.meta_font_size || "", "0.8rem")
    }
  };
}

function normalizeQuestionItems(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  if (typeof value === "object" && value) {
    return Object.keys(value)
      .sort()
      .map((key) => String(value[key] || "").trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizePageUiConfig({ source, fallback, defaults }) {
  const normalized = {
    titleText: String(source.titleText || source.title_text || fallback.titleText || fallback.title_text || defaults.titleText || "").trim(),
    showTitle: parseBoolean(source.showTitle, parseBoolean(fallback.showTitle, defaults.showTitle)),
    showMeta: parseBoolean(source.showMeta, parseBoolean(fallback.showMeta, defaults.showMeta)),
    showPageHeader: parseBoolean(source.showPageHeader, parseBoolean(fallback.showPageHeader, defaults.showPageHeader)),
    titleSize: normalizeCssSize(source.titleSize || source.title_size || fallback.titleSize || fallback.title_size || "", defaults.titleSize),
    metaSize: normalizeCssSize(source.metaSize || source.meta_size || fallback.metaSize || fallback.meta_size || "", defaults.metaSize),
    embedMinHeight: normalizeCssSize(source.embedMinHeight || source.embed_min_height || fallback.embedMinHeight || fallback.embed_min_height || "", defaults.embedMinHeight),
    embedMaxHeight: normalizeCssSize(source.embedMaxHeight || source.embed_max_height || fallback.embedMaxHeight || fallback.embed_max_height || "", defaults.embedMaxHeight)
  };

  const supportsEvidence = Object.prototype.hasOwnProperty.call(defaults, "showEvidence")
    || Object.prototype.hasOwnProperty.call(source, "showEvidence")
    || Object.prototype.hasOwnProperty.call(source, "show_evidence")
    || Object.prototype.hasOwnProperty.call(fallback, "showEvidence")
    || Object.prototype.hasOwnProperty.call(fallback, "show_evidence");

  if (supportsEvidence) {
    normalized.showEvidence = parseBoolean(
      source.showEvidence ?? source.show_evidence,
      parseBoolean(fallback.showEvidence ?? fallback.show_evidence, defaults.showEvidence)
    );
  }

  return normalized;
}

function normalizeKbIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeDomain(value) {
  const domain = String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  return domain;
}

function getDomainFromUrl(value) {
  try {
    return new URL(value).host;
  } catch (error) {
    return "";
  }
}

function buildWorkitemApiUrl(domain) {
  const normalizedDomain = sanitizeDomain(domain);
  if (!normalizedDomain) {
    return "";
  }

  return `https://${normalizedDomain}/users/api/workitems`;
}

function buildAgentChatApiUrl(domain) {
  const normalizedDomain = sanitizeDomain(domain);
  if (!normalizedDomain) {
    return "";
  }

  return `https://${normalizedDomain}/chats/api/agent/chats`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map(stripUndefinedDeep)
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const cleaned = {};

    for (const [key, item] of Object.entries(value)) {
      const normalizedItem = stripUndefinedDeep(item);
      if (normalizedItem !== undefined) {
        cleaned[key] = normalizedItem;
      }
    }

    return cleaned;
  }

  return value === undefined ? undefined : value;
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }

  return fallback;
}

function parseInteger(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return fallback;
}

function normalizeJsonObject(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch (error) {
      return undefined;
    }
  }

  return value && typeof value === "object" ? value : undefined;
}

function normalizeCssSize(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeRefreshInterval(value) {
  const parsed = Number(value || 30);
  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.max(5, Math.min(3600, Math.round(parsed)));
}

function normalizeSentimentLayout(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "adaptive" || normalized === "compact" || normalized === "wide") {
    return normalized;
  }

  return "centered";
}

function normalizeSentimentStylePreset(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "split" || normalized === "split-footer-top" || normalized === "dual-panels") {
    return normalized;
  }

  return "stacked";
}

function normalizeSentimentProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "gemini" ? "gemini" : "heuristic";
}

function normalizeSummaryAgenticConfig(input) {
  const src = input || {};
  const VALID_PROVIDERS = ["claude", "gemini", "openai"];
  return {
    enabled: src.enabled !== false,
    aiProvider: VALID_PROVIDERS.includes(src.aiProvider) ? src.aiProvider : "claude",
    aiModel: String(src.aiModel || "").trim(),
    aiPrompt: String(src.aiPrompt || "").trim(),
    cacheSeconds: Math.max(0, parseInt(src.cacheSeconds ?? 1800) || 1800),
    dataSources: normalizeSummaryDataSources(src.dataSources || []),
    widgetLibrary: Array.isArray(src.widgetLibrary) ? src.widgetLibrary : [],
    activeLayout: Array.isArray(src.activeLayout?.sections) && src.activeLayout.sections.length
      ? { sections: src.activeLayout.sections.map((s) => ({
          id: String(s.id || ""),
          title: String(s.title || ""),
          icon: String(s.icon || "📄"),
          type: String(s.type || "kv"),
          placement: String(s.placement || "right"),
          fields: Array.isArray(s.fields) ? s.fields : []
        })), generatedAt: src.activeLayout.generatedAt || null }
      : null,
    hubspot: {
      enabled: src.hubspot?.enabled === true,
      objects: Array.isArray(src.hubspot?.objects)
        ? src.hubspot.objects.filter((o) => ["contacts","deals","tickets","calls","notes"].includes(o))
        : ["contacts","deals","tickets","calls"]
    }
  };
}

function normalizePulseFormsConfig(input) {
  const src = input || {};
  const VALID_PROVIDERS = ["claude", "gemini", "openai"];
  const VALID_MODES = ["query", "submit", "both"];
  return {
    enabled: src.enabled !== false,
    mode: VALID_MODES.includes(src.mode) ? src.mode : "query",
    aiProvider: VALID_PROVIDERS.includes(src.aiProvider) ? src.aiProvider : "claude",
    aiModel: String(src.aiModel || "").trim(),
    aiPrompt: String(src.aiPrompt || "").trim(),
    formFields: normalizePulseFormsFields(src.formFields || []),
    dataSources: normalizePulseFormsDataSources(src.dataSources || []),
    activeLayout: Array.isArray(src.activeLayout?.sections) && src.activeLayout.sections.length
      ? { sections: src.activeLayout.sections.map((s) => ({
          id: String(s.id || ""),
          title: String(s.title || ""),
          type: String(s.type || "form"),
          placement: String(s.placement || "main"),
          fields: Array.isArray(s.fields) ? s.fields : []
        })), generatedAt: src.activeLayout.generatedAt || null }
      : null
  };
}

function normalizePulseFormsFields(fields) {
  if (!Array.isArray(fields)) return [];
  const VALID_TYPES = ["text", "textarea", "number", "phone", "email", "date", "select", "checkbox"];
  return fields
    .map((field) => {
      const id = String(field.id || field.name || field.label || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const label = String(field.label || field.name || field.id || "").trim();
      return {
        id,
        label,
        type: VALID_TYPES.includes(String(field.type || "text")) ? String(field.type || "text") : "text",
        required: field.required === true,
        options: String(field.options || "").trim()
      };
    })
    .filter((field) => field.id && field.label);
}

function normalizePulseFormsDataSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((src) => ({
      id: String(src.id || crypto.randomUUID()).trim(),
      name: String(src.name || "").trim(),
      mode: ["query", "submit"].includes(String(src.mode || "query")) ? String(src.mode || "query") : "query",
      url: String(src.url || "").trim(),
      method: ["GET", "POST", "PATCH"].includes(String(src.method || "GET").toUpperCase())
        ? String(src.method || "GET").toUpperCase()
        : "GET",
      headersJson: String(src.headersJson || "{}").trim(),
      bodyTemplate: String(src.bodyTemplate || "").trim(),
      enabled: src.enabled !== false,
      fixedParams: String(src.fixedParams || "").trim(),
      description: String(src.description || "").trim(),
      fieldMappings: sanitizeStringMapping(src.fieldMappings || {})
    }))
    .filter((src) => src.url);
}

function normalizeSummaryDataSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((src) => ({
      id: String(src.id || crypto.randomUUID()).trim(),
      name: String(src.name || "").trim(),
      url: String(src.url || "").trim(),
      method: ["GET", "POST"].includes(String(src.method || "GET").toUpperCase())
        ? String(src.method || "GET").toUpperCase()
        : "GET",
      headersJson: String(src.headersJson || "{}").trim(),
      bodyTemplate: String(src.bodyTemplate || "").trim(),
      selectedFields: Array.isArray(src.selectedFields) ? src.selectedFields.map(String) : [],
      enabled: src.enabled !== false,
      testPhone: String(src.testPhone || "").trim(),
      fixedParams: String(src.fixedParams || "").trim(),
      description: String(src.description || "").trim(),
      suggestions: Array.isArray(src.suggestions) ? src.suggestions : []
    }))
    .filter((src) => src.url);
}

function normalizeLanguage(value) {
  return String(value || "").trim().toLowerCase() === "es" ? "es" : "en";
}

function sanitizeFirestorePrefix(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "nextiq";
}

function isAuthorizedAdmin(req) {
  // Primary: session cookie
  if (getSessionFromRequest(req)) return true;

  // Legacy fallback: X-Admin-Password header (kept for backward compatibility)
  if (!ADMIN_PASSWORD) return false;
  const headerPassword = String(req.headers["x-admin-password"] || "").trim();
  if (headerPassword && headerPassword === ADMIN_PASSWORD) return true;

  // Legacy fallback: HTTP Basic auth
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const password = separator >= 0 ? decoded.slice(separator + 1) : "";
    return password === ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  if (Buffer.isBuffer(req.rawBody)) {
    try {
      return Promise.resolve(JSON.parse(req.rawBody.toString("utf8") || "{}"));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function throwConfig(message) {
  const error = new Error(message);
  error.code = "CONFIG";
  throw error;
}

async function fetchWorkitem(config, workitemId) {
  const headers = {
    "Authorization": config.token
  };

  if (config.cookie) {
    headers["Cookie"] = config.cookie;
  }

  if (!config.workitemApiUrl) {
    throwConfig(`Campaign "${config.id}" is missing a workitem API URL.`);
  }

  const upstream = await fetch(config.workitemApiUrl, {
    method: "GET",
    headers
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    const tok = String(config.token || "");
    const tokenHint = tok.slice(0, 12) + "..." + tok.slice(-12);
    console.error(`[fetchWorkitem] Thrio ${upstream.status} | token=${tokenHint} | len=${tok.length}`);
    throw new Error(`Workitem API returned ${upstream.status}: ${detail.slice(0, 120)}`);
  }

  const payload = await upstream.json();
  const objects = Array.isArray(payload?.objects) ? payload.objects : [];
  const workitem = objects.find((item) => {
    return String(item?.workitemId || "").trim() === workitemId
      || String(item?._id || "").trim() === workitemId;
  });

  if (!workitem) {
    throwConfig(`Workitem "${workitemId}" was not found for campaign "${config.id}".`);
  }

  return workitem;
}

async function fetchWorkitems(config) {
  const headers = {
    "Authorization": config.token
  };

  if (config.cookie) {
    headers["Cookie"] = config.cookie;
  }

  if (!config.workitemApiUrl) {
    throwConfig(`Campaign "${config.id}" is missing a workitem API URL.`);
  }

  const upstream = await fetch(config.workitemApiUrl, {
    method: "GET",
    headers
  });

  if (!upstream.ok) {
    throw new Error(`Workitem API returned ${upstream.status}.`);
  }

  const payload = await upstream.json();
  return Array.isArray(payload?.objects) ? payload.objects : [];
}

async function sendAgentChatMessage(config, input) {
  if (!config.agentChatApiUrl) {
    throwConfig(`Campaign "${config.id}" is missing an agent chat API URL.`);
  }

  const workitemId = String(input.workitemId || "").trim();
  const payload = JSON.stringify({
    fromId: String(input.fromId || "").trim(),
    toId: workitemId,
    type: "USER",
    textMsg: String(input.text || "").trim(),
    priority: false
  });

  const headers = {
    "Authorization": config.token,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  };

  if (config.cookie) {
    headers["Cookie"] = config.cookie;
  }

  const baseUrl = String(config.agentChatApiUrl || "").replace(/\/+$/, "");
  return fetch(`${baseUrl}/${encodeURIComponent(workitemId)}/messages`, {
    method: "POST",
    headers,
    body: payload
  });
}

function latestWorkitemTimestamp(workitem) {
  const messages = getAgentChatSourceMessages(workitem);
  const latestMessageTimestamp = messages.reduce((max, item) => Math.max(max, Number(item?.timestamp || 0)), 0);
  return latestMessageTimestamp || Number(workitem?.timestamp || 0) || 0;
}

function rankWorkitemsForBoard(workitems) {
  return [...(Array.isArray(workitems) ? workitems : [])]
    .sort((left, right) => latestWorkitemTimestamp(right) - latestWorkitemTimestamp(left));
}

async function extractClientMessages(workitem, config) {
  const clientMessages = extractRawClientMessages(workitem);

  if (!clientMessages.length) {
    return [];
  }

  if (config.sentimentProvider === "gemini" && config?.ui?.sentiment?.useGemini !== false) {
    return analyzeMessagesWithGemini(clientMessages, config);
  }

  return clientMessages.map((item) => ({
    ...item,
    sentiment: scoreSentiment(item.text)
  }));
}

function extractRawClientMessages(workitem) {
  const messages = Array.isArray(workitem?.transcriptionMessages) ? workitem.transcriptionMessages : [];

  return messages
    .filter((item) => String(item?.type || "").toUpperCase() === "CLIENT")
    .map((item) => {
      return {
        id: String(item?.id || "").trim(),
        text: String(item?.textMsg || "").trim(),
        fromId: String(item?.fromId || "").trim(),
        timestamp: Number(item?.timestamp || 0)
      };
    })
    .filter((item) => item.text);
}

function extractChecklistMessages(workitem) {
  const messages = Array.isArray(workitem?.transcriptionMessages) ? workitem.transcriptionMessages : [];

  return messages
    .map((item) => {
      const type = String(item?.type || "").trim().toUpperCase();
      if (type !== "CLIENT" && type !== "USER") {
        return null;
      }

      return {
        id: String(item?.id || "").trim(),
        text: String(item?.textMsg || "").trim(),
        fromId: String(item?.fromId || "").trim(),
        timestamp: Number(item?.timestamp || 0),
        role: type === "CLIENT" ? "client" : "agent",
        type
      };
    })
    .filter((item) => item && item.text);
}

function extractAgentChatMessages(workitem) {
  const messages = getAgentChatSourceMessages(workitem);

  return messages
    .map((item) => {
      const type = String(item?.type || "").trim().toUpperCase();
      if (type !== "CLIENT" && type !== "USER" && type !== "BOT") {
        return null;
      }

      return {
        id: String(item?.id || "").trim(),
        text: String(item?.textMsg || "").trim(),
        fromId: String(item?.fromId || "").trim(),
        timestamp: Number(item?.timestamp || 0),
        role: type === "CLIENT" ? "client" : "agent",
        type
      };
    })
    .filter((item) => item && item.text)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function getAgentChatSourceMessages(workitem) {
  const chatMessages = Array.isArray(workitem?.chatMessages) ? workitem.chatMessages : [];
  if (chatMessages.length) {
    return chatMessages;
  }

  return Array.isArray(workitem?.transcriptionMessages) ? workitem.transcriptionMessages : [];
}

function summarizeAgentChatWorkitem(workitem) {
  const summary = summarizeWorkitem(workitem);
  const messages = extractAgentChatMessages(workitem);
  const lastMessage = messages[messages.length - 1] || null;

  return {
    ...summary,
    latestTimestamp: latestWorkitemTimestamp(workitem),
    lastMessage: lastMessage ? {
      text: lastMessage.text,
      role: lastMessage.role,
      timestamp: lastMessage.timestamp
    } : null,
    unreadCount: Number(workitem?.unreadCount || 0) || 0
  };
}

function inferAgentUserIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  return String(payload?.userId || payload?.user_id || "").trim();
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) {
      return null;
    }

    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function summarizeWorkitem(workitem) {
  const contact = workitem?.contact || {};

  return {
    workitemId: String(workitem?.workitemId || workitem?._id || "").trim(),
    contactName: String(contact?.name || workitem?.name || "").trim(),
    phone: String(contact?.phone || workitem?.to || "").trim(),
    agentUsername: String(workitem?.agentUsername || "").trim(),
    state: String(workitem?.state || "").trim(),
    channelType: String(workitem?.channelType || "").trim(),
    callType: String(workitem?.type || "").trim()
  };
}

function summarizeAgentSentiment(messages) {
  const scores = Array.isArray(messages)
    ? messages.map((item) => Number(item?.sentiment?.score || 0)).filter((value) => Number.isFinite(value))
    : [];

  if (!scores.length) {
    return { score: 0, label: "Neutral", color: "yellow", trend: [0] };
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  let label = "Neutral";
  let color = "yellow";

  if (average <= -0.2) {
    label = "Negative";
    color = "red";
  } else if (average >= 0.2) {
    label = "Positive";
    color = "green";
  }

  return {
    score: Math.max(-1, Math.min(1, average)),
    label,
    color,
    trend: scores.slice(-8)
  };
}

function summarizeCompliance(items) {
  const checklist = Array.isArray(items) ? items : [];
  const total = checklist.length;
  const fulfilled = checklist.filter((item) => item.fulfilled).length;
  const score = total ? Math.round((fulfilled / total) * 100) : 100;
  const missingItems = checklist.filter((item) => !item.fulfilled);

  return {
    score,
    total,
    fulfilled,
    missingItems,
    ok: score >= 80
  };
}

function buildAgentAlerts(summary, sentiment, compliance) {
  const alerts = [];

  if (sentiment.color === "red") {
    alerts.push({
      tone: "high",
      label: "Negative sentiment",
      detail: "Customer sentiment is below the safe threshold."
    });
  }

  for (const item of compliance.missingItems.slice(0, 2)) {
    alerts.push({
      tone: "warning",
      label: "Script compliance",
      detail: item.question
    });
  }

  if (!compliance.ok && !alerts.length) {
    alerts.push({
      tone: "warning",
      label: "Compliance below target",
      detail: `${summary.agentUsername || "Agent"} is below the script target.`
    });
  }

  return alerts;
}

function summarizeQualityBoard(agents) {
  const rows = Array.isArray(agents) ? agents : [];
  const averageSentiment = rows.length
    ? rows.reduce((sum, item) => sum + Number(item?.sentiment?.score || 0), 0) / rows.length
    : 0;
  const averageCompliance = rows.length
    ? Math.round(rows.reduce((sum, item) => sum + Number(item?.compliance?.score || 0), 0) / rows.length)
    : 100;
  const activeAlerts = rows.reduce((sum, item) => sum + (Array.isArray(item?.alerts) ? item.alerts.length : 0), 0);
  const agentsAtRisk = rows.filter((item) => item?.sentiment?.color === "red" || item?.compliance?.ok === false).length;

  return {
    totalAgents: rows.length,
    averageSentiment: Math.max(-1, Math.min(1, averageSentiment)),
    averageCompliance,
    activeAlerts,
    agentsAtRisk
  };
}

function scoreSentiment(text) {
  const normalized = String(text || "").toLowerCase();
  const negativeSignals = [
    { pattern: "cancel", weight: -2.5 },
    { pattern: "cancelar", weight: -2.5 },
    { pattern: "cancelación", weight: -2.5 },
    { pattern: "dar de baja", weight: -2.6 },
    { pattern: "retirar el servicio", weight: -2.8 },
    { pattern: "no voy a seguir", weight: -2.5 },
    { pattern: "no creo que vaya a seguir", weight: -2.8 },
    { pattern: "no quiero más inconvenientes", weight: -2.2 },
    { pattern: "no me vuelvan a llamar", weight: -2.4 },
    { pattern: "no me vuelvan a marcar", weight: -2.4 },
    { pattern: "estoy enojado", weight: -2.8 },
    { pattern: "estoy molesto", weight: -2.5 },
    { pattern: "muy molesto", weight: -2.6 },
    { pattern: "desagradable", weight: -2.1 },
    { pattern: "lamentable", weight: -2.2 },
    { pattern: "descontento", weight: -2.2 },
    { pattern: "terrible", weight: -2.1 },
    { pattern: "horrible", weight: -2.1 },
    { pattern: "awful", weight: -2.1 },
    { pattern: "terrible service", weight: -2.2 },
    { pattern: "bad service", weight: -2.1 },
    { pattern: "problem", weight: -1.2 },
    { pattern: "issue", weight: -1.2 },
    { pattern: "complaint", weight: -1.4 },
    { pattern: "frustrated", weight: -1.8 },
    { pattern: "annoyed", weight: -1.6 },
    { pattern: "angry", weight: -2.2 },
    { pattern: "upset", weight: -1.7 },
    { pattern: "wrong", weight: -1.2 },
    { pattern: "broken", weight: -1.6 },
    { pattern: "hate", weight: -1.8 },
    { pattern: "urgent", weight: -1.1 },
    { pattern: "emergency", weight: -1.4 },
    { pattern: "fail", weight: -1.3 },
    { pattern: "enfadado", weight: -2.4 },
    { pattern: "molesto", weight: -2.0 },
    { pattern: "problema", weight: -1.2 },
    { pattern: "queja", weight: -1.4 },
    { pattern: "frustrado", weight: -1.8 },
    { pattern: "urgente", weight: -1.1 },
    { pattern: "emergencia", weight: -1.4 },
    { pattern: "falla", weight: -1.5 },
    { pattern: "fallo", weight: -1.5 },
    { pattern: "no funciona", weight: -2.2 },
    { pattern: "incidencia", weight: -1.0 }
  ];
  const positiveSignals = [
    { pattern: "good", weight: 1.2 },
    { pattern: "great", weight: 1.4 },
    { pattern: "thanks", weight: 0.7 },
    { pattern: "thank you", weight: 0.8 },
    { pattern: "perfect", weight: 1.4 },
    { pattern: "awesome", weight: 1.5 },
    { pattern: "excellent", weight: 1.6 },
    { pattern: "resolved", weight: 1.5 },
    { pattern: "bien", weight: 0.9 },
    { pattern: "gracias", weight: 0.6 },
    { pattern: "perfecto", weight: 1.4 },
    { pattern: "excelente", weight: 1.6 },
    { pattern: "genial", weight: 1.4 },
    { pattern: "resuelto", weight: 1.5 },
    { pattern: "ok", weight: 0.4 },
    { pattern: "vale", weight: 0.3 }
  ];

  let score = 0;

  for (const signal of negativeSignals) {
    if (normalized.includes(signal.pattern)) {
      score += signal.weight;
    }
  }

  for (const signal of positiveSignals) {
    if (normalized.includes(signal.pattern)) {
      score += signal.weight;
    }
  }

  score = Math.max(-1, Math.min(1, score / 3));

  let color = "yellow";
  let label = "Neutral";

  if (score <= -1) {
    color = "red";
    label = "Negative";
  } else if (score >= 1) {
    color = "green";
    label = "Positive";
  }

  return { color, label, score };
}

async function analyzeMessagesWithGemini(messages, config) {
  if (!config.geminiApiKey) {
    throwConfig(`Campaign "${config.id}" is missing a Gemini API key.`);
  }

  const endpoint = buildGeminiEndpoint(config.geminiApiUrl, config.geminiModel);
  const instruction = config.geminiPrompt || [
    "You analyze customer sentiment from call transcript messages.",
    "Treat explicit frustration, cancellation intent, service complaints, anger, repeated inconvenience, and requests to stop contact as Negative sentiment.",
    "Do not overuse Neutral when the customer is clearly dissatisfied or wants to leave the product/service.",
    "Return strict JSON only.",
    "Return an array with one object per input message.",
    'Each object must include: id, label, color, score.',
    'score must be a number between -1 and 1.',
    'label must be Positive, Neutral, or Negative.',
    'color must be green, yellow, or red.'
  ].join(" ");

  const body = {
    systemInstruction: {
      parts: [{ text: instruction }]
    },
    contents: [
      {
        parts: [
          {
            text: JSON.stringify({
              task: "Classify sentiment for each client message.",
              messages: messages.map((item) => ({ id: item.id, text: item.text }))
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}.`);
  }

  const payload = await response.json();
  const jsonText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!jsonText) {
    throw new Error("Gemini API returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Gemini response was not valid JSON: ${error.message}`);
  }

  const mapped = new Map(
    (Array.isArray(parsed) ? parsed : []).map((item) => [
      String(item?.id || "").trim(),
      {
        color: normalizeSentimentColor(item?.color, item?.label, item?.score),
        label: normalizeSentimentLabel(item?.label, item?.score),
        score: normalizeModelScore(item?.score)
      }
    ])
  );

  return messages.map((item) => ({
    ...item,
    sentiment: mapped.get(item.id) || scoreSentiment(item.text)
  }));
}

function resolveQuestionsConfig(config) {
  return {
    apiKey: config.questionsGeminiApiKey || config.geminiApiKey,
    model: config.questionsGeminiModel || config.geminiModel || "gemini-2.5-flash",
    apiUrl: config.questionsGeminiApiUrl || config.geminiApiUrl || "https://generativelanguage.googleapis.com",
    prompt: config.questionsGeminiPrompt || "",
    items: config.ui?.questions?.items || []
  };
}

async function analyzeChecklistWithGemini(messages, questions, config, questionsConfig) {
  if (!questionsConfig.apiKey) {
    throwConfig(`Campaign "${config.id}" is missing a Questions Gemini API key.`);
  }

  const endpoint = buildGeminiEndpoint(questionsConfig.apiUrl, questionsConfig.model);
  const isSpanish = normalizeLanguage(config?.ui?.shared?.language || "en") === "es";
  const instruction = questionsConfig.prompt || [
    "You validate whether each checklist question has already been satisfied by the conversation transcript of a call.",
    "Return strict JSON only.",
    "Return an array with one object per question.",
    "Each object must include: id, question, fulfilled, color, evidence.",
    "fulfilled must be true or false.",
    "color must be green when fulfilled is true, red when fulfilled is false.",
    isSpanish
      ? "IMPORTANT: You MUST translate the 'question' field into Spanish regardless of the original language. The 'evidence' field must also be written in Spanish."
      : "Write the 'question' and 'evidence' fields in English.",
    "evidence must be a short sentence explaining why.",
    "Use only information explicitly present in the provided transcript messages.",
    "The transcript contains both client and agent messages, with a role field.",
    "You may mark a question as fulfilled if the relevant evidence appears in either the client or the agent messages.",
    "If the transcript does not clearly answer the question, mark fulfilled as false."
  ].join(" ");

  const body = {
    systemInstruction: {
      parts: [{ text: instruction }]
    },
    contents: [
      {
        parts: [
          {
            text: JSON.stringify({
              task: isSpanish
                ? "Evaluate checklist questions against client transcript messages. Translate every 'question' field to Spanish in your response."
                : "Evaluate checklist questions against client transcript messages.",
              questions: questions.map((question, index) => ({
                id: `q${index + 1}`,
                question
              })),
              messages: messages.map((item) => ({
                id: item.id,
                role: item.role,
                fromId: item.fromId,
                text: item.text,
                timestamp: item.timestamp
              }))
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": questionsConfig.apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}.`);
  }

  const payload = await response.json();
  const jsonText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!jsonText) {
    throw new Error("Gemini API returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Gemini response was not valid JSON: ${error.message}`);
  }

  const mapped = new Map(
    (Array.isArray(parsed) ? parsed : []).map((item, index) => [
      String(item?.id || `q${index + 1}`).trim(),
      {
        question: String(item?.question || "").trim(),
        fulfilled: Boolean(item?.fulfilled),
        color: Boolean(item?.fulfilled) ? "green" : "red",
        evidence: String(item?.evidence || "").trim()
      }
    ])
  );

  return questions.map((question, index) => {
    const id = `q${index + 1}`;
    const result = mapped.get(id);

    return {
      id,
      question,
      fulfilled: result ? result.fulfilled : false,
      color: result ? result.color : "red",
      evidence: result?.evidence || "Not confirmed in the client transcript."
    };
  });
}

function analyzeChecklistHeuristically(messages, questions) {
  const transcript = Array.isArray(messages) ? messages : [];
  const fullText = transcript.map((item) => String(item.text || "").toLowerCase()).join(" ");

  return questions.map((question, index) => {
    const normalizedQuestion = String(question || "").toLowerCase();
    let fulfilled = false;
    let evidence = "Not confirmed in the client transcript.";

    if (normalizedQuestion.includes("name") || normalizedQuestion.includes("nombre")) {
      fulfilled = /\bmy name is\b|\bme llamo\b|\bsoy\s+[a-záéíóúñ]/i.test(fullText);
      evidence = fulfilled ? "The transcript includes a customer name reference." : evidence;
    } else if (normalizedQuestion.includes("phone") || normalizedQuestion.includes("tel")) {
      fulfilled = /\b(phone|tel[eé]fono|number|número)\b/.test(fullText) && /\d{3,}/.test(fullText);
      evidence = fulfilled ? "The transcript includes a phone confirmation cue." : evidence;
    } else if (normalizedQuestion.includes("legal") || normalizedQuestion.includes("disclaimer") || normalizedQuestion.includes("texto legal")) {
      fulfilled = /legal|disclaimer|texto legal|terms|conditions|recorded line/.test(fullText);
      evidence = fulfilled ? "The transcript references the legal or disclaimer step." : evidence;
    } else if (normalizedQuestion.includes("issue") || normalizedQuestion.includes("problem") || normalizedQuestion.includes("problema")) {
      fulfilled = /issue|problem|problema|falla|fallo|not working|no funciona|incidencia/.test(fullText);
      evidence = fulfilled ? "The transcript includes the customer's issue or problem statement." : evidence;
    } else if (normalizedQuestion.includes("urgency") || normalizedQuestion.includes("severity") || normalizedQuestion.includes("urgencia")) {
      fulfilled = /urgent|urgente|asap|emergency|emergencia|right now|hoy/.test(fullText);
      evidence = fulfilled ? "The transcript includes urgency or severity cues." : evidence;
    } else if (normalizedQuestion.includes("address") || normalizedQuestion.includes("unit") || normalizedQuestion.includes("dirección")) {
      fulfilled = /address|unit|apt|suite|direcci[oó]n|calle|avenida/.test(fullText);
      evidence = fulfilled ? "The transcript includes an address or unit reference." : evidence;
    } else {
      const keywords = normalizedQuestion
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 3);
      const matched = keywords.filter((item) => fullText.includes(item));
      fulfilled = matched.length >= Math.max(1, Math.min(2, Math.ceil(keywords.length / 3)));
      if (fulfilled) {
        evidence = `The transcript matches checklist keywords: ${matched.slice(0, 3).join(", ")}.`;
      }
    }

    return {
      id: `q${index + 1}`,
      question,
      fulfilled,
      color: fulfilled ? "green" : "red",
      evidence
    };
  });
}

async function buildAgentNextStep(messages, config) {
  if (!Array.isArray(messages) || !messages.length) {
    const spanish = normalizeLanguage(config?.ui?.shared?.language || "en") === "es";
    return {
      actionTitle: spanish ? "Abre la conversación" : "Open the conversation",
      actionDetail: spanish
        ? "Pídele al cliente que explique el problema para poder guiar el siguiente paso."
        : "Ask the customer to explain the issue so you can guide the next step.",
      suggestedPhrase: spanish
        ? "¿Podría contarme qué ocurrió para ayudarle con el siguiente paso?"
        : "Could you tell me what happened so I can help you with the next step?",
      stage: "clarify",
      urgency: "medium",
      confidence: 72,
      reason: spanish
        ? "Aún no hay suficiente transcripción para inferir una acción más específica."
        : "There is not enough transcript yet to infer a more specific action.",
      kbQuery: spanish ? "primer paso para resolver problema" : "troubleshooting first call issue",
      quickActions: spanish ? ["Aclarar", "Guiar", "Siguiente paso"] : ["Clarify", "Guide", "Next step"]
    };
  }

  if (config?.ui?.nextStep?.useGemini === false) {
    return buildHeuristicAgentNextStep(messages, config);
  }

  const questionsConfig = resolveQuestionsConfig(config);
  const apiKey = questionsConfig.apiKey || config.geminiApiKey;
  const model = questionsConfig.model || config.geminiModel || "gemini-2.5-flash";
  const apiUrl = questionsConfig.apiUrl || config.geminiApiUrl || "https://generativelanguage.googleapis.com";

  if (!apiKey) {
    throwConfig(`Campaign "${config.id}" is missing a Gemini API key for next-step guidance.`);
  }

  const endpoint = buildGeminiEndpoint(apiUrl, model);
  const instruction = String(config.nextStepGeminiPrompt || "").trim() || [
    "You are a real-time contact center assistant.",
    "Review the transcript and decide the single best next step the agent should take right now.",
    "The answer must be immediately actionable during a live call.",
    `Write every text field in ${normalizeLanguage(config?.ui?.shared?.language || "en") === "es" ? "Spanish" : "English"}.`,
    "Return strict JSON only.",
    "Fields required: actionTitle, actionDetail, suggestedPhrase, stage, urgency, confidence, reason, quickActions, kbQuery.",
    "actionTitle must be a short imperative phrase of at most 6 words.",
    "actionDetail must be one short sentence describing the next action.",
    "suggestedPhrase must be one natural sentence the agent can say next.",
    "stage must be one of: empathy, clarify, verify, legal, troubleshoot, escalate, close.",
    "urgency must be one of: low, medium, high.",
    "confidence must be a number between 0 and 100.",
    "reason must be a short explanation grounded in the transcript.",
    "quickActions must be an array with 2 to 4 short labels.",
    "kbQuery must be a short search query for a support knowledge base article.",
    "Use only transcript evidence. Do not invent policies or outcomes.",
    "Prefer the most immediate conversational move instead of a long plan."
  ].join(" ");

  const body = {
    systemInstruction: {
      parts: [{ text: instruction }]
    },
    contents: [
      {
        parts: [
          {
            text: JSON.stringify({
              task: "Generate the next-best action for the agent.",
              messages: messages.map((item) => ({
                id: item.id,
                role: item.role,
                text: item.text,
                timestamp: item.timestamp
              }))
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}.`);
  }

  const payload = await response.json();
  const jsonText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!jsonText) {
    throw new Error("Gemini API returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Gemini response was not valid JSON: ${error.message}`);
  }

  return normalizeAgentNextStep(parsed);
}

function normalizeAgentNextStep(input) {
  const stage = normalizeNextStepStage(input?.stage);
  const urgency = normalizeNextStepUrgency(input?.urgency);
  const confidence = Math.max(0, Math.min(100, Number(input?.confidence || 0) || 0));
  const actionTitle = String(input?.actionTitle || "").trim() || "Guide the customer";
  const actionDetail = String(input?.actionDetail || "").trim() || "Use the latest transcript cues to move the conversation one step forward.";
  const suggestedPhrase = String(input?.suggestedPhrase || "").trim() || "Let me help you with the next step right now.";
  const reason = String(input?.reason || "").trim() || "Based on the latest transcript update.";
  const kbQuery = String(input?.kbQuery || actionTitle).trim();
  const quickActions = Array.isArray(input?.quickActions)
    ? input.quickActions.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
    : [];

  return {
    actionTitle,
    actionDetail,
    suggestedPhrase,
    stage,
    urgency,
    confidence,
    reason,
    kbQuery,
    quickActions: quickActions.length ? quickActions : buildFallbackQuickActions(stage)
  };
}

function normalizeNextStepStage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["empathy", "clarify", "verify", "legal", "troubleshoot", "escalate", "close"].includes(normalized)) {
    return normalized;
  }
  return "clarify";
}

function normalizeNextStepUrgency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["low", "medium", "high"].includes(normalized)) {
    return normalized;
  }
  return "medium";
}

function buildFallbackQuickActions(stage) {
  if (stage === "empathy") {
    return ["Empathy", "Clarify", "Reassure"];
  }
  if (stage === "legal") {
    return ["Legal info", "Confirm", "Proceed"];
  }
  if (stage === "verify") {
    return ["Verify", "Recap", "Proceed"];
  }
  if (stage === "troubleshoot") {
    return ["Clarify", "Troubleshoot", "Next step"];
  }
  if (stage === "escalate") {
    return ["Acknowledge", "Escalate", "Set expectation"];
  }
  if (stage === "close") {
    return ["Recap", "Confirm", "Close"];
  }
  return ["Clarify", "Guide", "Next step"];
}

function buildHeuristicAgentNextStep(messages, config) {
  const language = normalizeLanguage(config?.ui?.shared?.language || "en");
  const recentMessages = messages.slice(-6);
  const latestClientMessage = [...recentMessages].reverse().find((item) => item.role === "client") || recentMessages[recentMessages.length - 1];
  const transcriptText = recentMessages.map((item) => item.text.toLowerCase()).join(" ");
  const latestText = String(latestClientMessage?.text || "").toLowerCase();
  const sentiment = scoreSentiment(transcriptText);

  let stage = "clarify";
  let urgency = "medium";
  let actionTitle = language === "es" ? "Aclara el problema" : "Clarify the issue";
  let actionDetail = language === "es"
    ? "Haz una pregunta concreta para entender exactamente qué está fallando antes de avanzar."
    : "Ask a concrete question to understand exactly what is failing before moving forward.";
  let suggestedPhrase = language === "es"
    ? "Quiero ayudarle con esto. ¿Puede decirme exactamente qué está ocurriendo ahora mismo?"
    : "I want to help with this. Can you tell me exactly what is happening right now?";
  let reason = language === "es"
    ? "Todavía hace falta concretar el siguiente paso con base en el problema descrito."
    : "The next step still needs to be narrowed down from the issue being described.";
  let kbQuery = language === "es" ? "aclarar problema del cliente" : "clarify customer issue";

  if (sentiment.score <= -0.45 || /molest|enojad|frustr|angry|upset|cancel|retirar|desagradable|lamentable/.test(transcriptText)) {
    stage = "empathy";
    urgency = "high";
    actionTitle = language === "es" ? "Reconoce la frustración" : "Acknowledge frustration";
    actionDetail = language === "es"
      ? "Primero valida la molestia del cliente y después marca con claridad qué vas a revisar."
      : "First validate the customer's frustration, then clearly state what you will review next.";
    suggestedPhrase = language === "es"
      ? "Entiendo lo frustrante que ha sido esto. Voy a revisar el problema ahora mismo para ayudarle."
      : "I understand how frustrating this has been. I am going to review the issue right now so I can help.";
    reason = language === "es"
      ? "El transcript reciente contiene señales claras de frustración o riesgo de cancelación."
      : "The recent transcript contains clear frustration or cancellation-risk cues.";
    kbQuery = language === "es" ? "manejo cliente molesto y retención" : "handle frustrated customer retention";
  } else if (/legal|disclaimer|texto legal|terms|conditions/.test(transcriptText)) {
    stage = "legal";
    urgency = "medium";
    actionTitle = language === "es" ? "Lee el texto legal" : "Read the legal disclaimer";
    actionDetail = language === "es"
      ? "Da el texto obligatorio antes de continuar con cualquier gestión."
      : "Provide the required legal text before continuing with the case.";
    suggestedPhrase = language === "es"
      ? "Antes de continuar, necesito leerle la información legal correspondiente."
      : "Before we continue, I need to read the relevant legal information.";
    reason = language === "es"
      ? "El contexto sugiere que hace falta completar el paso legal antes de avanzar."
      : "The context suggests the legal step should be completed before moving on.";
    kbQuery = language === "es" ? "texto legal llamada" : "call legal disclaimer";
  } else if (/name|nombre|phone|tel|identity|identidad|confirm/.test(latestText)) {
    stage = "verify";
    urgency = "medium";
    actionTitle = language === "es" ? "Verifica los datos" : "Verify the details";
    actionDetail = language === "es"
      ? "Confirma el dato clave que falta antes de seguir con la resolución."
      : "Confirm the key missing detail before proceeding with the resolution.";
    suggestedPhrase = language === "es"
      ? "Antes de seguir, ¿podría confirmarme ese dato para asegurarme de revisar la cuenta correcta?"
      : "Before we continue, could you confirm that detail so I can review the correct account?";
    reason = language === "es"
      ? "El siguiente movimiento más seguro es validar la información necesaria."
      : "The safest next move is to verify the required information.";
    kbQuery = language === "es" ? "verificacion identidad cliente" : "customer identity verification";
  } else if (/payment|tarjeta|credit|pago|billing|factura/.test(transcriptText)) {
    stage = "troubleshoot";
    urgency = "medium";
    actionTitle = language === "es" ? "Guía la revisión" : "Guide troubleshooting";
    actionDetail = language === "es"
      ? "Lleva al cliente al siguiente chequeo concreto para aislar el fallo."
      : "Guide the customer through the next concrete check to isolate the failure.";
    suggestedPhrase = language === "es"
      ? "Vamos a revisar juntos el siguiente paso para identificar por qué no está funcionando el pago."
      : "Let’s review the next step together to identify why the payment is not working.";
    reason = language === "es"
      ? "El transcript apunta a un problema operativo que requiere diagnóstico."
      : "The transcript points to an operational issue that needs troubleshooting.";
    kbQuery = language === "es" ? "fallo pago tarjeta solucion" : "credit card payment issue troubleshooting";
  }

  const confidence = urgency === "high" ? 88 : stage === "clarify" ? 76 : 82;

  return {
    actionTitle,
    actionDetail,
    suggestedPhrase,
    stage,
    urgency,
    confidence,
    reason,
    kbQuery,
    quickActions: buildFallbackQuickActions(stage).map((item) => localizeQuickAction(item, language))
  };
}

function localizeQuickAction(label, language) {
  if (language !== "es") {
    return label;
  }

  const mapping = {
    Empathy: "Empatía",
    Clarify: "Aclarar",
    Reassure: "Tranquilizar",
    "Legal info": "Info legal",
    Confirm: "Confirmar",
    Proceed: "Continuar",
    Verify: "Verificar",
    Recap: "Resumir",
    Troubleshoot: "Revisar",
    "Next step": "Siguiente paso",
    Acknowledge: "Reconocer",
    Escalate: "Escalar",
    "Set expectation": "Alinear expectativa",
    Close: "Cerrar",
    Guide: "Guiar"
  };

  return mapping[label] || label;
}

function createTranscriptSignature(messages) {
  const source = Array.isArray(messages)
    ? messages.map((item) => `${item.id || ""}|${item.role || ""}|${item.timestamp || 0}|${item.text || ""}`).join("||")
    : "";

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }

  return `${Array.isArray(messages) ? messages.length : 0}:${Math.abs(hash)}`;
}

async function fetchRecommendedArticle(config, message, workitemId) {
  const query = String(message || "").trim();
  if (!query || !config.requestKbIds?.length) {
    return null;
  }

  try {
    const upstream = await fetchPredictionUpstream(config, {
      message: query,
      workitem_id: workitemId || ""
    });

    if (!upstream.ok) {
      return null;
    }

    const payload = await upstream.json().catch(() => null);
    const article = payload?.faq_response?.articles?.[0];
    if (!article) {
      return null;
    }

    return {
      title: String(article.title || "").trim(),
      description: String(article.description || article.file_type || "").trim(),
      url: String(article.resource_url || article.url || "").trim()
    };
  } catch (error) {
    return null;
  }
}

function buildGeminiEndpoint(baseUrl, model) {
  const normalizedBase = String(baseUrl || "https://generativelanguage.googleapis.com").trim().replace(/\/+$/, "");
  const normalizedModel = String(model || "gemini-2.5-flash").trim().replace(/^models\//, "");
  return `${normalizedBase}/v1beta/models/${normalizedModel}:generateContent`;
}

function normalizeModelScore(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, parsed));
}

function normalizeSentimentLabel(label, score) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "positive") {
    return "Positive";
  }
  if (normalized === "negative") {
    return "Negative";
  }
  if (normalized === "neutral") {
    return "Neutral";
  }

  if (Number(score) >= 0.2) {
    return "Positive";
  }
  if (Number(score) <= -0.2) {
    return "Negative";
  }
  return "Neutral";
}

function normalizeSentimentColor(color, label, score) {
  const normalized = String(color || "").trim().toLowerCase();
  if (normalized === "green" || normalized === "yellow" || normalized === "red") {
    return normalized;
  }

  const normalizedLabel = String(label || "").trim().toLowerCase();
  if (normalizedLabel === "positive") {
    return "green";
  }
  if (normalizedLabel === "negative") {
    return "red";
  }
  if (normalizedLabel === "neutral") {
    return "yellow";
  }

  if (Number(score) >= 0.2) {
    return "green";
  }
  if (Number(score) <= -0.2) {
    return "red";
  }
  return "yellow";
}

// ── Wieland Dialer ─────────────────────────────────────────────────────────

async function readWielandContactsLocal() {
  if (firestore) {
    const snapshot = await firestore.collection(WIELAND_CONTACTS_COLLECTION).get();
    const result = {};
    for (const doc of snapshot.docs) result[doc.id] = doc.data();
    return result;
  }
  if (!fs.existsSync(WIELAND_CONTACTS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(WIELAND_CONTACTS_FILE, "utf8")); } catch { return {}; }
}

async function writeWielandContactLocal(externalId, fields) {
  const clean = {
    union_eligible: Boolean(fields.union_eligible),
    active_status: String(fields.active_status || "Active"),
    do_not_call: Boolean(fields.do_not_call),
    seniority_years: Number(fields.seniority_years) || 0,
    seniority_start_date: String(fields.seniority_start_date || ""),
    plant_location: String(fields.plant_location || ""),
    trade: String(fields.trade || ""),
    shift_type: String(fields.shift_type || "")
  };
  if (firestore) {
    await firestore.collection(WIELAND_CONTACTS_COLLECTION).doc(externalId).set(clean, { merge: true });
    return;
  }
  const all = await readWielandContactsLocal();
  all[externalId] = { ...(all[externalId] || {}), ...clean };
  fs.writeFileSync(WIELAND_CONTACTS_FILE, `${JSON.stringify(all, null, 2)}\n`, "utf8");
}

function calculateSeniorityYears(startDate, fallbackYears = 0) {
  const normalized = String(startDate || "").trim();
  if (!normalized) return Number(fallbackYears) || 0;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return Number(fallbackYears) || 0;
  const years = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years > 0 ? Math.floor(years) : 0;
}

function isUnionZip(value) {
  const normalized = String(value == null ? "" : value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y";
}

function calcCallPriority(contacts) {
  // Active + no DNC qualifies — both union and non-union
  const eligible = contacts.filter(c =>
    c.active_status === "Active" &&
    c.do_not_call === false
  );
  // Union first, then non-union; within each group by seniority descending
  eligible.sort((a, b) => {
    if (Boolean(b.union_eligible) !== Boolean(a.union_eligible))
      return Boolean(b.union_eligible) ? 1 : -1;
    return (b.seniority_years || 0) - (a.seniority_years || 0);
  });
  const eligibleIds = new Set(eligible.map(c => c.externalId || c.id || c._id));
  const maxPriority = eligible.length;
  // Highest number = highest priority (position 0 gets maxPriority)
  eligible.forEach((c, i) => { c.call_priority = maxPriority - i; });
  contacts.forEach(c => {
    if (!eligibleIds.has(c.externalId || c.id || c._id)) c.call_priority = 9999;
  });
  return contacts;
}

const DEFAULT_WIELAND_WIDGET_TO_CONTACT_MAP = {
  firstName: "firstName",
  lastName: "lastName",
  phone: "phone",
  mobile: "mobile",
  externalId: "externalId",
  shiftType: "shift_type",
  trade: "trade",
  plantLocation: "plant_location",
  seniorityStartDate: "seniority_start_date",
  seniorityYears: "seniority_years",
  status: "active_status",
  priority: "call_priority",
  unionEligible: "union_eligible",
  doNotCall: "do_not_call",
  email: "email",
  name: "name",
  objectType: "objectType"
};

function getEffectiveWielandWidgetMap(campaign) {
  return {
    ...DEFAULT_WIELAND_WIDGET_TO_CONTACT_MAP,
    ...sanitizeStringMapping(campaign?.wieland?.widgetToContactMap || {})
  };
}

function normalizeWielandContactInput(input, campaign) {
  const body = input && typeof input === "object" ? input : {};
  const widgetMap = getEffectiveWielandWidgetMap(campaign);
  const normalized = { ...body };
  for (const [widgetField, contactField] of Object.entries(widgetMap)) {
    if (!contactField) continue;
    if (body[widgetField] !== undefined) {
      normalized[contactField] = body[widgetField];
      if (contactField !== widgetField && body[contactField] === undefined) delete normalized[widgetField];
    }
  }
  return normalized;
}

function buildLeadPayloadFromContact(contact, listId, contactToList = {}, options = {}) {
  const fullName = contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  const includeBaseFields = options.includeBaseFields !== false;
  // nextDialAt must be in the future relative to createdAt to avoid NCC validation errors
  const nextDialAt = new Date(Date.now() + 60000).toISOString();
  const lead = includeBaseFields
    ? {
        name: fullName,
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        phone: contact.phone || "",
        outboundListId: listId,
        nextDialAt
      }
    : {
        outboundListId: listId,
        nextDialAt
      };
  for (const [contactField, listColumn] of Object.entries(contactToList || {})) {
    const value = contact?.[contactField];
    if (!listColumn || value === undefined || value === null || value === "") continue;
    const columns = Array.isArray(listColumn) ? listColumn : [listColumn];
    for (const col of columns) {
      if (!col) continue;
      if (lead[col] === undefined || lead[col] === null || lead[col] === "") {
        lead[col] = value;
      }
    }
  }
  return lead;
}

function generateWielandCSV(contacts, contactToList = {}, nccFieldmapping = null) {
  const headers = Array.isArray(nccFieldmapping?.fileFields) && nccFieldmapping.fileFields.length
    ? nccFieldmapping.fileFields
    : ["name", "phone", ...Object.values(contactToList || {}).flatMap((v) => Array.isArray(v) ? v : [v]).filter(Boolean)];
  const uniqueHeaders = [...new Set(headers)];
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = [uniqueHeaders.join(",")];
  for (const c of contacts) {
    const lead = buildLeadPayloadFromContact(c, "", contactToList);
    rows.push(uniqueHeaders.map((header) => esc(lead[header] ?? "")).join(","));
  }
  return rows.join("\n");
}

function generateCSVFromUploadedRows(rows, uploadedHeaders = []) {
  const headerSet = new Set((uploadedHeaders || []).map((header) => String(header || "").trim()).filter(Boolean));
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (String(key || "").trim()) headerSet.add(String(key).trim());
    }
  }
  const headers = [...headerSet];
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...(rows || []).map((row) => headers.map((header) => esc(row?.[header] ?? "")).join(","))
  ].join("\n");
}

function normalizeOutboundListUploadStatus(list = {}) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (list[key] !== undefined && list[key] !== null && list[key] !== "") return list[key];
    }
    return "";
  };
  return {
    status: String(pick("status", "uploadStatus", "loadStatus") || "").trim(),
    totalInFile: Number(pick("totalInFile", "total_in_file", "total") || 0),
    totalFailed: Number(pick("totalFailed", "total_failed", "failed") || 0),
    totalDuplicates: Number(pick("totalDuplicates", "total_duplicates", "duplicates") || 0),
    totalInserted: Number(pick("totalInserted", "total_inserted", "inserted", "totalConverted") || 0),
    totalScrubbed: Number(pick("totalScrubbed", "total_scrubbed", "scrubbed") || 0),
    duration: pick("duration", "uploadDuration", "loadDuration") || "",
    createdAt: pick("createdAt", "created_at", "created") || ""
  };
}

function buildWielandUploadLogBase({
  campaignKey,
  listName,
  listDescription,
  listId,
  isSMS,
  uploadFileName,
  selectedFieldmapping,
  contactToList,
  configuredContactToList,
  csvLines,
  initialLeads,
  eligible,
  listPayload,
  source,
  uploadFileContentType = "text/csv",
  uploadFileSource = "generated-csv",
  uploadedHeaders = []
}) {
  const endpointBase = "data/api/types";
  return {
    campaignKey,
    listName,
    listDescription,
    listId: listId || "",
    isSMS,
    source,
    uploadFileName,
    selectedFieldmappingId: selectedFieldmapping?._id || selectedFieldmapping?.fieldmappingsId || selectedFieldmapping?.id || "",
    selectedFieldmappingName: selectedFieldmapping?.name || selectedFieldmapping?.localizations?.name?.en?.value || "",
    contactToListSource: Object.keys(configuredContactToList || {}).length ? "campaign.wieland.contactToListMap" : "campaign.expansions.fieldMappingsId.fields",
    contactToList,
    listPayload,
    requests: {
      createOutboundList: {
        method: "POST",
        endpoint: `${endpointBase}/outboundlist`,
        contentType: "multipart/form-data",
        multipartFields: {
          object: listPayload,
          file: {
            fileName: uploadFileName,
            contentType: uploadFileContentType,
            source: uploadFileSource,
            previewField: "csvPreview"
          }
        }
      }
    },
    uploadedHeaders,
    csvHeaders: csvLines[0] ? csvLines[0].split(",") : [],
    csvPreview: csvLines.slice(0, 12).join("\n"),
    csvRowCount: Math.max(0, csvLines.length - 1),
    initialLeadCount: initialLeads.length,
    eligibleCount: eligible.length,
    firstInputLead: initialLeads[0] ? {
      firstName: initialLeads[0].firstName || "",
      lastName: initialLeads[0].lastName || "",
      name: initialLeads[0].name || "",
      phone: initialLeads[0].phone || "",
      mobile: initialLeads[0].mobile || "",
      email: initialLeads[0].email || "",
      externalId: initialLeads[0].externalId || "",
      fax: initialLeads[0].fax || "",
      contactId: initialLeads[0].contactId || initialLeads[0]._id || ""
    } : null
  };
}

async function saveWielandUploadLog(log) {
  try {
    const clean = stripUndefinedDeep({
      ...log,
      createdAt: new Date().toISOString()
    });
    if (firestore) {
      const ref = await firestore.collection(WIELAND_UPLOAD_LOGS_COLLECTION).add(clean);
      return ref.id;
    }
    let logs = [];
    if (fs.existsSync(WIELAND_UPLOAD_LOGS_FILE)) {
      try { logs = JSON.parse(fs.readFileSync(WIELAND_UPLOAD_LOGS_FILE, "utf8")); } catch { logs = []; }
    }
    const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    logs.push({ id, ...clean });
    logs = logs.slice(-100);
    fs.writeFileSync(WIELAND_UPLOAD_LOGS_FILE, `${JSON.stringify(logs, null, 2)}\n`, "utf8");
    return id;
  } catch (err) {
    console.warn("[wieland/upload-log] failed to save log:", err.message);
    return null;
  }
}

async function readWielandUploadLogs(campaignKey, listId = "") {
  if (firestore) {
    const snapshot = await firestore.collection(WIELAND_UPLOAD_LOGS_COLLECTION).where("campaignKey", "==", campaignKey).get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((log) => !listId || log.listId === listId)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  if (!fs.existsSync(WIELAND_UPLOAD_LOGS_FILE)) return [];
  let logs = [];
  try { logs = JSON.parse(fs.readFileSync(WIELAND_UPLOAD_LOGS_FILE, "utf8")); } catch { logs = []; }
  return logs
    .filter((log) => log.campaignKey === campaignKey && (!listId || log.listId === listId))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function fetchOutboundListAfterCreate(nccConfig, listId) {
  let lastResult = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    lastResult = await nccFetch(nccConfig, `/outboundlist/${encodeURIComponent(listId)}`);
    if (!lastResult.ok) return lastResult;
    const status = String(lastResult.data?.status || "").toUpperCase();
    if (status && status !== "UPLOADING") return lastResult;
    if (attempt < 5) await sleep(600 * attempt);
  }
  return lastResult;
}

function sanitizeStringMapping(mapping) {
  const clean = {};
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return clean;
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof key !== "string") continue;
    if (typeof value === "string") { clean[key] = value; continue; }
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) { clean[key] = value; continue; }
  }
  return clean;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWielandContactFingerprints(contact) {
  const fingerprints = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized) fingerprints.add(normalized);
  };
  add(contact?.externalId);
  add(contact?.email);
  add(contact?.phone);
  add(contact?.mobile);
  add(`${contact?.firstName || ""} ${contact?.lastName || ""}`.trim());
  add(contact?.name);
  return fingerprints;
}

function buildWielandLeadFingerprints(lead) {
  return buildWielandContactFingerprints(lead);
}

function findMatchingContactForLead(lead, contacts) {
  const leadFingerprints = buildWielandLeadFingerprints(lead);
  if (!leadFingerprints.size) return null;
  for (const contact of contacts || []) {
    const contactFingerprints = buildWielandContactFingerprints(contact);
    for (const fingerprint of leadFingerprints) {
      if (contactFingerprints.has(fingerprint)) return contact;
    }
  }
  return null;
}

function selectBestNccContactFieldmapping(fieldmappings, savedContactToList = {}) {
  const preferredSize = Object.keys(savedContactToList || {}).length;
  return (fieldmappings || [])
    .filter((item) => item?.schema === "contact")
    .sort((a, b) => {
      const aFields = Object.keys(a?.fields || {}).length;
      const bFields = Object.keys(b?.fields || {}).length;
      const aScore = preferredSize && aFields >= preferredSize ? 1 : 0;
      const bScore = preferredSize && bFields >= preferredSize ? 1 : 0;
      return bScore - aScore || bFields - aFields;
    })[0] || null;
}

function buildNccAuthHeader(nccConfig) {
  const type = nccConfig.nccAuthType || "token";
  const cred = nccConfig.nccCredential || "";
  if (type === "key" && cred) return { "Authorization": `Bearer ${cred}` };
  if (type === "token" && cred) return { "Authorization": cred };
  return {};
}

async function nccFetch(nccConfig, nccPath, method = "GET", body = null) {
  const baseUrl = (nccConfig.nccBaseUrl || "https://mancity.thrio.io/data/api/types").replace(/\/$/, "");
  const url = `${baseUrl}${nccPath}`;
  const opts = {
    method,
    headers: { ...buildNccAuthHeader(nccConfig), "Content-Type": "application/json" }
  };
  if (body !== null && method !== "GET") opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function mergeWielandContacts(rawContacts, localMap) {
  return rawContacts.map(c => {
    const key = c.externalId || c.id || c._id || "";
    const local = localMap[key] || {};
    return {
      ...c,
      union_eligible: local.union_eligible !== undefined ? local.union_eligible : isUnionZip(c.zip),
      active_status: local.active_status || c.state || "Active",
      do_not_call: local.do_not_call !== undefined ? local.do_not_call : false,
      seniority_start_date: local.seniority_start_date || c.dob || "",
      seniority_years: calculateSeniorityYears(local.seniority_start_date || c.dob || "", local.seniority_years || 0),
      plant_location: local.plant_location || c.addresss || "",
      trade: local.trade || c.city || "",
      shift_type: local.shift_type || ""
    };
  });
}

async function syncWielandContactFaxPriority(nccConfig) {
  const contactsResult = await nccFetch(nccConfig, "/contact");
  if (!contactsResult.ok) return contactsResult;

  const rawContacts = Array.isArray(contactsResult.data)
    ? contactsResult.data
    : (contactsResult.data?.objects || contactsResult.data?.results || contactsResult.data?.data || []);
  const localMap = await readWielandContactsLocal();
  const contacts = await mergeWielandContacts(rawContacts, localMap);
  calcCallPriority(contacts);

  for (const contact of contacts) {
    const contactId = contact?.externalId || contact?.id || contact?._id || contact?.contactId || "";
    if (!contactId) continue;
    const nextFax = contact.call_priority >= 9999 ? "" : String(contact.call_priority);
    if (String(contact.fax || "") === nextFax) continue;
    const patchResult = await nccFetch(nccConfig, `/contact/${contactId}`, "PATCH", { fax: nextFax });
    if (!patchResult.ok) return patchResult;
  }

  return { ok: true, status: 200, data: { ok: true } };
}

async function handleWieland(req, res, url) {
  // ── Resolve campaign first so we can check its auth mode ─────────────────
  const campaignParam = url.searchParams.get("campaign") || "";
  if (!campaignParam) {
    sendJson(res, 400, { error: "Missing ?campaign= parameter." });
    return;
  }
  const campaigns = await readCampaigns();
  const campaign = campaigns.find(c => c.id === campaignParam);
  if (!campaign) {
    sendJson(res, 404, { error: `Campaign "${campaignParam}" not found.` });
    return;
  }
  const nccAuthType = campaign.wieland?.nccAuthType || "token";

  // No auth required for Wieland routes — access controlled at the NCC/embed level
  const nccCredential = campaign.wielandNccCredential || (nccAuthType === "token" ? campaign.token : "");
  if (nccAuthType !== "none" && !nccCredential) {
    sendJson(res, 400, { error: `Campaign "${campaign.id}" has no NCC credentials configured. Add them in Admin.` });
    return;
  }

  const nccConfig = {
    nccBaseUrl: `https://${campaign.domain}/data/api/types`,
    nccAuthType,
    nccCredential,
    campaignId: campaign.wieland?.nccCampaignId || "",
    slotsNeeded: campaign.wieland?.slotsNeeded || 8
  };

  // ── Contacts ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/wieland/contacts") {
    const result = await nccFetch(nccConfig, "/contact");
    if (!result.ok) { sendJson(res, result.status, { error: "NCC API error", details: result.data }); return; }
    const raw = Array.isArray(result.data) ? result.data : (result.data?.objects || result.data?.results || result.data?.data || []);
    const localMap = await readWielandContactsLocal();
    const contacts = await mergeWielandContacts(raw, localMap);
    calcCallPriority(contacts);
    sendJson(res, 200, { contacts });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/wieland/contacts") {
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const normalizedBody = normalizeWielandContactInput(body, campaign);
    const { union_eligible, active_status, do_not_call, seniority_years, seniority_start_date,
            plant_location, trade, shift_type, firstName, lastName, phone, mobile, externalId, email, name } = normalizedBody;
    // Map semantic fields → NCC field names (addresss is NCC's own field name)
    const nccPayload = {
      objectType: "contact",
      firstName, lastName, phone, mobile, externalId, email,
      name: name || `${firstName || ""} ${lastName || ""}`.trim(),
      addresss: plant_location || "",
      city:     trade || "",
      state:    active_status || "Active",
      zip:      union_eligible ? "1" : "0",
      dob:      seniority_start_date || ""
    };
    const result = await nccFetch(nccConfig, "/contact", "POST", nccPayload);
    if (!result.ok) { sendJson(res, result.status, { error: "NCC API error", details: result.data }); return; }
    const nccExternalId = externalId || result.data?.externalId || result.data?.id || result.data?._id;
    if (nccExternalId) {
      await writeWielandContactLocal(nccExternalId, { union_eligible, active_status, do_not_call, seniority_years, seniority_start_date, plant_location, trade, shift_type });
    }
    const syncResult = await syncWielandContactFaxPriority(nccConfig);
    if (!syncResult.ok) {
      sendJson(res, syncResult.status, { error: "Failed to sync contact priorities", details: syncResult.data });
      return;
    }
    sendJson(res, 200, { ok: true, contact: result.data });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/wieland/contacts/migrate-externalid-to-email") {
    const contactsResult = await nccFetch(nccConfig, "/contact");
    if (!contactsResult.ok) {
      sendJson(res, contactsResult.status, { error: "NCC API error", details: contactsResult.data });
      return;
    }
    const rawContacts = Array.isArray(contactsResult.data)
      ? contactsResult.data
      : (contactsResult.data?.objects || contactsResult.data?.results || contactsResult.data?.data || []);

    let inspected = 0;
    let updated = 0;
    let skippedNoSource = 0;
    let skippedAlreadySet = 0;
    const samples = [];

    for (const contact of rawContacts) {
      inspected += 1;
      const contactId = contact?.externalId || contact?.id || contact?._id || contact?.contactId || "";
      const sourceValue = String(contact?.externalId || "").trim();
      const currentEmail = String(contact?.email || "").trim();
      if (!sourceValue) {
        skippedNoSource += 1;
        continue;
      }
      if (currentEmail) {
        skippedAlreadySet += 1;
        continue;
      }
      const patchResult = await nccFetch(nccConfig, `/contact/${contactId}`, "PATCH", { email: sourceValue });
      if (!patchResult.ok) {
        sendJson(res, patchResult.status, {
          error: "Failed to migrate externalId to email",
          details: patchResult.data,
          debug: { contactId, sourceValue, currentEmail }
        });
        return;
      }
      updated += 1;
      if (samples.length < 5) {
        samples.push({
          contactId,
          firstName: contact?.firstName || "",
          lastName: contact?.lastName || "",
          email: sourceValue
        });
      }
    }

    sendJson(res, 200, {
      ok: true,
      inspected,
      updated,
      skippedNoSource,
      skippedAlreadySet,
      samples
    });
    return;
  }

  const contactPatchMatch = url.pathname.match(/^\/api\/wieland\/contacts\/([^/]+)$/);
  if (req.method === "PATCH" && contactPatchMatch) {
    const contactId = contactPatchMatch[1];
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const normalizedBody = normalizeWielandContactInput(body, campaign);
    const { union_eligible, active_status, do_not_call, seniority_years, seniority_start_date,
            plant_location, trade, shift_type, firstName, lastName, phone, mobile, externalId, email, name } = normalizedBody;
    // Only include NCC fields that were actually provided in the request
    const nccPayload = {};
    if (firstName !== undefined)           nccPayload.firstName = firstName;
    if (lastName !== undefined)            nccPayload.lastName  = lastName;
    if (firstName !== undefined || lastName !== undefined || name !== undefined)
      nccPayload.name = name || `${firstName || ""} ${lastName || ""}`.trim();
    if (phone !== undefined)               nccPayload.phone     = phone;
    if (mobile !== undefined)              nccPayload.mobile    = mobile;
    if (email !== undefined)               nccPayload.email     = email;
    if (externalId !== undefined)          nccPayload.externalId = externalId;
    if (plant_location !== undefined)      nccPayload.addresss  = plant_location;
    if (trade !== undefined)               nccPayload.city      = trade;
    if (active_status !== undefined)       nccPayload.state     = active_status;
    if (union_eligible !== undefined)      nccPayload.zip       = union_eligible ? "1" : "0";
    if (seniority_start_date !== undefined) nccPayload.dob      = seniority_start_date;
    const result = await nccFetch(nccConfig, `/contact/${contactId}`, "PATCH", nccPayload);
    if (!result.ok) { sendJson(res, result.status, { error: "NCC API error", details: result.data }); return; }
    const nccExternalId = externalId || contactId;
    await writeWielandContactLocal(nccExternalId, { union_eligible, active_status, do_not_call, seniority_years, seniority_start_date, plant_location, trade, shift_type });
    const syncResult = await syncWielandContactFaxPriority(nccConfig);
    if (!syncResult.ok) {
      sendJson(res, syncResult.status, { error: "Failed to sync contact priorities", details: syncResult.data });
      return;
    }
    sendJson(res, 200, { ok: true, contact: result.data });
    return;
  }

  // ── Lists ────────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/wieland/lists") {
    const campaignResult = nccConfig.campaignId
      ? await nccFetch(nccConfig, `/campaign/${encodeURIComponent(nccConfig.campaignId)}`)
      : { ok: false, status: 400, data: { error: "Campaign ID not configured." } };
    if (campaignResult.ok) {
      const assigned = Array.isArray(campaignResult.data?.lists?.objects) ? campaignResult.data.lists.objects : [];
      const lists = assigned.map((item) => {
        const expanded = item?.expansions?.outboundlistId || {};
        return {
          ...expanded,
          ...item,
          _id: expanded._id || item?.outboundlistId || item?._id || "",
          outboundlistId: expanded.outboundlistId || item?.outboundlistId || expanded._id || "",
          name: expanded.name || expanded.localizations?.name?.en?.value || item?.outboundlistId || "",
          active: expanded.active,
          status: expanded.status,
          count: expanded.totalConverted ?? expanded.totalInFile ?? "",
          uploadStatus: normalizeOutboundListUploadStatus(expanded)
        };
      });
      sendJson(res, 200, { lists });
      return;
    }

    const qs = nccConfig.campaignId ? `?campaignId=${encodeURIComponent(nccConfig.campaignId)}` : "";
    const result = await nccFetch(nccConfig, `/outboundlist${qs}`);
    const lists = result.ok
      ? (Array.isArray(result.data) ? result.data : (result.data?.objects || result.data?.results || result.data?.data || []))
        .map((item) => ({ ...item, uploadStatus: normalizeOutboundListUploadStatus(item) }))
      : [];
    sendJson(res, result.ok ? 200 : result.status, result.ok ? { lists } : { error: "NCC API error", details: result.data });
    return;
  }

  const listGetMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)$/);
  if (req.method === "GET" && listGetMatch && !url.pathname.endsWith("/leads")) {
    const result = await nccFetch(nccConfig, `/outboundlist/${listGetMatch[1]}`);
    sendJson(
      res,
      result.ok ? 200 : result.status,
      result.ok
        ? { list: result.data, uploadStatus: normalizeOutboundListUploadStatus(result.data) }
        : { error: "NCC API error" }
    );
    return;
  }

  const listUploadLogMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)\/upload-log$/);
  if (req.method === "GET" && listUploadLogMatch) {
    const logs = await readWielandUploadLogs(nccConfig.campaignId || campaignParam || "", listUploadLogMatch[1]);
    sendJson(res, 200, { logs, latest: logs[0] || null });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/wieland/upload-logs") {
    const logs = await readWielandUploadLogs(nccConfig.campaignId || campaignParam || "");
    sendJson(res, 200, { logs: logs.slice(0, 50) });
    return;
  }

  const listPatchMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)$/);
  if (req.method === "PATCH" && listPatchMatch) {
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const result = await nccFetch(nccConfig, `/outboundlist/${listPatchMatch[1]}`, "PATCH", { active: body.active });
    sendJson(
      res,
      result.ok ? 200 : result.status,
      result.ok ? { ok: true, list: result.data } : { error: "NCC API error", details: result.data }
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/wieland/lists") {
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const listName = String(body.name || "").trim();
    if (!listName) { sendJson(res, 400, { error: "List name is required." }); return; }
    if (!nccConfig.campaignId) { sendJson(res, 400, { error: "Campaign ID not configured." }); return; }

    // Build contacts + CSV
    const campaignKey = nccConfig.campaignId || campaignParam;
    const contactsResult = await nccFetch(nccConfig, "/contact");
    const raw = contactsResult.ok
      ? (Array.isArray(contactsResult.data) ? contactsResult.data : (contactsResult.data?.objects || contactsResult.data?.results || contactsResult.data?.data || []))
      : [];
    const localMap = await readWielandContactsLocal();
    const contacts = await mergeWielandContacts(raw, localMap);
    calcCallPriority(contacts);
    const eligible = contacts.filter(c => c.call_priority !== 9999);
    const selectedContactIds = Array.isArray(body.selectedContactIds) && body.selectedContactIds.length
      ? new Set(body.selectedContactIds.map(String))
      : null;
    const uploadedLeads = Array.isArray(body.leads)
      ? body.leads.filter((lead) => lead && typeof lead === "object" && Object.values(lead).some((value) => String(value || "").trim()))
      : [];
    const uploadedHeaders = Array.isArray(body.headers)
      ? body.headers.map((header) => String(header || "").trim()).filter(Boolean)
      : [];
    const initialLeads = uploadedLeads.length
      ? uploadedLeads
      : selectedContactIds
      ? eligible.filter(c => {
          const key = c.externalId || c.id || c._id || c.contactId || "";
          return selectedContactIds.has(String(key));
        })
      : eligible.length ? [eligible[0]] : [];
    const fieldmappingsResult = await nccFetch(nccConfig, "/fieldmappings");
    const nccFieldmappings = fieldmappingsResult.ok
      ? (Array.isArray(fieldmappingsResult.data) ? fieldmappingsResult.data : (fieldmappingsResult.data?.objects || fieldmappingsResult.data?.results || fieldmappingsResult.data?.data || []))
      : [];
    const selectedFieldmapping = nccFieldmappings.find((item) => {
      const itemId = item?.fieldmappingsId || item?._id || item?.id || "";
      return item?.schema === "contact" && itemId === String(campaign.wieland?.nccFieldmappingId || "").trim();
    }) || selectBestNccContactFieldmapping(nccFieldmappings);
    if (!selectedFieldmapping) {
      sendJson(res, 400, { error: "No NCC contact field mapping found for this campaign." });
      return;
    }
    const configuredContactToList = sanitizeStringMapping(campaign.wieland?.contactToListMap || {});
    const contactToList = Object.keys(configuredContactToList).length
      ? configuredContactToList
      : sanitizeStringMapping(selectedFieldmapping?.fields || {});
    const csvContent = uploadedLeads.length
      ? generateCSVFromUploadedRows(uploadedLeads, uploadedHeaders)
      : generateWielandCSV(initialLeads, contactToList, selectedFieldmapping);
    const csvLines = csvContent.split("\n");
    const csvHeaders = csvLines[0] ? csvLines[0].split(",") : [];
    const uploadedFileName = String(body.fileName || "").trim();
    const uploadedFileBase64 = String(body.fileBase64 || "").trim();
    const uploadedFileBuffer = uploadedLeads.length && uploadedFileBase64
      ? Buffer.from(uploadedFileBase64, "base64")
      : null;
    const uploadFileContentType = String(body.fileContentType || "").trim()
      || (uploadedFileName.toLowerCase().endsWith(".csv") ? "text/csv" : "application/octet-stream");
    const uploadFileName = String(
      uploadedLeads.length
        ? (uploadedFileName || selectedFieldmapping?.fileName || "contacts.csv")
        : (campaign.wieland?.uploadFileName || selectedFieldmapping?.fileName || "contacts.csv")
    ).trim() || "contacts.csv";

    // Multipart upload
    const listDescription = String(body.description || "").trim();
    const isSMS = body.isSMS === true;
    const listPayload = {
      localizations: {
        name: { en: { language: "en", value: listName } }
      },
      campaignId: nccConfig.campaignId,
      isSMS,
      name: listName,
      description: listDescription || null,
      isScrub: false,
      file: uploadFileName,
      createRelation: true,
      enforceDuplicates: false,
      duplicateStrategy: "NumbersAcrossLists"
    };
    const uploadLogBase = buildWielandUploadLogBase({
      campaignKey,
      listName,
      listDescription,
      listId: "",
      isSMS,
      uploadFileName,
      selectedFieldmapping,
      contactToList,
      configuredContactToList,
      csvLines,
      initialLeads,
      eligible,
      listPayload,
      source: uploadedLeads.length ? "file" : "contacts",
      uploadFileContentType: uploadedFileBuffer ? uploadFileContentType : "text/csv",
      uploadFileSource: uploadedFileBuffer ? "original-upload" : "generated-csv",
      uploadedHeaders
    });

    const formData = new FormData();
    formData.append("object", JSON.stringify(listPayload));
    formData.append(
      "file",
      new Blob([uploadedFileBuffer || csvContent], { type: uploadedFileBuffer ? uploadFileContentType : "text/csv" }),
      uploadFileName
    );

    const baseUrl = (nccConfig.nccBaseUrl || "https://mancity.thrio.io/data/api/types").replace(/\/$/, "");
    let createRes;
    try {
      createRes = await fetch(`${baseUrl}/outboundlist`, {
        method: "POST",
        headers: { ...buildNccAuthHeader(nccConfig) },
        body: formData
      });
    } catch (err) {
      sendJson(res, 502, { error: "Failed to reach NCC API", details: err.message });
      return;
    }

    if (!createRes.ok) {
      const errText = await createRes.text();
      const logId = await saveWielandUploadLog({
        ...uploadLogBase,
        ok: false,
        phase: "create",
        nccCreateStatus: createRes.status,
        nccCreateResponse: errText,
        responses: {
          createOutboundList: {
            method: "POST",
            endpoint: "data/api/types/outboundlist",
            status: createRes.status,
            contentType: createRes.headers.get("content-type") || "",
            body: errText
          }
        },
        responseContentType: createRes.headers.get("content-type") || ""
      });
      sendJson(res, createRes.status, {
        error: "Failed to create list",
        details: errText,
        logId,
        debug: {
          campaignId: nccConfig.campaignId,
          eligibleCount: eligible.length,
          initialLeadCount: initialLeads.length,
          uploadFileName,
          selectedFieldmappingId: selectedFieldmapping?._id || selectedFieldmapping?.fieldmappingsId || selectedFieldmapping?.id || "",
          selectedFieldmappingName: selectedFieldmapping?.name || selectedFieldmapping?.localizations?.name?.en?.value || "",
          contactToListSource: Object.keys(configuredContactToList).length ? "campaign.wieland.contactToListMap" : "campaign.expansions.fieldMappingsId.fields",
          contactToList,
          csvHeaders,
          firstCsvRow: csvLines[1] || "",
          firstEligibleContact: initialLeads[0] ? {
            firstName: initialLeads[0].firstName || "",
            lastName: initialLeads[0].lastName || "",
            phone: initialLeads[0].phone || "",
            mobile: initialLeads[0].mobile || "",
            email: initialLeads[0].email || "",
            externalId: initialLeads[0].externalId || "",
            fax: initialLeads[0].fax || "",
            contactId: initialLeads[0].contactId || initialLeads[0]._id || ""
          } : null,
          responseContentType: createRes.headers.get("content-type") || ""
        }
      });
      return;
    }

    const listData = await createRes.json();
    const listId = listData.id || listData._id || listData.outboundlistId;
    const createdListResult = listId
      ? await fetchOutboundListAfterCreate(nccConfig, listId)
      : null;
    const createdList = createdListResult?.ok ? createdListResult.data : listData;
    const uploadStatus = normalizeOutboundListUploadStatus(createdList);

    // Assign to campaign
    let attachResult = null;
    const attachPayload = listId ? {
      campaignId: nccConfig.campaignId,
      outboundlistId: listId,
      _working: true
    } : null;
    if (listId) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        attachResult = await nccFetch(nccConfig, "/campaignoutboundlist", "POST", attachPayload);
        if (attachResult.ok) break;
        if (attempt < 3) await sleep(500 * attempt);
      }
    }
    const logId = await saveWielandUploadLog({
      ...uploadLogBase,
      ok: true,
      phase: "upload",
      listId: listId || "",
      nccCreateStatus: createRes.status,
      nccCreateResponse: listData,
      refreshedListStatus: createdListResult?.status || null,
      refreshedList: createdList,
      uploadStatus,
      requests: {
        ...uploadLogBase.requests,
        refreshCreatedList: listId ? {
          method: "GET",
          endpoint: `data/api/types/outboundlist/${listId}`
        } : null,
        attachCampaignOutboundList: attachPayload ? {
          method: "POST",
          endpoint: "data/api/types/campaignoutboundlist",
          body: attachPayload
        } : null
      },
      responses: {
        createOutboundList: {
          method: "POST",
          endpoint: "data/api/types/outboundlist",
          status: createRes.status,
          body: listData
        },
        refreshCreatedList: createdListResult ? {
          method: "GET",
          endpoint: listId ? `data/api/types/outboundlist/${listId}` : "data/api/types/outboundlist",
          status: createdListResult.status,
          body: createdListResult.ok ? createdList : createdListResult.data
        } : null,
        attachCampaignOutboundList: attachResult ? {
          method: "POST",
          endpoint: "data/api/types/campaignoutboundlist",
          status: attachResult.status,
          body: attachResult.data
        } : null
      },
      attach: attachResult
        ? (attachResult.ok
          ? { ok: true, data: attachResult.data }
          : { ok: false, status: attachResult.status, data: attachResult.data })
        : { ok: false, error: "No list id returned from NCC." }
    });

    sendJson(res, 200, {
      ok: true,
      created: true,
      list: createdList,
      uploadStatus,
      logId,
      contactsInCsv: initialLeads.length,
      totalEligibleContacts: eligible.length,
      createStatus: {
        nccReturnedId: Boolean(listId),
        refreshedFromNcc: Boolean(createdListResult?.ok)
      },
      attach: attachResult
        ? (attachResult.ok
          ? { ok: true, data: attachResult.data }
          : { ok: false, status: attachResult.status, data: attachResult.data })
        : { ok: false, error: "No list id returned from NCC." }
    });
    return;
  }

  // POST /api/wieland/lists/:id/leads (bulk)
  const listLeadsMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)\/leads$/);
  if (req.method === "POST" && listLeadsMatch) {
    const listId = listLeadsMatch[1];
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const inputLeads = Array.isArray(body.leads) ? body.leads : [body];
    const existingResult = await nccFetch(nccConfig, `/lead?rows=200&start=0&q=&outboundListId=${encodeURIComponent(listId)}`);
    if (!existingResult.ok) {
      sendJson(res, existingResult.status, { error: "NCC API error", details: existingResult.data });
      return;
    }
    const existingLeads = Array.isArray(existingResult.data)
      ? existingResult.data
      : (existingResult.data?.objects || existingResult.data?.results || existingResult.data?.data || []);
    const existingFingerprints = new Set();
    for (const lead of existingLeads) {
      for (const fingerprint of buildWielandContactFingerprints(lead)) existingFingerprints.add(fingerprint);
    }

    const fieldmappingsResult = await nccFetch(nccConfig, "/fieldmappings");
    const nccFieldmappings = fieldmappingsResult.ok
      ? (Array.isArray(fieldmappingsResult.data) ? fieldmappingsResult.data : (fieldmappingsResult.data?.objects || fieldmappingsResult.data?.results || fieldmappingsResult.data?.data || []))
      : [];
    const selectedFieldmapping = nccFieldmappings.find((item) => {
      const itemId = item?.fieldmappingsId || item?._id || item?.id || "";
      return item?.schema === "contact" && itemId === String(campaign.wieland?.nccFieldmappingId || "").trim();
    }) || selectBestNccContactFieldmapping(nccFieldmappings);
    const configuredContactToList = sanitizeStringMapping(campaign.wieland?.contactToListMap || {});
    const contactToList = Object.keys(configuredContactToList).length
      ? configuredContactToList
      : sanitizeStringMapping(selectedFieldmapping?.fields || {});
    const widgetMap = getEffectiveWielandWidgetMap(campaign);
    const widgetExternalTarget = widgetMap.externalId || "externalId";

    const leads = inputLeads.map((lead) => {
      const normalizedLead = { ...lead };
      if (!normalizedLead.externalId && widgetExternalTarget && widgetExternalTarget !== "externalId") {
        normalizedLead.externalId = normalizedLead[widgetExternalTarget] || "";
      }
      return buildLeadPayloadFromContact(normalizedLead, listId, contactToList, { includeBaseFields: false });
    }).filter((lead) => {
      const fingerprints = buildWielandContactFingerprints(lead);
      for (const fingerprint of fingerprints) {
        if (existingFingerprints.has(fingerprint)) return false;
      }
      for (const fingerprint of fingerprints) existingFingerprints.add(fingerprint);
      return true;
    });

    if (!leads.length) {
      sendJson(res, 200, { ok: true, added: 0, skippedExisting: inputLeads.length });
      return;
    }

    console.log("[wieland/leads] sending leads:", JSON.stringify(leads.slice(0, 2)));
    const result = await nccFetch(nccConfig, `/outboundlist/${encodeURIComponent(listId)}/leads`, "POST", leads);
    console.log("[wieland/leads] NCC response:", result.status, JSON.stringify(result.data)?.slice(0, 300));
    let visibleAfterInsert = null;
    if (result.ok) {
      const verifyResult = await nccFetch(nccConfig, `/lead?rows=200&start=0&q=&outboundListId=${encodeURIComponent(listId)}`);
      if (verifyResult.ok) {
        const verifyLeads = Array.isArray(verifyResult.data)
          ? verifyResult.data
          : (verifyResult.data?.objects || verifyResult.data?.results || verifyResult.data?.data || []);
        visibleAfterInsert = {
          count: verifyLeads.length,
          leads: verifyLeads.map((lead) => ({
            leadId: lead?.leadId || lead?._id || lead?.id || "",
            firstName: lead?.firstName || "",
            lastName: lead?.lastName || "",
            phone: lead?.phone || "",
            mobile: lead?.mobile || "",
            email: lead?.email || "",
            thrioListId: lead?.thrioListId || ""
          }))
        };
      } else {
        visibleAfterInsert = {
          error: true,
          status: verifyResult.status,
          details: verifyResult.data
        };
      }
    }
    sendJson(
      res,
      result.ok ? 200 : result.status,
      result.ok
        ? {
            ok: true,
            added: leads.length,
            skippedExisting: inputLeads.length - leads.length,
            debug: {
              nccStatus: result.status,
              nccResponse: result.data,
              outboundListId: listId,
              contactToList,
              payloadSentToNcc: { leads },
              visibleAfterInsert
            }
          }
        : {
            error: "NCC API error",
            details: result.data,
            debug: {
              nccStatus: result.status,
              nccResponse: result.data,
              outboundListId: listId,
              contactToList,
              payloadSentToNcc: { leads }
            }
          }
    );
    return;
  }

  // GET /api/wieland/lists/:id/leads
  const listLeadsGetMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)\/leads$/);
  if (req.method === "GET" && listLeadsGetMatch) {
    const listId = listLeadsGetMatch[1];
    const result = await nccFetch(nccConfig, `/lead?rows=100&start=0&q=&outboundListId=${encodeURIComponent(listId)}`);
    const leads = result.ok ? (Array.isArray(result.data) ? result.data : (result.data?.objects || result.data?.results || result.data?.data || [])) : [];
    sendJson(res, result.ok ? 200 : result.status, result.ok ? { leads } : { error: "NCC API error" });
    return;
  }

  const listRefreshPriorityMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)\/refresh-priority$/);
  if (req.method === "POST" && listRefreshPriorityMatch) {
    const listId = listRefreshPriorityMatch[1];
    const contactsResult = await nccFetch(nccConfig, "/contact");
    if (!contactsResult.ok) {
      sendJson(res, contactsResult.status, { error: "NCC API error", details: contactsResult.data });
      return;
    }
    const rawContacts = Array.isArray(contactsResult.data)
      ? contactsResult.data
      : (contactsResult.data?.objects || contactsResult.data?.results || contactsResult.data?.data || []);
    const localMap = await readWielandContactsLocal();
    const contacts = await mergeWielandContacts(rawContacts, localMap);
    calcCallPriority(contacts);
    const leadsResult = await nccFetch(nccConfig, `/lead?rows=100&start=0&q=&outboundListId=${encodeURIComponent(listId)}`);
    if (!leadsResult.ok) {
      sendJson(res, leadsResult.status, { error: "NCC API error", details: leadsResult.data });
      return;
    }
    const leads = Array.isArray(leadsResult.data)
      ? leadsResult.data
      : (leadsResult.data?.objects || leadsResult.data?.results || leadsResult.data?.data || []);
    let skipped = 0;
    let updated = 0;
    for (const lead of leads) {
      const leadId = lead.id || lead._id || lead.resId;
      if (!leadId) {
        skipped += 1;
        continue;
      }
      const contact = findMatchingContactForLead(lead, contacts);
      if (!contact) {
        skipped += 1;
        continue;
      }
      const patchResult = await nccFetch(
        nccConfig,
        `/outboundlist/${listId}/lead/${leadId}`,
        "PATCH",
        { fax: String(contact.call_priority || 9999) }
      );
      if (!patchResult.ok) {
        sendJson(res, patchResult.status, { error: "Failed to refresh list priority", details: patchResult.data });
        return;
      }
      updated += 1;
    }
    sendJson(res, 200, { ok: true, updated, skipped, totalLeads: leads.length });
    return;
  }

  // PATCH /api/wieland/lists/:listId/leads/:leadId
  const leadPatchMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)\/leads\/([^/]+)$/);
  if (req.method === "PATCH" && leadPatchMatch) {
    const [, listId, leadId] = leadPatchMatch;
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const result = await nccFetch(nccConfig, `/lead/${leadId}`, "PATCH", body);
    sendJson(res, result.ok ? 200 : result.status, result.ok ? { ok: true } : { error: "NCC API error" });
    return;
  }

  // DELETE /api/wieland/lists/:listId/leads/:leadId
  const leadDeleteMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)\/leads\/([^/]+)$/);
  if (req.method === "DELETE" && leadDeleteMatch) {
    const [, listId, leadId] = leadDeleteMatch;
    const result = await nccFetch(nccConfig, `/lead/${leadId}?outboundListId=${encodeURIComponent(listId)}`, "DELETE", {});
    sendJson(res, result.ok ? 200 : result.status, result.ok ? { ok: true } : { error: "NCC API error", details: result.data });
    return;
  }

  // DELETE /api/wieland/lists/:id
  const listDeleteMatch = url.pathname.match(/^\/api\/wieland\/lists\/([^/]+)$/);
  if (req.method === "DELETE" && listDeleteMatch) {
    const listId = listDeleteMatch[1];
    const result = await nccFetch(nccConfig, `/outboundlist/${listId}`, "DELETE");
    sendJson(res, result.ok ? 200 : result.status, result.ok ? { ok: true } : { error: "NCC API error", details: result.data });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/wieland/fieldmap/ncc") {
    const result = await nccFetch(nccConfig, "/fieldmappings");
    if (!result.ok) {
      sendJson(res, result.status, { error: "NCC API error", details: result.data });
      return;
    }
    const fieldmappings = Array.isArray(result.data)
      ? result.data
      : (result.data?.objects || result.data?.results || result.data?.data || []);
    sendJson(res, 200, { fieldmappings });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/wieland/templates") {
    const result = await nccFetch(nccConfig, "/template");
    if (!result.ok) {
      sendJson(res, result.status, { error: "NCC API error", details: result.data });
      return;
    }
    const templates = Array.isArray(result.data)
      ? result.data
      : (result.data?.objects || result.data?.results || result.data?.data || []);
    sendJson(res, 200, { templates });
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/wieland/campaign/sms-template") {
    if (!nccConfig.campaignId) { sendJson(res, 400, { error: "Campaign ID not configured." }); return; }
    let body;
    try { body = await readJson(req); } catch {
      sendJson(res, 400, { error: "Invalid JSON." }); return;
    }
    const smsTemplateId = String(body.smsTemplateId || "").trim();
    const result = await nccFetch(
      nccConfig,
      `/campaign/${encodeURIComponent(nccConfig.campaignId)}`,
      "PATCH",
      { smsTemplateId: smsTemplateId || null }
    );
    if (result.ok) {
      sendJson(res, 200, { ok: true, campaign: result.data, smsTemplateId: smsTemplateId || null });
    } else {
      sendJson(res, result.status, { error: "NCC API error", details: result.data });
    }
    return;
  }

  // ── Campaign status ──────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/wieland/campaign/status") {
    if (!nccConfig.campaignId) { sendJson(res, 400, { error: "Campaign ID not configured." }); return; }
    const result = await nccFetch(nccConfig, `/campaign/${nccConfig.campaignId}`);
    sendJson(res, result.ok ? 200 : result.status, result.ok
      ? { campaign: result.data, slotsNeeded: Number(nccConfig.slotsNeeded) || 8, localConfig: campaign.wieland || {} }
      : { error: "NCC API error", details: result.data }
    );
    return;
  }

  sendJson(res, 404, { error: "Wieland route not found" });
}
// ──────────────────────────────────────────────────────────────────────────

const THRIO_SMS_AUTODISPOSITION_ID = "669ed3189e9f697c726c718b";

function buildThrioDataBaseUrl(config = {}) {
  const domain = sanitizeDomain(
    config.domain
    || getDomainFromUrl(config.apiUrl)
    || process.env.THRIO_DOMAIN
    || getDomainFromUrl(DEFAULT_API_URL)
  );
  if (!domain) return "";
  return `https://${domain}/data/api/types`;
}

function buildThrioCampaignPayload(name, callerId, workflowId) {
  return {
    objectType: "campaign",
    name,
    callerId,
    workflowId,
    addresses: [callerId],
    localizations: { name: { en: { language: "en", value: name } } },
    useForSMS: true,
    autoDispositionId: THRIO_SMS_AUTODISPOSITION_ID,
    smsFromAddress: "",
    recordingAnalysisPercentage: 0,
    recordingPercentage: 0,
    userRecordings: false,
    complianceRecordings: false,
    defaultOutbound: false,
    useForProgressive: false,
    useForExtension: false,
    useForEmail: false,
    useForPredictive: false,
    useForOutbound: false,
    useForFax: false,
    useForLeadLevelCallerId: false,
    loadLeadOnlyForThridPartySkill: false,
    amdUnknownAsVoicemail: false,
    spoofANICompanyDirectory: false,
    disableImageOnMMS: false,
    disableRecordingOnTwoParty: false,
    applyRecordingConsent: false,
    agentCallbacksAsPriority: false,
    priorityCallbacks: false,
    outboundANI: false,
    defaultExtension: false,
    enableRealtimeTranscription: false,
    enableRealtimeTranscriptionFreeswitch: false,
    recordingEventsTranscription: false,
    autoDialTimer: "1",
    filterOnLeads: "",
    complianceRecordingsFileNameFormat: "",
    userRecordingsFileNameFormat: "",
    emailFromAddress: "",
    ftpFilenameFormat: "",
    recordingAnalysisLanguages: "",
    _adjustedByData: true,
    _showDialPad: false,
    _working: true,
    selected: true,
    _selected: true,
    invalidAction: null,
    answeringMachinePromptId: null,
    machineDetectionTimeout: null,
    maxDialRatio: null,
    abandonPercentage: null,
    musicId: null,
    humanFunction: null,
    noAnswerCallbackInMinutes: null,
    recordingAnalysisMinDuration: null,
    chatKeepAliveTimeoutForMobile: null,
    coolOffPeriodInSec: null,
    jobBusinessEventId: null,
    dlpInfoTypes: null,
    thirdPartySkillFieldName: null,
    recordingAnalysisServiceId: null,
    humanDispositionId: null,
    smsFailedFucntionId: null,
    thirdPartySkillQueueId: null,
    answeringMachineDispositionId: null,
    percentageAllCallbackLeads: null,
    dialRatio: null,
    calabrioPenaltyBox: null,
    answeringMachineAction: null,
    abandonDispositionId: null,
    busyCallbackInMinutes: null,
    complianceRecordingsFileServerId: null,
    generativeAIServiceId: null,
    firstPartySkillFieldName: null,
    jobFunctionId: null,
    initialStateId: null,
    chatKeepAliveTimeout: null,
    recordingAnalysisEndTime: null,
    emailFailedFucntionId: null,
    abandonCallbackInMinutes: null,
    invalidDispositionId: null,
    emailaccountId: null,
    smsPerMinute: null,
    busyDispositionId: null,
    leadsDaysPartition: null,
    delayMaxAttemptsTo: null,
    emailTemplateId: null,
    machineDetectionSpeechEndThresholdInMillis: null,
    recordingNotificationFrequency: null,
    busyAction: null,
    predictiveQuaterback: null,
    numberOfAgentsToKeepForInbound: null,
    autoDispositionDelay: null,
    maxAttemptsPerAddress: null,
    dailyAttemptsToManualCalls: null,
    calabrioContactTraces: null,
    groupId: null,
    thirdPartySkillCallbackTime: null,
    redactLikelihood: null,
    userRecordingsFileServerId: null,
    primaryPhoneField: null,
    campaignGoalsId: null,
    nlpServiceId: null,
    invalidFunction: null,
    finalWorkitemStateId: null,
    noAnswerDispositionId: null,
    thirdPartySkillMinAvailableUsers: null,
    percentageThridPartyLeads: null,
    percentageNewLeads: null,
    answeringMachineCallbackInMinutes: null,
    noAnswerTimeout: null,
    calabrioRecordings: null,
    abandonFunction: null,
    smsTemplateId: null,
    maxLeadsInMemory: null,
    recordingAnalysisMaxDuration: null,
    maxAttempts: null,
    finalUserStateId: null,
    humanAction: null,
    abandonAction: null,
    predictiveRestcallId: null,
    fileServerId: null,
    redactionType: null,
    dailyMaxAttempts: null,
    minLeadsInMemory: null,
    outboundCallFunctionId: null,
    noAnswerAction: null,
    states: null,
    emailPerMinute: null,
    holdMusicUrl: null,
    invalidCallbackInMinutes: null,
    enhancedAMD: null,
    leadPartitionField: null,
    leadOrderByField: null,
    faxDispositionId: null,
    recordingPromptId: null,
    machineDetectionSilenceTimeout: null,
    fieldMappingsId: null,
    noAnswerFunction: null,
    machineDetectionSpeechThresholdInMillis: null,
    emailSuccessFucntionId: null,
    busyFunction: null,
    percentageAgentsCallbackLeads: null,
    coolPeriodBetweenCallsInSeconds: null,
    smsSuccessFucntionId: null,
    recordingAnalysisStartTime: null,
    whatsAppTemplateId: null,
    knowledgeBaseServiceId: null,
    surveyNetworkRegionId: null,
    percentageAllCallbackLeads: null,
    enableAutoDialTimer: false
  };
}

function buildThrioPstnNumberPayload(number, description, provider) {
  return {
    objectType: "pstnnumber",
    voice: false,
    sid: "",
    mms: false,
    provider,
    sms: false,
    whatsAppSenderSid: "",
    belongsToId: "",
    whatsAppSenderCode: "",
    stirShakenAttestation: null,
    whatsAppCallbackUrl: "",
    whatsAppSenderStatus: null,
    phoneNumber: {
      number: null,
      isoCountry: null,
      type: null,
      voice: null,
      sms: null,
      mms: null
    },
    whatsAppBusinessProfileId: null,
    name: number,
    whatsAppFallbackUrl: "",
    whatsAppStatusCallbackUrl: "",
    whatsAppBusinessAccountId: "",
    _adjustedByData: true,
    _showDialPad: false,
    _working: true,
    selected: true,
    _selected: true,
    description
  };
}

function nccBuilderId() {
  return crypto.randomBytes(12).toString("hex");
}

function buildNccBuilderBaseUrl(domain) {
  const clean = sanitizeDomain(domain || "astonvilla.thrio.io") || "astonvilla.thrio.io";
  return `https://${clean}`;
}

function getNccBuilderAuth(req, url, body = {}) {
  const token = String(body.token || url.searchParams.get("token") || req.headers["x-ncc-token"] || "").trim();
  const domain = String(body.domain || url.searchParams.get("domain") || "astonvilla.thrio.io").trim();
  return {
    token,
    domain,
    baseUrl: buildNccBuilderBaseUrl(domain),
    headers: { Authorization: token, "Content-Type": "application/json" }
  };
}

function nccBuilderAuthHeaders(config, bearer = false) {
  const token = String(config.token || "").trim();
  const authorization = bearer && token && !/^Bearer\s+/i.test(token) ? `Bearer ${token}` : token;
  return { Authorization: authorization, "Content-Type": "application/json" };
}

function summarizeNccBuilderToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return { validJwt: false };
  const now = Math.floor(Date.now() / 1000);
  return {
    validJwt: true,
    username: payload.username || payload.sub || "",
    tenantId: payload.tenantId || "",
    userId: payload.userId || "",
    issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : "",
    expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : "",
    expired: payload.exp ? now >= payload.exp : false
  };
}

async function nccBuilderFetch(config, pathName, method = "GET", body = null, apiRoot = "/data/api/types") {
  const target = `${config.baseUrl}${apiRoot}${pathName}`;
  const opts = { method, headers: nccBuilderAuthHeaders(config) };
  if (body !== null && method !== "GET") opts.body = JSON.stringify(body);
  let upstream = await fetch(target, opts);
  if ((upstream.status === 401 || upstream.status === 403) && config.token && !/^Bearer\s+/i.test(config.token)) {
    upstream = await fetch(target, { ...opts, headers: nccBuilderAuthHeaders(config, true) });
  }
  const text = await upstream.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  return { ok: upstream.ok, status: upstream.status, data, endpoint: `${apiRoot}${pathName}` };
}

function nccObjectList(data) {
  return Array.isArray(data) ? data : (data?.objects || data?.results || data?.data || []);
}

function profileDisplayName(profile) {
  return profile?.localizations?.name?.en?.value || profile?.name || profile?.label || "";
}

function isAdministratorProfile(session, profiles) {
  const profileId = String(session?.userProfileId || session?.userProfile?._id || session?.userProfile?.userprofileId || "").trim();
  const profile = nccObjectList(profiles).find((item) => {
    const ids = [item?._id, item?.userprofileId, item?.id].map((v) => String(v || ""));
    return ids.includes(profileId);
  }) || session?.userProfile || null;
  const label = String(profile?.label || "").toUpperCase();
  const name = profileDisplayName(profile).toLowerCase();
  return {
    ok: label.includes("ADMIN") || name.includes("administrator") || name.includes("administrador"),
    profile,
    profileId
  };
}

async function validateNccBuilderAdmin(config) {
  if (!config.token) {
    const error = new Error("Token is required.");
    error.status = 400;
    throw error;
  }
  const sessionResult = await nccBuilderFetch(config, "/session", "GET", null, "/users/api");
  if (!sessionResult.ok) {
    const error = new Error("Unable to validate NCC session.");
    error.status = sessionResult.status;
    error.details = { response: sessionResult.data, token: summarizeNccBuilderToken(config.token) };
    throw error;
  }
  const profilesResult = await nccBuilderFetch(config, "/userprofile");
  if (!profilesResult.ok) {
    const error = new Error("Unable to load NCC user profiles.");
    error.status = profilesResult.status;
    error.details = profilesResult.data;
    throw error;
  }
  const admin = isAdministratorProfile(sessionResult.data, profilesResult.data);
  if (!admin.ok) {
    const error = new Error("Only Administrator profiles can use this widget.");
    error.status = 403;
    error.details = { userProfileId: admin.profileId, profile: admin.profile };
    throw error;
  }
  return {
    session: sessionResult.data,
    profiles: nccObjectList(profilesResult.data),
    adminProfile: admin.profile
  };
}

function buildNccBuilderCampaignPayload(name, addresses = []) {
  const payload = buildThrioCampaignPayload(name, "", null);
  delete payload.addresses;
  if (Array.isArray(addresses) && addresses.length) payload.addresses = addresses;
  payload.workflowId = null;
  payload.callerId = "";
  payload.autoDispositionId = null;
  payload.useForSMS = false;
  payload.localizations = { name: { en: { language: "en", value: name } } };
  return payload;
}

function normalizeNccInboundAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 10) return digits;
  return raw;
}

function buildNccBuilderWorkflowPayload(name) {
  const endStateId = nccBuilderId();
  const transitionId = nccBuilderId();
  return {
    objectType: "workflow",
    maxActions: null,
    states: {
      [endStateId]: {
        category: "Standard",
        campaignStateId: endStateId,
        actions: [{
          category: "Action",
          title: "Terminate",
          name: "Terminate",
          type: "terminate",
          description: "Terminate",
          icon: "./assets/svg/icon-terminate",
          svg: "",
          color: "#FFFFFF",
          fig: "Rectangle",
          properties: { description: null, condition: { conditionType: "NONE", scriptId: null, customCondition: null, expressions: [{ leftExpression: null, operator: "==", rightExpression: null }] } }
        }],
        objectType: "campaignstate",
        key: endStateId,
        _id: endStateId,
        description: "End State",
        name: "End State",
        location: "200 100"
      },
      "start-state": {
        category: "Begin",
        campaignStateId: "start-state",
        actions: [{
          category: "Action",
          title: "Transition",
          name: "Start",
          type: "transition",
          description: "Transition to another state",
          icon: "./assets/svg/icon-transition",
          svg: "",
          color: "#FFFFFF",
          fig: "Rectangle",
          properties: { description: null, condition: { conditionType: "NONE", scriptId: null, customCondition: null, expressions: [{ leftExpression: null, operator: "==", rightExpression: null }] }, stateId: endStateId, name: "Start" }
        }],
        transitions: [{ name: "Start", id: transitionId }],
        objectType: "campaignstate",
        key: "start-state",
        _id: "start-state",
        description: "Begin State",
        name: "Begin State",
        location: "0 0"
      }
    },
    finalWorkitemStateId: null,
    finalUserStateId: null,
    name,
    localizations: { name: { en: { language: "en", value: name } } },
    _adjustedByData: true,
    _showDialPad: false,
    _working: true,
    selected: true,
    _selected: true
  };
}

function minutesFromTime(value, fallback) {
  const raw = String(value || "");
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Math.max(0, Math.min(23, Number(match[1]) || 0));
  const minutes = Math.max(0, Math.min(59, Number(match[2]) || 0));
  return hours * 60 + minutes;
}

function buildNccBuilderTimeEventPayload(name, days, startTime, endTime) {
  const now = Date.now();
  return {
    objectType: "timeevent",
    timeEventType: "weekdays",
    start: minutesFromTime(startTime, 480),
    name,
    dayOfTheMonth: null,
    days: Array.isArray(days) && days.length ? days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    timeInterval: null,
    from: now,
    end: minutesFromTime(endTime, 1140),
    to: now,
    day: null,
    localizations: { name: { en: { language: "en", value: name } } },
    _adjustedByData: true,
    _showDialPad: false,
    _working: true,
    selected: true,
    _selected: true
  };
}

function buildNccBuilderBusinessEventPayload(name) {
  return {
    objectType: "businessevent",
    name,
    localizations: { name: { en: { language: "en", value: name } } },
    _adjustedByData: true,
    _showDialPad: false,
    _working: true,
    selected: true,
    _selected: true
  };
}

function buildNccBuilderQueuePayload(name, assignmentType, blended) {
  return {
    objectType: "queue",
    blended: Boolean(blended),
    playAnnouncementPromptId: null,
    assignmentType: String(assignmentType || "fifo_across_all_queues"),
    pushQueueDataInRealTime: true,
    hideInCompanyDirectory: false,
    businessEventId: null,
    disableSkills: false,
    noAnswerStatusAsAvailable: false,
    socialSLA: 3600,
    slaCalculation: null,
    emailSLA: 3600,
    realtimeAssignment: true,
    lifo: false,
    name,
    voiceSLA: 30,
    chatSLA: 30,
    smsSLA: null,
    localizations: { name: { en: { language: "en", value: name } } },
    _adjustedByData: true,
    _showDialPad: false,
    _working: true,
    selected: true,
    _selected: true
  };
}

function buildNccBuilderPromptPayload(name, content) {
  const text = String(content || "").trim();
  return {
    esVoiceName: "es-ES-Standard-A",
    localizations: {
      name: { en: { language: "en", value: name } },
      content: {
        en: { language: "en", value: text },
        fr: { language: "fr", value: text },
        es: { language: "es", value: text },
        pt: { language: "pt", value: text }
      }
    },
    content: text,
    objectType: "prompt",
    enVoiceName: "en-US-Neural2-A",
    frVoiceName: "fr-CA-Neural2-A",
    name,
    ptVoiceName: "pt-PT-Standard-A"
  };
}

function buildNccBuilderWorkflowBusinessHoursPatch(workflow, businessEventName, prompt = null, queue = null) {
  const states = workflow?.states && typeof workflow.states === "object" ? JSON.parse(JSON.stringify(workflow.states)) : {};
  const endStateId = Object.keys(states).find((id) => id !== "start-state") || nccBuilderId();
  if (!states[endStateId]) {
    states[endStateId] = {
      category: "Standard",
      campaignStateId: endStateId,
      actions: [],
      objectType: "campaignstate",
      key: endStateId,
      _id: endStateId,
      description: "End State",
      name: "End State",
      location: "445.6146240234375 223.08331298828125",
      transitions: []
    };
  }
  const outStateId = nccBuilderId();
  const queueStateId = queue?.id ? nccBuilderId() : "";
  const outHoursTransitionId = `refId${Date.now()}`;
  const queueTransitionId = `refId${Date.now() + 1}`;
  states["start-state"] = {
    ...(states["start-state"] || {}),
    category: "Begin",
    campaignStateId: "start-state",
    actions: [
      {
        icon: "icon-transition",
        name: "Transition",
        description: "Transition to another state",
        properties: {
          description: null,
          condition: {
            conditionType: "AND",
            scriptId: null,
            customCondition: null,
            expressions: [{ leftExpression: `workitem.businessEvents. ${businessEventName}`, operator: "==", rightExpression: "FALSE" }]
          },
          stateId: outStateId
        },
        type: "transition",
        _selected: false,
        transitionId: outHoursTransitionId,
        id: `refId${Date.now() + 4}`
      },
      ...(queue?.id ? [{
        name: "Transition",
        description: "Transition to another state",
        properties: {
          description: "Entra en cola",
          condition: { conditionType: "NONE", expressions: [{ operator: "==" }] },
          stateId: queueStateId
        },
        type: "transition",
        _selected: true,
        transitionId: queueTransitionId,
        icon: "icon-transition",
        id: `refId${Date.now() + 5}`
      }] : [])
    ],
    transitions: [
      { name: "Transition", id: outHoursTransitionId },
      ...(queue?.id ? [{ name: "Transition", id: queueTransitionId }] : [])
    ],
    objectType: "campaignstate",
    key: "start-state",
    _id: "start-state",
    description: "Begin State",
    name: "Begin State",
    location: "0 0"
  };
  const outTransitionId = `refId${Date.now() + 2}`;
  states[outStateId] = {
    category: "Standard",
    objectType: "campaignstate",
    campaignStateId: outStateId,
    name: "OUT OF HOURS",
    description: "Newly Created State",
    actions: [
      ...(prompt?.id ? [{
        icon: "icon-playprompt",
        name: "Play Prompt",
        description: "",
        properties: {
          description: null,
          condition: { conditionType: "NONE", scriptId: null, customCondition: null, expressions: [{ leftExpression: null, operator: "==", rightExpression: null }] },
          loop: 1,
          promptId: prompt.id,
          expansions: { promptId: { name: prompt.name || "" } },
          _working: false
        },
        type: "playprompt",
        _selected: true
      }] : []),
      {
        name: "Transition",
        description: "Transition to another state",
        properties: {
          condition: { conditionType: "NONE", expressions: [{ operator: "==" }] },
          stateId: endStateId,
          description: "Transition to another state"
        },
        type: "transition",
        _selected: false,
        transitionId: outTransitionId,
        icon: "icon-transition",
        id: `refId${Date.now() + 3}`
      }
    ],
    _id: outStateId,
    key: outStateId,
    location: "248.1302490234375 91.43226623535156",
    transitions: [{ name: "Transition", id: outTransitionId }]
  };
  if (queue?.id) {
    states[queueStateId] = {
      category: "Standard",
      objectType: "campaignstate",
      campaignStateId: queueStateId,
      name: "Queue",
      description: "Newly Created State",
      actions: [{
        icon: "icon-enterqueues",
        name: "Enter Queue",
        description: "",
        properties: {
          description: null,
          priority: "5",
          queues: [queue.id],
          ringAllEnabled: false,
          stickyEnabled: false,
          stickyUserType: "5",
          stickyUserAddress: null,
          stickyUserExtension: null,
          stickyUserId: null,
          stickyUserIdFromExpression: null,
          stickyDurationToWaitSeconds: 0,
          condition: {
            conditionType: "NONE",
            scriptId: null,
            customCondition: null,
            expressions: [{ leftExpression: null, operator: "==", rightExpression: null }]
          },
          expansions: { queueId: { [queue.id]: queue.name || "" } }
        },
        type: "enterqueue",
        _selected: true
      }],
      _id: queueStateId,
      key: queueStateId,
      location: "456.276123046875 -237.38018798828125",
      transitions: []
    };
  }
  return { states };
}

function nccId(item, ...extraKeys) {
  for (const key of ["_id", "id", ...extraKeys]) {
    const value = item?.[key];
    if (value) return String(value);
  }
  return "";
}

function extractNccToken(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim().replace(/^"|"$/g, "");
  return String(
    data.token
    || data.access_token
    || data.accessToken
    || data.jwt
    || data.authorization
    || data.Authorization
    || ""
  ).trim();
}

function extractNccDomain(data, token = "") {
  const payload = decodeJwtPayload(token) || {};
  const candidates = [
    data?.domain,
    data?.location,
    data?.baseUrl,
    data?.url,
    data?.user?.location,
    data?.session?.location,
    payload.domain,
    payload.location
  ];
  for (const candidate of candidates) {
    const clean = sanitizeDomain(candidate);
    if (clean) return clean;
  }
  return "";
}

async function resolveThrioDataConfig(campaignId) {
  if (campaignId) {
    const campaigns = await readCampaigns();
    const match = campaigns.find((c) => c.id === campaignId);
    if (!match) {
      const error = new Error(`Campaign "${campaignId}" not found.`);
      error.status = 404;
      throw error;
    }
    return {
      token: match.token,
      dataBaseUrl: buildThrioDataBaseUrl(match)
    };
  }

  return {
    token: String(process.env.THRIO_AUTH_TOKEN || "").trim(),
    dataBaseUrl: buildThrioDataBaseUrl()
  };
}

async function handleThrioData(req, res, url) {
  const campaignId = url.searchParams.get("campaign") || "";
  let thrioConfig;
  try {
    thrioConfig = await resolveThrioDataConfig(campaignId);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message });
    return;
  }

  if (!thrioConfig.token || !thrioConfig.dataBaseUrl) {
    sendJson(res, 503, { error: "No hay token configurado. Selecciona una campaña válida." });
    return;
  }

  const thrioHeaders = { "Authorization": thrioConfig.token, "Content-Type": "application/json" };

  if (req.method === "GET" && url.pathname === "/api/thrio-data/campaigns") {
    try {
      const upstream = await fetch(`${thrioConfig.dataBaseUrl}/campaign`, { headers: thrioHeaders });
      const data = await upstream.json();
      sendJson(res, upstream.status, data);
    } catch (e) {
      sendJson(res, 502, { error: `Upstream error: ${e.message}` });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/thrio-data/pstnnumbers") {
    try {
      const upstream = await fetch(`${thrioConfig.dataBaseUrl}/pstnnumber/unused?filter=campaign:addresses`, { headers: thrioHeaders });
      const data = await upstream.json();
      sendJson(res, upstream.status, data);
    } catch (e) {
      sendJson(res, 502, { error: `Upstream error: ${e.message}` });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/thrio-data/workflows") {
    try {
      const upstream = await fetch(`${thrioConfig.dataBaseUrl}/workflow?filter=campaign:workflowId`, { headers: thrioHeaders });
      const data = await upstream.json();
      sendJson(res, upstream.status, data);
    } catch (e) {
      sendJson(res, 502, { error: `Upstream error: ${e.message}` });
    }
    return;
  }

  const campaignDeleteMatch = url.pathname.match(/^\/api\/thrio-data\/campaigns\/([^/]+)$/);
  if (req.method === "DELETE" && campaignDeleteMatch) {
    const campaignThrioId = decodeURIComponent(campaignDeleteMatch[1] || "").trim();
    if (!campaignThrioId) {
      sendJson(res, 400, { error: "Campaign ID is required." });
      return;
    }

    try {
      const upstream = await fetch(`${thrioConfig.dataBaseUrl}/campaign/${encodeURIComponent(campaignThrioId)}`, {
        method: "DELETE",
        headers: thrioHeaders
      });
      const data = await upstream.json().catch(() => ({}));
      sendJson(res, upstream.status, Object.keys(data).length ? data : { ok: upstream.ok });
    } catch (e) {
      sendJson(res, 502, { error: `Upstream error: ${e.message}` });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/thrio-data/campaigns") {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "JSON inválido." }); return; }

    const name = String(body.name || "").trim();
    const callerId = String(body.callerId || "").trim();
    const workflowId = String(body.workflowId || "").trim();

    if (!name || !callerId || !workflowId) {
      sendJson(res, 400, { error: "name, callerId y workflowId son requeridos." });
      return;
    }

    try {
      const payload = buildThrioCampaignPayload(name, callerId, workflowId);
      const upstream = await fetch(`${thrioConfig.dataBaseUrl}/campaign`, {
        method: "POST",
        headers: thrioHeaders,
        body: JSON.stringify(payload)
      });
      const data = await upstream.json();
      sendJson(res, upstream.status, data);
    } catch (e) {
      sendJson(res, 502, { error: `Upstream error: ${e.message}` });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/thrio-data/pstnnumbers") {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "JSON inválido." }); return; }

    const number = String(body.number || "").trim();
    const description = String(body.description || "").trim();
    const provider = String(body.provider || "").trim();

    if (!number || !description || !provider) {
      sendJson(res, 400, { error: "number, description y provider son requeridos." });
      return;
    }

    try {
      const payload = buildThrioPstnNumberPayload(number, description, provider);
      const upstream = await fetch(`${thrioConfig.dataBaseUrl}/pstnnumber`, {
        method: "POST",
        headers: thrioHeaders,
        body: JSON.stringify(payload)
      });
      const data = await upstream.json().catch(() => ({}));
      sendJson(res, upstream.status, Object.keys(data).length ? data : { ok: upstream.ok });
    } catch (e) {
      sendJson(res, 502, { error: `Upstream error: ${e.message}` });
    }
    return;
  }

  sendJson(res, 404, { error: "Thrio data route not found." });
}
// ──────────────────────────────────────────────────────────────────────────

async function handleNccCampaignBuilder(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/ncc-builder/login") {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON." }); return; }
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) {
      sendJson(res, 400, { error: "Username and password are required." });
      return;
    }
    try {
      const basic = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
      const tokenResponse = await fetch("https://login.thrio.com/provider/token-with-authorities", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${basic}` }
      });
      const tokenText = await tokenResponse.text();
      let tokenData;
      try { tokenData = tokenText ? JSON.parse(tokenText) : {}; } catch { tokenData = tokenText; }
      if (!tokenResponse.ok) {
        sendJson(res, tokenResponse.status, { error: "Failed to get NCC token.", details: tokenData });
        return;
      }
      const providerToken = extractNccToken(tokenData);
      if (!providerToken) {
        sendJson(res, 502, { error: "Login provider did not return a token.", details: tokenData });
        return;
      }

      const domain = extractNccDomain(tokenData, providerToken) || "astonvilla.thrio.io";
      const config = {
        token: providerToken,
        domain,
        baseUrl: buildNccBuilderBaseUrl(domain),
        headers: { "Content-Type": "application/json" }
      };
      config.token = providerToken;
      const loginResponse = await nccBuilderFetch(config, "/login", "POST", {}, "/users/api");
      if (!loginResponse.ok) {
        sendJson(res, loginResponse.status, { error: "Failed to login to NCC users API.", details: loginResponse.data });
        return;
      }
      const sessionToken = extractNccToken(loginResponse.data) || providerToken;
      config.domain = extractNccDomain(loginResponse.data, sessionToken) || domain;
      config.baseUrl = buildNccBuilderBaseUrl(config.domain);
      config.token = sessionToken;
      const validation = await validateNccBuilderAdmin(config);
      config.domain = extractNccDomain(validation.session, sessionToken) || config.domain;
      config.baseUrl = buildNccBuilderBaseUrl(config.domain);
      sendJson(res, 200, {
        ok: true,
        token: sessionToken,
        domain: config.domain,
        tokenInfo: summarizeNccBuilderToken(sessionToken),
        user: {
          id: validation.session.userId || validation.session._id || "",
          name: validation.session.name || "",
          username: validation.session.username || "",
          userProfileId: validation.session.userProfileId || ""
        },
        profile: {
          id: validation.adminProfile?._id || validation.adminProfile?.userprofileId || "",
          name: profileDisplayName(validation.adminProfile),
          label: validation.adminProfile?.label || ""
        }
      });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message, details: error.details });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ncc-builder/session") {
    const config = getNccBuilderAuth(req, url);
    try {
      const validation = await validateNccBuilderAdmin(config);
      const detectedDomain = extractNccDomain(validation.session, config.token) || config.domain;
      sendJson(res, 200, {
        ok: true,
        domain: detectedDomain,
        user: {
          id: validation.session.userId || validation.session._id || "",
          name: validation.session.name || "",
          username: validation.session.username || "",
          userProfileId: validation.session.userProfileId || ""
        },
        profile: {
          id: validation.adminProfile?._id || validation.adminProfile?.userprofileId || "",
          name: profileDisplayName(validation.adminProfile),
          label: validation.adminProfile?.label || ""
        }
      });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message, details: error.details });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ncc-builder/pstn-unused") {
    const config = getNccBuilderAuth(req, url);
    try {
      await validateNccBuilderAdmin(config);
      const result = await nccBuilderFetch(config, "/pstnnumber/unused?filter=campaign:addresses");
      sendJson(res, result.status, result.ok ? { objects: nccObjectList(result.data) } : { error: "NCC API error", details: result.data });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message, details: error.details });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ncc-builder/create") {
    let body;
    try { body = await readJson(req); } catch { sendJson(res, 400, { error: "Invalid JSON." }); return; }
    const config = getNccBuilderAuth(req, url, body);
    const steps = [];
    const addStep = (name, result, payload = null) => {
      steps.push({ name, endpoint: result?.endpoint || "", status: result?.status || 0, ok: Boolean(result?.ok), payload, response: result?.data });
    };
    try {
      await validateNccBuilderAdmin(config);

      const campaignName = String(body.campaignName || "").trim();
      const campaignType = String(body.campaignType || "inbound").trim();
      const workflowName = String(body.workflowName || `${campaignName} workflow`).trim();
      const scheduleName = String(body.scheduleName || `${campaignName} schedule`).trim();
      const businessEventName = String(body.businessEventName || scheduleName).trim();
      if (!campaignName) { sendJson(res, 400, { error: "Campaign name is required." }); return; }
      if (!workflowName) { sendJson(res, 400, { error: "Workflow name is required." }); return; }

      let selectedAddress = "";
      if (campaignType === "inbound") {
        selectedAddress = normalizeNccInboundAddress(body.inboundAddress);
        if (!selectedAddress) { sendJson(res, 400, { error: "Inbound address is required.", steps }); return; }
      }

      const campaignPayload = buildNccBuilderCampaignPayload(campaignName, selectedAddress ? [selectedAddress] : []);
      const campaignResult = await nccBuilderFetch(config, "/campaign", "POST", campaignPayload);
      addStep("createCampaign", campaignResult, campaignPayload);
      if (!campaignResult.ok) { sendJson(res, campaignResult.status, { error: "Failed to create campaign.", steps }); return; }
      const campaignId = nccId(campaignResult.data, "campaignId");
      if (!campaignId) { sendJson(res, 502, { error: "NCC did not return campaign id.", steps }); return; }

      let phonePatchPayload = null;
      if (campaignType === "inbound") {
        phonePatchPayload = { addresses: [selectedAddress] };
      } else {
        const callerId = String(body.outboundCallerId || "").trim();
        if (!callerId) { sendJson(res, 400, { error: "Outbound caller ID is required.", steps }); return; }
        phonePatchPayload = { callerId };
      }
      const phonePatchResult = await nccBuilderFetch(config, `/campaign/${encodeURIComponent(campaignId)}`, "PATCH", phonePatchPayload);
      addStep("configureCampaignPhone", phonePatchResult, phonePatchPayload);
      if (!phonePatchResult.ok) { sendJson(res, phonePatchResult.status, { error: "Failed to configure campaign phone.", steps }); return; }

      let queueId = "";
      let queueName = "";
      if (campaignType === "inbound") {
        queueName = String(body.queueName || `${campaignName} queue`).trim();
        const queuePayload = buildNccBuilderQueuePayload(queueName, body.queueAssignmentType, body.queueBlended !== false);
        const queueResult = await nccBuilderFetch(config, "/queue", "POST", queuePayload);
        addStep("createInboundQueue", queueResult, queuePayload);
        if (!queueResult.ok) { sendJson(res, queueResult.status, { error: "Failed to create inbound queue.", steps }); return; }
        queueId = nccId(queueResult.data, "queueId");
        if (!queueId) { sendJson(res, 502, { error: "NCC did not return queue id.", steps }); return; }
      }

      const workflowPayload = buildNccBuilderWorkflowPayload(workflowName);
      const workflowResult = await nccBuilderFetch(config, "/workflow", "POST", workflowPayload);
      addStep("createWorkflow", workflowResult, workflowPayload);
      if (!workflowResult.ok) { sendJson(res, workflowResult.status, { error: "Failed to create workflow.", steps }); return; }
      const workflowId = nccId(workflowResult.data, "workflowId");
      if (!workflowId) { sendJson(res, 502, { error: "NCC did not return workflow id.", steps }); return; }

      const campaignWorkflowPatch = { workflowId };
      const campaignWorkflowResult = await nccBuilderFetch(config, `/campaign/${encodeURIComponent(campaignId)}`, "PATCH", campaignWorkflowPatch);
      addStep("attachWorkflowToCampaign", campaignWorkflowResult, campaignWorkflowPatch);
      if (!campaignWorkflowResult.ok) { sendJson(res, campaignWorkflowResult.status, { error: "Failed to attach workflow to campaign.", steps }); return; }

      const timeEventPayload = buildNccBuilderTimeEventPayload(scheduleName, body.days, body.startTime, body.endTime);
      const timeEventResult = await nccBuilderFetch(config, "/timeevent", "POST", timeEventPayload);
      addStep("createTimeEvent", timeEventResult, timeEventPayload);
      if (!timeEventResult.ok) { sendJson(res, timeEventResult.status, { error: "Failed to create time event.", steps }); return; }
      const timeeventId = nccId(timeEventResult.data, "timeeventId");

      const businessEventPayload = buildNccBuilderBusinessEventPayload(businessEventName);
      const businessEventResult = await nccBuilderFetch(config, "/businessevent", "POST", businessEventPayload);
      addStep("createBusinessEvent", businessEventResult, businessEventPayload);
      if (!businessEventResult.ok) { sendJson(res, businessEventResult.status, { error: "Failed to create business event.", steps }); return; }
      const businesseventId = nccId(businessEventResult.data, "businesseventId");

      if (businesseventId && timeeventId) {
        const relationPayload = { businesseventId, timeeventId, _working: true };
        const relationResult = await nccBuilderFetch(config, "/businesseventtimeevent", "POST", relationPayload);
        addStep("attachTimeEventToBusinessEvent", relationResult, relationPayload);
        if (!relationResult.ok) { sendJson(res, relationResult.status, { error: "Failed to attach time event to business event.", steps }); return; }
      }

      let promptId = "";
      let promptName = "";
      const outOfHoursMessage = String(body.outOfHoursMessage || "").trim();
      if (outOfHoursMessage) {
        promptName = String(body.outOfHoursPromptName || `${campaignName} out of hours`).trim();
        const promptPayload = buildNccBuilderPromptPayload(promptName, outOfHoursMessage);
        const promptResult = await nccBuilderFetch(config, "/prompt", "POST", promptPayload);
        addStep("createOutOfHoursPrompt", promptResult, promptPayload);
        if (!promptResult.ok) { sendJson(res, promptResult.status, { error: "Failed to create out-of-hours prompt.", steps }); return; }
        promptId = nccId(promptResult.data, "promptId");
        if (!promptId) { sendJson(res, 502, { error: "NCC did not return prompt id.", steps }); return; }
      }

      const workflowPatchPayload = buildNccBuilderWorkflowBusinessHoursPatch(
        workflowResult.data,
        businessEventName,
        promptId ? { id: promptId, name: promptName } : null,
        queueId ? { id: queueId, name: queueName } : null
      );
      const workflowPatchResult = await nccBuilderFetch(config, `/workflow/${encodeURIComponent(workflowId)}`, "PATCH", workflowPatchPayload);
      addStep("patchWorkflowBusinessHours", workflowPatchResult, workflowPatchPayload);
      if (!workflowPatchResult.ok) { sendJson(res, workflowPatchResult.status, { error: "Failed to patch workflow business hours.", steps }); return; }

      sendJson(res, 200, {
        ok: true,
        campaignId,
        workflowId,
        queueId,
        businesseventId,
        timeeventId,
        promptId,
        messages: {
          inHours: String(body.inHoursMessage || "").trim(),
          outOfHours: outOfHoursMessage,
          note: outOfHoursMessage ? "Out-of-hours prompt was created and added to the workflow." : "No out-of-hours prompt was created because the message was empty."
        },
        steps
      });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message, details: error.details, steps });
    }
    return;
  }

  sendJson(res, 404, { error: "NCC campaign builder route not found." });
}
// ──────────────────────────────────────────────────────────────────────────

function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`NextIQ Chat running at http://${HOST}:${PORT}`);

    const health = getHealthStatus();
    if (!health.configured) {
      console.error(`Configuration error: ${health.error}`);
    }
  });
}

function createFirestoreClient() {
  try {
    if (
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.K_SERVICE ||
      process.env.FUNCTION_TARGET
    ) {
      return new Firestore();
    }
  } catch (error) {
    return null;
  }

  return null;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  handleRequest,
  startServer
};
