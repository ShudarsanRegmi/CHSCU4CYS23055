/* Main Express Server with WebSocket Support */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const routes = require('./routes');
const { Log } = require('./logger');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging
app.use(async (req, res, next) => {
  Log('backend', 'info', 'middleware', `${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket: Real-time notifications
const studentConnections = {};

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const studentId = url.searchParams.get('studentId');

  if (!studentId) {
    ws.close(1008, 'studentId required');
    return;
  }

  if (!studentConnections[studentId]) {
    studentConnections[studentId] = [];
  }
  studentConnections[studentId].push(ws);

  Log('backend', 'info', 'middleware', `WebSocket connected for student ${studentId}`);

  ws.on('close', () => {
    studentConnections[studentId] = studentConnections[studentId].filter(s => s !== ws);
    Log('backend', 'info', 'middleware', `WebSocket disconnected for student ${studentId}`);
  });

  ws.on('error', (error) => {
    Log('backend', 'error', 'middleware', `WebSocket error: ${error.message}`);
  });
});

// Function to broadcast notification to a student
function broadcastToStudent(studentId, notification) {
  if (studentConnections[studentId]) {
    const message = JSON.stringify({
      event: 'notification.created',
      data: notification
    });
    studentConnections[studentId].forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Override db.create to broadcast notifications
const originalCreate = db.create.bind(db);
db.create = function(notification) {
  const notif = originalCreate(notification);
  broadcastToStudent(notif.studentId, notif);
  return notif;
};

// Error handling
app.use((err, req, res, next) => {
  Log('backend', 'error', 'middleware', `Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, async () => {
  await Log('backend', 'info', 'service', `Backend API running on http://localhost:${PORT}`);
  await Log('backend', 'info', 'service', `WebSocket server running on ws://localhost:${PORT}`);
  await Log('backend', 'info', 'service', `Health check available at http://localhost:${PORT}/health`);
  await Log('backend', 'info', 'service', 'Backend server started successfully');
});

module.exports = server;
