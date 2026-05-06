## Stage 1

### Core actions

Main types: Placement, Event, Result.

Main actions: create, list, read one, mark read/unread, mark all read, delete/archive, real-time push.

### REST API style

Base path: `/api/v1`

Rules: use lowercase nouns, normal HTTP methods, camelCase JSON, UTC ISO timestamps.

### Endpoints

#### Create

`POST /api/v1/notifications`

Body:

```json
{ "studentId": 1042, "type": "Placement", "title": "New placement drive announced", "message": "afford medical will visit campus next week.", "priority": "high", "metadata": { "source": "placement-office", "targetGroup": "final-year" } }
```

Returns `201 Created` with the saved notification.

#### List for a student

`GET /api/v1/students/{studentId}/notifications?isRead=false&type=Placement&limit=20&cursor=abc123`

Filters: `isRead`, `type`, `limit`, `cursor`.

Returns a paged list of notifications.

#### Fetch one

`GET /api/v1/notifications/{notificationId}`

#### Mark read

`PATCH /api/v1/notifications/{notificationId}` with `{ "isRead": true }`

#### Mark all read

`PATCH /api/v1/students/{studentId}/notifications` with `{ "isRead": true }`

#### Delete

`DELETE /api/v1/notifications/{notificationId}`

### JSON shape

```json
{ "id": "string", "studentId": "number", "type": "Placement | Result | Event", "title": "string", "message": "string", "priority": "low | medium | high", "isRead": "boolean", "createdAt": "string", "updatedAt": "string", "metadata": "object" }
```

### Headers

- Request: `Content-Type`, `Accept`, optional `Authorization`, `X-Request-Id`
- Response: `Cache-Control: no-store`, `X-Request-Id`

### Real-time notifications

Use WebSocket: `wss://<host>/api/v1/ws/notifications`.

Flow: save notification first, then push to connected student. If offline, REST still works.

Fallback: Server-Sent Events at `/api/v1/notifications/stream`.

### Summary of above

- POST create, GET list, PATCH read, DELETE remove, WebSocket for live push.
