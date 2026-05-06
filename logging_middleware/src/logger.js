/* Logging Middleware - Makes API calls to the Test Server for centralized logging */

const axios = require('axios');

const LOG_API_URL = 'http://20.207.122.201/evaluation-service/logs';


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

