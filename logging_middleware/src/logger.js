/* Logging Middleware - Makes API calls to the Test Server for centralized logging */

const axios = require('axios');

const LOG_API_URL = 'http://20.207.122.201/evaluation-service/logs';


// Valid values for stack, level, and package
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

// Authorization token (set by the application)
let authToken = null;


function setAuthToken(token) {
  authToken = token;
}


function validateParams(stack, level, pkg) {
  if (!VALID_STACKS.includes(stack)) {
    console.error(`Invalid stack: ${stack}. Must be one of ${VALID_STACKS.join(', ')}`);
    return false;
  }

  if (!VALID_LEVELS.includes(level)) {
    console.error(`Invalid level: ${level}. Must be one of ${VALID_LEVELS.join(', ')}`);
    return false;
  }

  const allowedPackages = stack === 'backend' 
    ? [...VALID_PACKAGES_BACKEND, ...VALID_PACKAGES_BOTH]
    : [...VALID_PACKAGES_FRONTEND, ...VALID_PACKAGES_BOTH];

  if (!allowedPackages.includes(pkg)) {
    console.error(`Invalid package: ${pkg} for stack: ${stack}. Allowed: ${allowedPackages.join(', ')}`);
    return false;
  }

  return true;
}

// Main Log Function
async function Log(stack, level, pkg, message) {
  try {
    // Validate parameters
    if (!validateParams(stack, level, pkg)) {
      return;
    }

    // Prepare request body
    const logData = {
      stack: stack.toLowerCase(),
      level: level.toLowerCase(),
      package: pkg.toLowerCase(),
      message: message
    };

    // Prepare headers with auth token
    const headers = {
      'Content-Type': 'application/json'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // call
    const response = await axios.post(LOG_API_URL, logData, { headers });

    // log call to console
    if (process.env.LOG_DEBUG === 'true') {
      console.log(`[LOG_SENT] ${stack}/${level}/${pkg}: ${message}`);
    }

    return response.data;

  } catch (error) {
    // Silently fail or log to console based on env
    if (process.env.LOG_DEBUG === 'true') {
      console.error('[LOG_ERROR] Failed to send log:', error.message);
    }
  }
}


module.exports = {
  Log,
  setAuthToken,
  VALID_STACKS,
  VALID_LEVELS,
  VALID_PACKAGES_BACKEND,
  VALID_PACKAGES_FRONTEND,
  VALID_PACKAGES_BOTH
};