/* In-memory database for notifications */

const { v4: uuidv4 } = require('uuid');

let notifications = [
  {
    id: uuidv4(),
    studentId: 1042,
    type: 'Placement',
    title: 'Goldman Sachs Drive - On Campus',
    message: 'Eligibility: 8.0+ CGPA. Apply now!',
    priority: 'high',
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    metadata: { source: 'placement-office', targetGroup: 'final-year' }
  },
  {
    id: uuidv4(),
    studentId: 1042,
    type: 'Result',
    title: 'Semester Grades Published',
    message: 'Your grades for Semester 7 are now available',
    priority: 'high',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metadata: {}
  },
  {
    id: uuidv4(),
    studentId: 1042,
    type: 'Event',
    title: 'Campus Tech Talk - AI in Healthcare',
    message: 'Join us for an interactive session on AI applications',
    priority: 'medium',
    isRead: false,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    metadata: { speaker: 'Dr. Jane Doe' }
  }
];

const db = {
  create(notification) {
    const newNotif = {
      id: uuidv4(),
      ...notification,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notifications.push(newNotif);
    return newNotif;
  },

  getByStudentId(studentId, filters = {}) {
    let result = notifications.filter(n => n.studentId === studentId);
    
    if (filters.isRead !== undefined) {
      result = result.filter(n => n.isRead === filters.isRead);
    }
    if (filters.type) {
      result = result.filter(n => n.type === filters.type);
    }
    
    // Sort by createdAt DESC
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Paginate
    const limit = filters.limit || 20;
    return result.slice(0, limit);
  },

  getById(id) {
    return notifications.find(n => n.id === id);
  },

  update(id, data) {
    const notif = notifications.find(n => n.id === id);
    if (!notif) return null;
    
    Object.assign(notif, data);
    notif.updatedAt = new Date().toISOString();
    return notif;
  },

  delete(id) {
    const index = notifications.findIndex(n => n.id === id);
    if (index === -1) return false;
    notifications.splice(index, 1);
    return true;
  },

  markAllRead(studentId) {
    const unread = notifications.filter(n => n.studentId === studentId && !n.isRead);
    unread.forEach(n => {
      n.isRead = true;
      n.updatedAt = new Date().toISOString();
    });
    return unread.length;
  },

  getAll() {
    return notifications;
  }
};

module.exports = db;
