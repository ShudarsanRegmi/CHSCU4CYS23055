const LOG_API_URL = 'http://20.207.122.201/evaluation-service/logs';

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

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
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

export async function Log(stack, level, pkg, message) {
  try {
    if (!validateParams(stack, level, pkg)) {
      return null;
    }

    const response = await fetch(LOG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        stack: stack.toLowerCase(),
        level: level.toLowerCase(),
        package: pkg.toLowerCase(),
        message
      })
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export {
  VALID_STACKS,
  VALID_LEVELS,
  VALID_PACKAGES_BACKEND,
  VALID_PACKAGES_FRONTEND,
  VALID_PACKAGES_BOTH
};
