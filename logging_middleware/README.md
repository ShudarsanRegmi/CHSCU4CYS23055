# Logging Middleware

A reusable logging package for Node.js applications (Backend & Frontend) that sends logs to the Affordmed Test Server.

## Usage

### Basic Setup

```javascript
const { Log, setAuthToken } = require('./src/index.js');
setAuthToken('jwt-token');
Log('backend', 'info', 'handler', 'User login successful');
```

### Log Function Signature

```javascript
Log(stack, level, package, message)
```


### Examples

**Backend logging:**
```javascript
Log('backend', 'error', 'handler', 'received string, expected bool');
Log('backend', 'fatal', 'db', 'Critical database connection failure');
```

**Frontend logging:**
```javascript
Log('frontend', 'info', 'component', 'NotificationList mounted');
Log('frontend', 'warn', 'api', 'Failed to fetch notifications, retrying...');
```

**Shared packages:**
```javascript
Log('backend', 'info', 'auth', 'User authenticated successfully');
```

## API Details

All logs are sent to: `http://20.207.122.201/evaluation-service/logs`