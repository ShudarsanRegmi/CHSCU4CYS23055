import React, { useEffect, useMemo, useState } from 'react';
import { Log } from './logger';

const DEFAULT_STUDENT_ID = 1042;

const initialForm = {
  studentId: DEFAULT_STUDENT_ID,
  type: 'Placement',
  title: '',
  message: '',
  priority: 'medium'
};

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export default function App() {
  const [studentId, setStudentId] = useState(DEFAULT_STUDENT_ID);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const loadNotifications = async (sid = studentId) => {
    try {
      setLoading(true);
      setError('');
      await Log('frontend', 'info', 'page', `Loading notifications for student ${sid}`);
      const data = await apiFetch(`/api/v1/students/${sid}/notifications?isRead=false&limit=20`);
      setNotifications(data.data || []);
      await Log('frontend', 'info', 'page', `Loaded ${data.data?.length || 0} notifications for student ${sid}`);
    } catch (err) {
      setError('Failed to load notifications');
      await Log('frontend', 'error', 'page', `Failed to load notifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Log('frontend', 'info', 'page', 'Notification dashboard mounted');
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setMessage('');
      await Log('frontend', 'info', 'component', `Creating notification for student ${form.studentId}`);
      await apiFetch('/api/v1/notifications', {
        method: 'POST',
        body: JSON.stringify({
          studentId: Number(form.studentId),
          type: form.type,
          title: form.title,
          message: form.message,
          priority: form.priority,
          metadata: { source: 'frontend-demo' }
        })
      });
      setMessage('Notification created successfully');
      setForm(initialForm);
      await loadNotifications(form.studentId);
      await Log('frontend', 'info', 'component', 'Notification created successfully');
    } catch (err) {
      setMessage('');
      setError('Could not create notification');
      await Log('frontend', 'error', 'component', `Create notification failed: ${err.message}`);
    }
  };

  const markRead = async (id) => {
    try {
      await apiFetch(`/api/v1/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead: true })
      });
      await Log('frontend', 'info', 'component', `Marked notification ${id} as read`);
      loadNotifications();
    } catch (err) {
      setError('Could not update notification');
      await Log('frontend', 'error', 'component', `Mark read failed: ${err.message}`);
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Notification Dashboard</p>
          <h1>Campus notifications, one place.</h1>
          <p className="subtext">Simple frontend with real-time-ready logging and REST integration.</p>
        </div>
        <div className="stats">
          <div>
            <span>Student</span>
            <strong>{studentId}</strong>
          </div>
          <div>
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Create notification</h2>
            <button className="secondary" onClick={() => loadNotifications()}>Refresh</button>
          </div>

          <form className="form" onSubmit={handleCreate}>
            <div className="field-row">
              <label>
                Student ID
                <input
                  type="number"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                />
              </label>
              <label>
                Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Placement</option>
                  <option>Result</option>
                  <option>Event</option>
                </select>
              </label>
            </div>

            <label>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Drive announcement"
                required
              />
            </label>

            <label>
              Message
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Write the notification message"
                rows="4"
                required
              />
            </label>

            <div className="field-row">
              <label>
                Priority
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <div className="button-row">
                <button type="submit">Send</button>
              </div>
            </div>
          </form>

          {(message || error) && (
            <div className={`notice ${error ? 'error' : 'success'}`}>{error || message}</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Unread notifications</h2>
            {loading ? <span>Loading...</span> : <span>{notifications.length} items</span>}
          </div>

          <div className="list">
            {notifications.map((item) => (
              <article className="card" key={item.id}>
                <div className="card-top">
                  <span className={`badge ${item.type.toLowerCase()}`}>{item.type}</span>
                  <button className="link" onClick={() => markRead(item.id)}>Mark read</button>
                </div>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <div className="meta">
                  <span>{item.priority}</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </article>
            ))}
            {!loading && notifications.length === 0 && <p className="empty">No unread notifications.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
