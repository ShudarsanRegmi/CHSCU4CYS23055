/* Stage 6: Priority Notifications - Top N  */

const axios = require('axios');
const { Log, setAuthToken } = require('./logger');

const API_BASE_URL = 'http://localhost:3000/api/v1';
const PRIORITY_WEIGHTS = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

let authToken = null;

function setToken(token) {
  authToken = token;
  setAuthToken(token);
}

/**
 * Calculate priority score for a notification
 * Score = type_weight * 1000 + recency_score
 * Higher score = higher priority
 */
function calculatePriorityScore(notification) {
  const typeWeight = PRIORITY_WEIGHTS[notification.type] || 1;
  
  // Recency: newer is better
  const createdTime = new Date(notification.createdAt).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Recency score: 1000 - (age in hours). Newer notifications score higher
  const recencyScore = Math.max(0, 1000 - ageHours);
  
  const totalScore = typeWeight * 1000 + recencyScore;
  
  return totalScore;
}

/**
 * Fetch all unread notifications for a student
 */
async function fetchStudentNotifications(studentId, limit = 100) {
  try {
    await Log('backend', 'info', 'service', `Fetching notifications for student ${studentId}`);
    
    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    
    const response = await axios.get(
      `${API_BASE_URL}/students/${studentId}/notifications?isRead=false&limit=${limit}`,
      { headers }
    );
    
    await Log('backend', 'info', 'service', `Retrieved ${response.data.data?.length || 0} notifications`);
    
    return response.data.data || [];
  } catch (error) {
    await Log('backend', 'error', 'service', `Failed to fetch notifications: ${error.message}`);
    return [];
  }
}

/**
 * Get top N priority notifications
 */
async function getTopNotifications(studentId, topN = 10) {
  try {
    await Log('backend', 'info', 'service', `Getting top ${topN} notifications for student ${studentId}`);
    
    // Fetch notifications from API
    const notifications = await fetchStudentNotifications(studentId);
    
    if (!notifications.length) {
      await Log('backend', 'warn', 'service', `No notifications found for student ${studentId}`);
      return [];
    }
    
    // Calculate priority scores
    const scored = notifications.map(notif => ({
      ...notif,
      priorityScore: calculatePriorityScore(notif)
    }));
    
    // Sort by priority score (descending)
    const sorted = scored.sort((a, b) => b.priorityScore - a.priorityScore);
    
    // Get top N
    const topNotifications = sorted.slice(0, topN);
    
    await Log('backend', 'info', 'service', `Ranked ${topNotifications.length} top notifications`);
    
    return topNotifications;
  } catch (error) {
    await Log('backend', 'error', 'service', `Error getting top notifications: ${error.message}`);
    return [];
  }
}

/**
 * Display notifications in a user-friendly format
 */
function displayNotifications(notifications) {
  console.log('\n' + '='.repeat(80));
  console.log('TOP PRIORITY NOTIFICATIONS');
  console.log('='.repeat(80) + '\n');
  
  if (!notifications.length) {
    console.log('No notifications found.\n');
    return;
  }
  
  notifications.forEach((notif, index) => {
    const createdAt = new Date(notif.createdAt).toLocaleString();
    const priority = notif.priorityScore || 0;
    
    console.log(`${index + 1}. [${notif.type}] ${notif.title}`);
    console.log(`   Priority Score: ${priority.toFixed(2)}`);
    console.log(`   Message: ${notif.message}`);
    console.log(`   Created: ${createdAt}`);
    console.log(`   Read: ${notif.isRead ? 'Yes' : 'No'}`);
    console.log('-'.repeat(80) + '\n');
  });
}

/**
 * Simulate demo with mock data for testing
 */
async function runDemo() {
  console.log('\n[Stage 6 Demo] Running Top Notifications Demo\n');
  
  // Mock notifications for demo
  const mockNotifications = [
    {
      id: 'ntf_001',
      studentId: 1042,
      type: 'Event',
      title: 'Campus Tech Talk - AI in Healthcare',
      message: 'Join us for an interactive session on AI applications',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    },
    {
      id: 'ntf_002',
      studentId: 1042,
      type: 'Placement',
      title: 'Goldman Sachs Drive - On Campus',
      message: 'Eligibility: 8.0+ CGPA. Apply now!',
      priority: 'high',
      isRead: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 mins ago
    },
    {
      id: 'ntf_003',
      studentId: 1042,
      type: 'Result',
      title: 'Semester Grades Published',
      message: 'Your grades for Semester 7 are now available',
      priority: 'high',
      isRead: false,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
    },
    {
      id: 'ntf_004',
      studentId: 1042,
      type: 'Placement',
      title: 'Microsoft Drive - Registration Open',
      message: 'Register before 5 PM today',
      priority: 'high',
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString() // 1 min ago
    },
    {
      id: 'ntf_005',
      studentId: 1042,
      type: 'Event',
      title: 'Hackathon 2026',
      message: 'Build innovative solutions. Exciting prizes!',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    },
    {
      id: 'ntf_006',
      studentId: 1042,
      type: 'Result',
      title: 'Assignment 3 Feedback',
      message: 'Your submission has been graded. Score: 18/20',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
    }
  ];
  
  // Calculate priority scores
  const scored = mockNotifications.map(notif => ({
    ...notif,
    priorityScore: calculatePriorityScore(notif)
  }));
  
  // Sort by priority
  const sorted = scored.sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Get top 10 (or less if fewer notifications)
  const topNotifications = sorted.slice(0, 10);
  
  // Display
  displayNotifications(topNotifications);
  
  // Log summary
  await Log('backend', 'info', 'service', `Demo: Displayed ${topNotifications.length} top notifications`);
}

module.exports = {
  setToken,
  getTopNotifications,
  fetchStudentNotifications,
  calculatePriorityScore,
  displayNotifications,
  runDemo
};
