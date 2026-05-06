/* Logger helper - wraps the reusable logging middleware package */

const fs = require('fs');
const path = require('path');
const middleware = require('../logging_middleware');

function loadTokenFromSharedEnv() {
  const envPath = path.join(__dirname, '..', 'logging_middleware', '.env');

  if (!fs.existsSync(envPath)) {
    return null;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (key === 'token' || key === 'LOG_JWT_TOKEN' || key === 'AUTH_TOKEN') {
      return value;
    }
  }

  return null;
}

const token = loadTokenFromSharedEnv();
if (token) {
  middleware.setAuthToken(token);
}

module.exports = middleware;
