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
{ "studentId": 1042, "type": "Placement", "title": "New placement drive announced", "message": "some company will visit campus next week.", "priority": "high", "metadata": { "source": "placement-office", "targetGroup": "final-year" } }
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

---

## Stage 2

### Database choice

Using **PostgreSQL** (SQL). Why? We need fast lookups by `studentId` and `isRead`, pagination, and complex filtering. SQL indexes handle this well. Also easier to maintain consistency. NoSQL would be overkill and harder to query.

### Schema

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL,
  type ENUM ('Placement', 'Result', 'Event') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  priority ENUM ('low', 'medium', 'high') DEFAULT 'medium',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP UTC DEFAULT NOW(),
  updated_at TIMESTAMP UTC DEFAULT NOW(),
  metadata JSONB,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX idx_student_id_created_at ON notifications(student_id, created_at DESC);
CREATE INDEX idx_student_id_is_read ON notifications(student_id, is_read);
CREATE INDEX idx_student_id_type ON notifications(student_id, type);
```

### Scale problems & solutions

**Problem**: List queries slow down with large volume of notifications across large number of students

- **Solution**: Indexes on `(student_id, created_at)` and `(student_id, is_read)` : covered queries.

**Problem**: Pagination becomes slow with large cursor offsets.

- **Solution**: Usnig keyset pagination: `WHERE student_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 20`.

**Problem**: Mark all as read for 1 student touches many rows.

- **Solution**: Batch updates, or soft-delete with archive flag instead.

**Problem**: Storage grows fast with metadata JSONB.

- **Solution**: Archive old notifications to a separate table yearly, keep hot data in main table.

### Queries based on Stage 1

List notifications for student (with pagination):
```sql
SELECT * FROM notifications 
WHERE student_id = 1042 AND is_read = false 
ORDER BY created_at DESC 
LIMIT 20;
```

Mark as read:
```sql
UPDATE notifications 
SET is_read = true, updated_at = NOW() 
WHERE id = 'ntf_91a8f2';
```

Mark all as read:
```sql
UPDATE notifications 
SET is_read = true, updated_at = NOW() 
WHERE student_id = 1042 AND is_read = false;
```

List by type:
```sql
SELECT * FROM notifications 
WHERE student_id = 1042 AND type = 'Placement' 
ORDER BY created_at DESC 
LIMIT 20;
```

Delete:
```sql
DELETE FROM notifications WHERE id = 'ntf_91a8f2';
```

Count unread by type:
```sql
SELECT type, COUNT(*) FROM notifications 
WHERE student_id = 1042 AND is_read = false 
GROUP BY type;
```
