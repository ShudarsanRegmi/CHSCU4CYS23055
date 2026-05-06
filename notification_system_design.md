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

---

## Stage 3

### Given slow query analysis

```sql
SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt ASC;
```

**Is it accurate?** Mostly yes, but ordering ASC is not correct. DESC is needed for newest first.

**Why slow?** No indexes and with 5M notifications, full table scan will happen every time.

**What to change:**
```sql
SELECT * FROM notifications 
WHERE student_id = 1042 AND is_read = false 
ORDER BY created_at DESC 
LIMIT 20;
```

Index should be added: `(student_id, is_read, created_at)`.

**Cost:** Index lookup + range scan = O(log n + k) instead of O(n).

**Index on every column?** No. Waste of space and maintenance. Only index columns used in WHERE, ORDER BY, and JOINs.

**Students who received notifications in last 7 days:**
```sql
SELECT DISTINCT student_id FROM notifications 
WHERE created_at >= NOW() - INTERVAL '7 days'
AND type IN ('Event', 'Result', 'Placement');
```

---

## Stage 4

### Problem: Page load overwhelms DB

Notifications fetched on every page load = N requests per second × 50K students = potential DB crush.

### Solutions

1. **Cache layer (Redis):** Store top 20 unread per student. TTL 5 mins.
   - Trade-off: Slightly stale data, but much faster.

2. **Lazy load on frontend:** Load only when user clicks "Notifications" tab.
   - Trade-off: UX lag on first click.

3. **Pagination + keyset cursor:** Never load all at once.
   - Trade-off: More complex queries.

4. **Background job to pre-warm cache:** Nightly compute unread counts.
   - Trade-off: Extra infra, but worth it.

**Best approach:** Redis cache (1) + lazy load (2) + pagination (3).

---

## Stage 5

### Problem: Send notifications to 50K students (email + in-app)

**Pseudocode issues:**

```js
for (let studentId of student_ids) {
  send_email(studentId);      // Fails at 200, loop stops
  save_to_db(studentId);
  push_to_app(studentId);
}
```

**Issues:**
- Single failure stops everything (no retry)
- Email + DB + push are synchronous = slow
- No rollback on partial failure
- 50K sequential calls = hours

**What happens if send_email fails midway?**
- 200 students didn't get email
- But DB saved all 50K (inconsistent state)
- Push notifications sent to all (partial delivery)

**Redesign:**

```js
// 1. Queue all jobs (async)
for (let studentId of student_ids) {
  queue.push({ type: 'notify', studentId, step: 'email' });
}

// 2. Workers process in parallel (10-20 workers)
worker.process('notify', async (job) => {
  try {
    await send_email(job.studentId);
    await save_to_db(job.studentId, 'email_sent');
  } catch (err) {
    // Retry with exponential backoff, log failure
    job.retry();
  }
});

// 3. Separate queue for push after email done
db.on('email_sent', (studentId) => {
  queue.push({ type: 'push', studentId });
});
```

**Should DB and email happen together?** No.
- Email first, then DB (mark as sent)
- Ensures no duplicate sends if job retries
- Better for disaster recovery

**Benefits:**
- Parallel workers = 50K done in minutes, not hours
- Failed jobs auto-retry
- Partial failure doesn't stop other students
- State tracked in DB per student

---

## Stage 6

### Approach: Priority Ranking Algorithm

**Priority Score = TypeWeight × 1000 + RecencyScore**

- Type weights: Placement (3), Result (2), Event (1)
- Recency score: 1000 - (age in hours). Newer = higher.

**Example:**
- Placement notif 10 mins old: 3000 + 999.8 = 3999.8
- Result notif 30 mins old: 2000 + 999.5 = 2999.5
- Event notif 2 hours old: 1000 + 999 = 2000

Result: Placement shows first, then Result, then Event.

### Algorithm Flow

1. Fetch all unread notifications from API (`GET /api/v1/students/{studentId}/notifications`)
2. Calculate priority score for each
3. Sort by score (descending)
4. Return top 10
5. Display with type emoji + score

### Maintain top 10 as new notifications arrive

**For real-time:**
- Use Redis sorted set: `notif:${studentId}` with priority score as score
- On new notification: compute score, ZADD to sorted set
- Keep only top 10 with ZREMRANGEBYRANK
- TTL: 5 minutes

**For DB efficiency:**
- Index on `(student_id, is_read) ASC, priority_score DESC`
- Query: `SELECT * FROM notifications WHERE student_id = ? AND is_read = false ORDER BY priority_score DESC LIMIT 10`
- Recompute priority_score on insert via trigger

### Code Location

- Implementation: `src/top-notifications.js`
- Demo script: `stage6-demo.js`
- Run demo: `npm run stage6`

### Sample Output

See demo output below showing top notifications ranked by priority.

```
================================================================================
TOP PRIORITY NOTIFICATIONS
================================================================================

1. [Placement] Microsoft Drive - Registration Open
   Priority Score: 3999.98
   Message: Register before 5 PM today
   Created: May 6, 2026, 3:45:30 PM
   Read: No
--------------------------------------------------------------------------------

2. [Placement] Goldman Sachs Drive - On Campus
   Priority Score: 3999.50
   Message: Eligibility: 8.0+ CGPA. Apply now!
   Created: May 6, 2026, 3:15:00 PM
   Read: No
--------------------------------------------------------------------------------

3. [Result] Semester Grades Published
   Priority Score: 2999.75
   Message: Your grades for Semester 7 are now available
   Created: May 6, 2026, 12:00:00 PM
   Read: No
--------------------------------------------------------------------------------

4. [Event] Campus Tech Talk - AI in Healthcare
   Priority Score: 1998.00
   Message: Join us for an interactive session on AI applications
   Created: May 6, 2026, 1:45:30 PM
   Read: No
--------------------------------------------------------------------------------

5. [Event] Hackathon 2026
   Priority Score: 1000.00
   Message: Build innovative solutions. Exciting prizes!
   Created: May 5, 2026, 3:45:30 PM
   Read: No
--------------------------------------------------------------------------------

6. [Result] Assignment 3 Feedback
   Priority Score: 2000.00
   Message: Your submission has been graded. Score: 18/20
   Created: May 5, 2026, 3:45:30 PM
   Read: No
--------------------------------------------------------------------------------
```
