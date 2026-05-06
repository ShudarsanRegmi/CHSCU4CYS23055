/* Notification Controller - Business Logic */

const db = require('./db');
const { Log } = require('./logger');

async function createNotification(req, res) {
  try {
    const { studentId, type, title, message, priority, metadata } = req.body;

    if (!studentId || !type || !title) {
      await Log('backend', 'warn', 'handler', 'Missing required fields in create notification');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['Placement', 'Result', 'Event'].includes(type)) {
      await Log('backend', 'warn', 'handler', `Invalid type: ${type}`);
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const notif = db.create({
      studentId,
      type,
      title,
      message,
      priority: priority || 'medium',
      metadata: metadata || {}
    });

    await Log('backend', 'info', 'handler', `Created notification ${notif.id} for student ${studentId}`);
    res.status(201).json(notif);
  } catch (error) {
    await Log('backend', 'error', 'handler', `Error creating notification: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listNotifications(req, res) {
  try {
    const { studentId } = req.params;
    const { isRead, type, limit } = req.query;

    if (!studentId) {
      await Log('backend', 'warn', 'handler', 'Missing studentId');
      return res.status(400).json({ error: 'studentId is required' });
    }

    const filters = {
      limit: parseInt(limit) || 20
    };

    if (isRead !== undefined) {
      filters.isRead = isRead === 'true';
    }
    if (type) {
      filters.type = type;
    }

    const notifs = db.getByStudentId(parseInt(studentId), filters);

    await Log('backend', 'info', 'handler', `Listed ${notifs.length} notifications for student ${studentId}`);
    res.json({
      data: notifs,
      page: {
        limit: filters.limit,
        count: notifs.length
      }
    });
  } catch (error) {
    await Log('backend', 'error', 'handler', `Error listing notifications: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getNotification(req, res) {
  try {
    const { notificationId } = req.params;

    const notif = db.getById(notificationId);
    if (!notif) {
      await Log('backend', 'warn', 'handler', `Notification not found: ${notificationId}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    await Log('backend', 'info', 'handler', `Retrieved notification ${notificationId}`);
    res.json(notif);
  } catch (error) {
    await Log('backend', 'error', 'handler', `Error getting notification: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function markAsRead(req, res) {
  try {
    const { notificationId } = req.params;
    const { isRead } = req.body;

    const notif = db.update(notificationId, { isRead });
    if (!notif) {
      await Log('backend', 'warn', 'handler', `Notification not found: ${notificationId}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    await Log('backend', 'info', 'handler', `Updated notification ${notificationId} isRead=${isRead}`);
    res.json(notif);
  } catch (error) {
    await Log('backend', 'error', 'handler', `Error marking as read: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function markAllAsRead(req, res) {
  try {
    const { studentId } = req.params;

    const count = db.markAllRead(parseInt(studentId));

    await Log('backend', 'info', 'handler', `Marked all ${count} notifications as read for student ${studentId}`);
    res.json({ updatedCount: count });
  } catch (error) {
    await Log('backend', 'error', 'handler', `Error marking all as read: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteNotification(req, res) {
  try {
    const { notificationId } = req.params;

    const deleted = db.delete(notificationId);
    if (!deleted) {
      await Log('backend', 'warn', 'handler', `Notification not found: ${notificationId}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    await Log('backend', 'info', 'handler', `Deleted notification ${notificationId}`);
    res.status(204).send();
  } catch (error) {
    await Log('backend', 'error', 'handler', `Error deleting notification: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createNotification,
  listNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
