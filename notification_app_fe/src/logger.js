import { Log, setAuthToken } from 'logging-middleware';

const token = import.meta.env.VITE_LOG_JWT_TOKEN || import.meta.env.VITE_TOKEN || '';

if (token) {
  setAuthToken(token);
}

export { Log };
