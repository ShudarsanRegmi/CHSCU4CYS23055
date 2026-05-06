/* Logging Middleware - Makes API calls to the Test Server for centralized logging */

const axios = require('axios');
try {
  require('dotenv').config();
} catch (e) {
  // ignore if dotenv not available
}

const LOG_DEBUG = !!process.env.LOG_DEBUG;

const LOG_API_URL = (process.env.LOG_API_URL || 'http://20.207.122.201/evaluation-service/logs');
const AUTH_API_URL = (process.env.AUTH_API_URL || 'http://20.207.122.201/evaluation-service/auth');

const VALID_STACKS = ['backend', 'frontend'];
const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const VALID_PACKAGES_BACKEND = [
  'cache', 'controller', 'cron_job', 'db', 'domain',
  'handler', 'repository', 'route', 'service'
];
const VALID_PACKAGES_FRONTEND = [
  'api', 'component', 'hook', 'page', 'state', 'style'
];
const VALID_PACKAGES_BOTH = ['auth', 'config', 'middleware', 'utils'];

let authToken =
  (typeof process !== 'undefined' && process.env && (process.env.token || process.env.LOG_JWT_TOKEN || process.env.AUTH_TOKEN)) ||
  null;

let tokenExpiry = 0; // epoch ms
let authInFlight = null;

function _envAuthPayload() {
  return {
    email: process.env.AUTH_EMAIL,
    name: process.env.AUTH_NAME,
    rollNo: process.env.AUTH_ROLLNO,
    accessCode: process.env.AUTH_ACCESS_CODE,
    clientID: process.env.AUTH_CLIENT_ID,
    clientSecret: process.env.AUTH_CLIENT_SECRET
  };
}

function setAuthToken(token) {
  authToken = token;
  // if user supplied a token via env or setAuthToken, assume a reasonable default expiry
  if (token && (!tokenExpiry || tokenExpiry < Date.now())) {
    const envExpiry = Number(process.env.AUTH_TOKEN_EXPIRY_MS) || 24 * 60 * 60 * 1000;
    tokenExpiry = Date.now() + envExpiry;
    if (LOG_DEBUG) console.log('logging_middleware: setAuthToken applied, expiry in ms', envExpiry);
  }
}

function getAuthToken() {
  return authToken;
}

async function authenticate() {
  const now = Date.now();
  if (authToken && tokenExpiry && now < tokenExpiry - 5000) {
    return authToken;
  }

  if (authInFlight) {
    try {
      await authInFlight;
    } catch (e) {
      // ignore and allow retry
    }
    return authToken;
  }

  const payload = _envAuthPayload();
  authInFlight = (async () => {
    try {
      const resp = await axios.post(AUTH_API_URL, payload, { headers: { 'Content-Type': 'application/json' } });
      const data = resp && resp.data ? resp.data : null;
      if (data && data.access_token) {
        authToken = data.access_token;
        const expires = Number(data.expires_in) || 0;
        if (expires > 1e12) {
          tokenExpiry = expires;
        } else if (expires > 1e9) {
          tokenExpiry = expires * 1000;
        } else if (expires > 0) {
          tokenExpiry = Date.now() + expires * 1000;
        } else {
          tokenExpiry = Date.now() + 5 * 60 * 1000;
        }
        if (LOG_DEBUG) console.log('logging_middleware: obtained token, expires at', new Date(tokenExpiry).toISOString());
      }
    } catch (err) {
      if (LOG_DEBUG) console.warn('logging_middleware: authenticate() error', err && err.message);
      // keep existing token if present
    } finally {
      authInFlight = null;
    }
  })();

  await authInFlight;
  return authToken;
}

function validateParams(stack, level, pkg) {
  if (!VALID_STACKS.includes(stack)) {
    return false;
  }

  if (!VALID_LEVELS.includes(level)) {
    return false;
  }

  const allowedPackages = stack === 'backend'
    ? [...VALID_PACKAGES_BACKEND, ...VALID_PACKAGES_BOTH]
    : [...VALID_PACKAGES_FRONTEND, ...VALID_PACKAGES_BOTH];

  return allowedPackages.includes(pkg);
}

async function Log(stack, level, pkg, message) {
  try {
    if (!validateParams(stack, level, pkg)) {
      return null;
    }

    const headers = { 'Content-Type': 'application/json' };

    // ensure we have a fresh token (uses env credentials)
    try {
      await authenticate();
    } catch (e) {
      // silent - we'll try with whatever token we have
    }

    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await axios.post(
      LOG_API_URL,
      {
        stack: stack.toLowerCase(),
        level: level.toLowerCase(),
        package: pkg.toLowerCase(),
        message
      },
      { headers }
    );

    return response.data;
  } catch (error) {
    return null;
  }
}


module.exports = {
  Log,
  setAuthToken,
  authenticate,
  VALID_STACKS,
  VALID_LEVELS,
  VALID_PACKAGES_BACKEND,
  VALID_PACKAGES_FRONTEND,
  VALID_PACKAGES_BOTH
};

// Start implicit authentication in background if credentials/token are present in env
(function implicitAuthInit() {
  try {
    const payload = _envAuthPayload();
    const hasCreds = Object.values(payload).some(v => !!v);
    if (authToken) {
      if (LOG_DEBUG) console.log('logging_middleware: auth token already present from env');
      return;
    }

    if (hasCreds) {
      if (LOG_DEBUG) console.log('logging_middleware: attempting implicit authenticate()');
      authenticate().catch(err => {
        if (LOG_DEBUG) console.warn('logging_middleware: implicit authenticate failed', err && err.message);
      });
    } else {
      if (LOG_DEBUG) console.log('logging_middleware: no auth credentials found in env; proceeding without implicit auth');
    }
  } catch (e) {
    if (LOG_DEBUG) console.warn('logging_middleware: implicitAuthInit error', e && e.message);
  }
})();