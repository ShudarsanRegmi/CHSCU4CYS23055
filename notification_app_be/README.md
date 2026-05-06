# Notification System Backend

Express.js + WebSocket server for real-time notifications.

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Server runs on `http://localhost:3000`
WebSocket: `ws://localhost:3000?studentId=1042`

## API Endpoints

All endpoints follow `/api/v1` base path.

### Create Notification
`POST /api/v1/notifications`

```json
{
  "studentId": 1042,
  "type": "Placement",
  "title": "Drive Announcement",
  "message": "Goldman Sachs will visit campus",
  "priority": "high",
  "metadata": {}
}
```

### List Notifications
`GET /api/v1/students/{studentId}/notifications?isRead=false&type=Placement&limit=20`

### Get One
`GET /api/v1/notifications/{notificationId}`

### Mark Read
`PATCH /api/v1/notifications/{notificationId}` with `{ "isRead": true }`

### Mark All Read
`PATCH /api/v1/students/{studentId}/notifications`

### Delete
`DELETE /api/v1/notifications/{notificationId}`

## Features

- In-memory database (mock PostgreSQL)
- Real-time WebSocket notifications
- Logging middleware integration
- Error handling
- Type validation
- Pagination support

## Logging

Every request/action is logged to the test server via logging middleware.

- Stack: `backend`
- Levels: `info`, `warn`, `error`
- Packages: `handler`, `middleware`, `service`
