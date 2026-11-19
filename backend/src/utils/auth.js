const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// ---------- Signing secret ----------
// JWT_SECRET comes from the environment. When it is missing, one is generated once and stored in backend/.env.local
// (untracked) so tokens survive a nodemon restart.
const ENV_LOCAL = path.join(__dirname, '..', '..', '.env.local');
let cachedSecret = null;
const getSecret = () => {
  if (cachedSecret) return cachedSecret;
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    cachedSecret = process.env.JWT_SECRET;
    return cachedSecret;
  }
  try {
    const text = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, 'utf8') : '';
    const found = text.match(/^JWT_SECRET=(\S{32,})\s*$/m);
    if (found) {
      cachedSecret = found[1];
      return cachedSecret;
    }
    const fresh = crypto.randomBytes(48).toString('hex');
    fs.appendFileSync(ENV_LOCAL, `${text && !text.endsWith('\n') ? '\n' : ''}JWT_SECRET=${fresh}\n`);
    cachedSecret = fresh;
  } catch (error) {
    console.error('Could not persist JWT_SECRET, using a temporary one (sessions end on restart):', error.message);
    cachedSecret = crypto.randomBytes(48).toString('hex');
  }
  return cachedSecret;
};

const TOKEN_TTL = process.env.JWT_TTL || '12h';

const issueToken = (user) =>
  jwt.sign(
    { uid: user.user_id, rid: user.role_id, role: String(user.role_name || '').toLowerCase(), un: user.username },
    getSecret(),
    { expiresIn: TOKEN_TTL }
  );

// ---------- Token reading ----------
const readCookie = (req, name) => {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return null; }
    }
  }
  return null;
};

const COOKIE_NAME = 'cms_session';

// Page images / file links cannot send a header, so /uploads also accepts the session cookie set at login.
const tokenOf = (req, { allowCookie = false } = {}) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return allowCookie ? readCookie(req, COOKIE_NAME) : null;
};

const setSessionCookie = (res, token) => {
  res.append('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}`);
};

// ---------- Is the account still active? (30 s cache so a deactivation takes effect quickly) ----------
const activeCache = new Map();
const ACTIVE_TTL_MS = 30 * 1000;
const isStillActive = async (pool, userId) => {
  const hit = activeCache.get(userId);
  if (hit && Date.now() - hit.at < ACTIVE_TTL_MS) return hit.active;
  const [rows] = await pool.query('SELECT is_active FROM users WHERE user_id = ?', [userId]);
  const active = rows.length > 0 && Number(rows[0].is_active) === 1;
  activeCache.set(userId, { active, at: Date.now() });
  return active;
};

// ---------- Public API routes (everything else under /api needs a token) ----------
const PUBLIC_ROUTES = new Set([
  'POST /api/login',
  'POST /api/check-username',
  'POST /api/verify-identifier',
  'POST /api/forgot-password',
]);

const STAFF = ['nurse', 'admin'];

// [method, path pattern, roles allowed]. First match wins. Reads stay open to any signed-in user.
const ROLE_RULES = [
  // medicine stock
  ['POST|PUT|DELETE', /^\/api\/(medicines|batches)(\/|$)/, STAFF],
  ['POST', /^\/api\/restock-reports\/generate$/, STAFF],
  ['DELETE', /^\/api\/frequent-complaints\/dismiss$/, STAFF],
  // clinic reference data
  ['POST|PUT|DELETE', /^\/api\/medical-requirements(\/|$)/, STAFF],
  ['POST|PUT|DELETE', /^\/api\/(partner-facilities|facility-services)(\/|$)/, STAFF],
  ['POST|PUT|DELETE', /^\/api\/emergency-hotlines(\/|$)/, STAFF],
  // accounts
  ['POST|PUT|DELETE', /^\/api\/doctor-accounts(\/|$)/, STAFF],
  ['POST|PUT|DELETE', /^\/api\/students\/(import\/|move-up\/)?manageStudentAccounts/, STAFF],
  ['POST|PUT|DELETE', /^\/api\/students\/[^/]+\/manageStudentAccounts$/, STAFF],
  ['PUT', /^\/manageParentAccount$/, STAFF],
  ['PUT', /^\/api\/parents\/[^/]+(\/contact)?$/, ['parent', ...STAFF]],
  // insurance vault
  ['POST|PUT|DELETE', /^\/api\/insurance-vault(\/|$)/, STAFF],
  // appointments cleanup, reminders
  ['DELETE', /^\/api\/doctor-visits\/(appointments|batch\/)/, STAFF],
  ['POST', /^\/api\/(doctor-visits|screenings)\/send-reminders$/, STAFF],
  ['PUT', /^\/api\/doctor-schedules\/[^/]+\/reopen$/, STAFF],
  // (the PUT .../listing of a service is the doctor's, so only POST / DELETE are staff-only)
  ['POST|DELETE', /^\/api\/consultations-offered(\/|$)/, STAFF],
];

const roleRuleFor = (method, pathname) => {
  for (const [methods, pattern, roles] of ROLE_RULES) {
    if (methods.split('|').includes(method) && pattern.test(pathname)) return roles;
  }
  return null;
};

// Runs before every route. Public auth routes pass; everything else needs a valid token, an active account and the right role.
const authMiddleware = (pool) => async (req, res, next) => {
  const pathname = req.originalUrl.split('?')[0];
  const isApi = pathname.startsWith('/api/') || pathname === '/manageParentAccount';
  if (!isApi) return next();
  if (req.method === 'OPTIONS') return next();
  if (PUBLIC_ROUTES.has(`${req.method} ${pathname}`)) return next();

  const token = tokenOf(req);
  if (!token) return res.status(401).json({ success: false, message: 'Please log in again.' });
  let claims;
  try {
    claims = jwt.verify(token, getSecret());
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Your session ended. Please log in again.' });
  }
  try {
    if (!(await isStillActive(pool, claims.uid))) {
      return res.status(401).json({ success: false, message: 'This account is no longer active.' });
    }
  } catch (error) {
    console.error('Auth check failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not verify the session.' });
  }
  req.auth = { user_id: claims.uid, role_id: claims.rid, role: claims.role, username: claims.un };

  const allowed = roleRuleFor(req.method, pathname);
  if (allowed && !allowed.includes(req.auth.role)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to do this.' });
  }
  next();
};

// /uploads needs a signed-in user too (header or session cookie).
const uploadsGuard = (pool) => async (req, res, next) => {
  const token = tokenOf(req, { allowCookie: true }) || (typeof req.query.token === 'string' ? req.query.token : null);
  if (!token) return res.status(401).send('Please log in.');
  try {
    const claims = jwt.verify(token, getSecret());
    if (!(await isStillActive(pool, claims.uid))) return res.status(401).send('Account is not active.');
    next();
  } catch (error) {
    res.status(401).send('Please log in.');
  }
};

// ---------- Failure rate limit (failed attempts only; a success clears the counter) ----------
const buckets = new Map();
const prune = () => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
};
setInterval(prune, 10 * 60 * 1000).unref();

const failureLimiter = ({ name, windowMs = 15 * 60 * 1000, perUser = 8, perIp = 40, userOf }) => (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const user = String(userOf ? userOf(req) : '').toLowerCase();
  const keys = [`${name}|ip|${ip}`];
  if (user) keys.push(`${name}|user|${user}`);
  const limits = { [keys[0]]: perIp, [keys[1]]: perUser };

  const now = Date.now();
  for (const key of keys) {
    const b = buckets.get(key);
    if (b && b.resetAt > now && b.count >= limits[key]) {
      const minutes = Math.max(1, Math.ceil((b.resetAt - now) / 60000));
      return res.status(429).json({ success: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
    }
  }

  res.on('finish', () => {
    const at = Date.now();
    if (res.statusCode < 400) {
      if (user) buckets.delete(keys[1]);
      return;
    }
    if (res.statusCode === 429 || res.statusCode >= 500) return;
    for (const key of keys) {
      const b = buckets.get(key);
      if (b && b.resetAt > at) b.count += 1;
      else buckets.set(key, { count: 1, resetAt: at + windowMs });
    }
  });
  next();
};

module.exports = {
  issueToken,
  setSessionCookie,
  authMiddleware,
  uploadsGuard,
  failureLimiter,
  getSecret,
};
