/* Routes for Notification API */

const express = require('express');
const router = express.Router();
const controller = require('./controller');

// POST: Create notification
router.post('/notifications', controller.createNotification);

// GET: List notifications for a student
router.get('/students/:studentId/notifications', controller.listNotifications);

// GET: Fetch one notification
router.get('/notifications/:notificationId', controller.getNotification);

// PATCH: Mark as read
router.patch('/notifications/:notificationId', controller.markAsRead);

// PATCH: Mark all as read for a student
router.patch('/students/:studentId/notifications', controller.markAllAsRead);

// DELETE: Delete a notification
router.delete('/notifications/:notificationId', controller.deleteNotification);

module.exports = router;
