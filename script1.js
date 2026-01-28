// script1.js - Enhanced Producer Dashboard with Notification Controls
const userEmail = localStorage.getItem('messmate_user_email');
const userRole = localStorage.getItem('messmate_user_role') || 'producer';
const userName = localStorage.getItem('messmate_user_name') || '';

if (!userEmail || userRole !== 'producer') {
  window.location.href = '/';
}

let html5QrCode = null;
let eventSource = null;
let notificationEventSource = null;
let notificationStats = {
  subscribedStudents: 0,
  totalStudents: 0,
  todayNotifications: 0
};

document.getElementById('producer-welcome').textContent = `Logged in as: ${userName || userEmail}`;

// ==================== NOTIFICATION SYSTEM ====================

// Initialize notification system
async function initNotificationSystem() {
  await loadNotificationStats();
  connectToNotificationSSE();
  loadRecentNotifications();
}

// Load notification statistics
async function loadNotificationStats() {
  try {
    const res = await fetch('/producer/notification-stats');
    const data = await res.json();
    
    if (data.success) {
      notificationStats = {
        subscribedStudents: data.stats.subscribedStudents,
        totalStudents: data.stats.totalStudents,
        todayNotifications: data.stats.notificationsToday.successful
      };
      
      updateNotificationBadge();
    }
  } catch (err) {
    console.error('Error loading notification stats:', err);
  }
}

// Update notification badge
function updateNotificationBadge() {
  const badge = document.getElementById('notificationDot');
  if (notificationStats.todayNotifications > 0) {
    badge.classList.remove('hidden');
  }
}

// Connect to notification SSE
function connectToNotificationSSE() {
  if (notificationEventSource) {
    notificationEventSource.close();
  }

  notificationEventSource = new EventSource('/producer/sse');
  
  notificationEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleNotificationEvent(data);
    } catch (err) {
      console.error('SSE parse error:', err);
    }
  };

  notificationEventSource.onerror = () => {
    console.log('Notification SSE connection lost, reconnecting...');
    setTimeout(connectToNotificationSSE, 5000);
  };
}

// Handle notification events
function handleNotificationEvent(data) {
  console.log('Notification event:', data);
  
  switch (data.type) {
    case 'reminder_sent':
    case 'scheduled_reminder_sent':
      playNotificationSound();
      showNotificationToast(
        `📢 ${data.results?.successful || 0} students notified!`,
        'success'
      );
      addNotificationToPanel(data);
      loadNotificationStats();
      break;
  }
}

// Send reminder to all students
document.getElementById('sendReminderBtn').addEventListener('click', async () => {
  if (!confirm('Send meal reminder to all students now?')) {
    return;
  }

  const btn = document.getElementById('sendReminderBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Sending...';

  try {
    const res = await fetch('/producer/send-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producerEmail: userEmail,
        message: null // Use default message
      })
    });

    const data = await res.json();

    if (data.success) {
      showNotificationToast(
        `✅ Reminders sent to ${data.results.successful}/${data.results.total} students!`,
        'success'
      );
      loadRecentNotifications();
    } else {
      showNotificationToast('❌ Failed to send reminders', 'error');
    }
  } catch (err) {
    console.error('Send reminders error:', err);
    showNotificationToast('❌ Error sending reminders', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Send Reminders';
  }
});

// Load recent notifications
async function loadRecentNotifications() {
  try {
    const res = await fetch('/producer/recent-notifications?limit=10');
    const data = await res.json();

    if (data.success) {
      displayNotifications(data.notifications);
    }
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

// Display notifications in panel
function displayNotifications(notifications) {
  const list = document.getElementById('notificationList');
  
  if (notifications.length === 0) {
    list.innerHTML = '<p class="text-slate-400 text-center py-4">No notifications sent today</p>';
    return;
  }

  list.innerHTML = notifications.map(n => {
    const time = new Date(n.sentAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const icon = n.type === 'daily_reminder' ? 'fa-clock' : 
                 n.type === 'payment_reminder' ? 'fa-money-bill-wave' :
                 n.type === 'producer_alert' ? 'fa-bullhorn' : 'fa-bell';
    
    const statusColor = n.success ? 'text-emerald-400' : 'text-red-400';
    const statusIcon = n.success ? 'fa-check-circle' : 'fa-exclamation-circle';

    return `
      <div class="bg-slate-700/40 p-4 rounded-xl border border-slate-600/30 hover:border-indigo-500/50 transition-all">
        <div class="flex items-start gap-3">
          <i class="fas ${icon} text-indigo-400 mt-1"></i>
          <div class="flex-1">
            <div class="flex items-start justify-between mb-1">
              <p class="font-semibold text-white text-sm">${n.title}</p>
              <span class="text-xs text-slate-400">${time}</span>
            </div>
            <p class="text-slate-300 text-xs mb-2">${n.message}</p>
            <div class="flex items-center gap-2">
              <span class="${statusColor} text-xs flex items-center gap-1">
                <i class="fas ${statusIcon}"></i>
                ${n.success ? 'Delivered' : 'Failed'}
              </span>
              <span class="text-slate-400 text-xs">• ${n.userEmail}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Add notification to panel (real-time)
function addNotificationToPanel(data) {
  const list = document.getElementById('notificationList');
  
  const time = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const newNotification = document.createElement('div');
  newNotification.className = 'bg-slate-700/40 p-4 rounded-xl border border-emerald-500/50 animate-slide-in';
  newNotification.innerHTML = `
    <div class="flex items-start gap-3">
      <i class="fas fa-bullhorn text-emerald-400 mt-1"></i>
      <div class="flex-1">
        <div class="flex items-start justify-between mb-1">
          <p class="font-semibold text-white text-sm">
            ${data.type === 'scheduled_reminder_sent' ? '⏰ Scheduled Reminder' : '📢 Manual Reminder'}
          </p>
          <span class="text-xs text-slate-400">${time}</span>
        </div>
        <p class="text-slate-300 text-xs mb-2">
          Sent to ${data.results?.successful || 0} students
        </p>
        <div class="flex items-center gap-2">
          <span class="text-emerald-400 text-xs flex items-center gap-1">
            <i class="fas fa-check-circle"></i>
            Delivered
          </span>
        </div>
      </div>
    </div>
  `;

  // Remove "no notifications" message if it exists
  const noNotifMsg = list.querySelector('p.text-slate-400');
  if (noNotifMsg) {
    list.innerHTML = '';
  }

  list.insertBefore(newNotification, list.firstChild);
  
  // Keep only last 10
  while (list.children.length > 10) {
    list.removeChild(list.lastChild);
  }
}

// Toggle notification panel
document.getElementById('notificationBell').addEventListener('click', () => {
  const panel = document.getElementById('notificationPanel');
  panel.classList.toggle('hidden');
  
  if (!panel.classList.contains('hidden')) {
    loadRecentNotifications();
    document.getElementById('notificationBell').classList.add('bell-ringing');
    setTimeout(() => {
      document.getElementById('notificationBell').classList.remove('bell-ringing');
    }, 500);
  }
});

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationPanel');
  const bell = document.getElementById('notificationBell');
  
  if (!panel.contains(e.target) && !bell.contains(e.target)) {
    panel.classList.add('hidden');
  }
});

// Play notification sound
function playNotificationSound() {
  const audio = document.getElementById('notificationSound');
  if (audio) {
    audio.play().catch(() => {
      console.log('Audio play failed');
    });
  }
}

// Show notification toast
function showNotificationToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  toast.className = `fixed top-20 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-slide-in`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== ORIGINAL FUNCTIONALITY ====================

async function loadStats() {
  try {
    const period = document.getElementById('periodSelect').value;
    const res = await fetch(`/producer/stats?period=${period}`);
    const data = await res.json();

    document.getElementById('totalOrders').textContent = data.total || 0;
    document.getElementById('paidOrders').textContent = data.paid || 0;
    document.getElementById('unpaidOrders').textContent = data.unpaid || 0;
    document.getElementById('scannedOrders').textContent = data.verified || 0;

    const mealTypesDiv = document.getElementById('mealTypes');
    const meals = data.meals || {};
    const mealEntries = Object.entries(meals);

    if (mealEntries.length === 0) {
      mealTypesDiv.innerHTML = '<p class="text-slate-400 text-center col-span-full py-8">No orders yet for this period</p>';
      return;
    }

    mealTypesDiv.innerHTML = mealEntries.map(([name, count]) => `
      <div class="bg-gradient-to-br from-slate-700/60 to-slate-800/60 backdrop-blur-sm p-6 rounded-xl border border-slate-600/40 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-slate-300 text-sm font-medium mb-1">${name}</p>
            <p class="text-3xl font-bold text-white">${count}</p>
          </div>
          <div class="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <i class="fas fa-utensils text-2xl text-indigo-300"></i>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

document.getElementById('periodSelect').addEventListener('change', loadStats);

// QR Scanner
document.getElementById('scanBtn').addEventListener('click', () => {
  document.getElementById('scannerModal').classList.remove('hidden');
  startScanner();
});

document.getElementById('closeScanner').addEventListener('click', () => {
  stopScanner();
  document.getElementById('scannerModal').classList.add('hidden');
});

function startScanner() {
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    onScanSuccess,
    onScanError
  ).catch(err => {
    console.error('Scanner start error:', err);
  });
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().catch(err => console.error('Scanner stop error:', err));
  }
}

async function onScanSuccess(decodedText) {
  try {
    const data = JSON.parse(decodedText);
    stopScanner();
    document.getElementById('scannerModal').classList.add('hidden');
    showVerificationModal(data);
  } catch (err) {
    console.error('QR parse error:', err);
  }
}

function onScanError(error) {
  // Ignore scan errors
}

async function showVerificationModal(data) {
  const verifyContent = document.getElementById('verifyContent');
  
  verifyContent.innerHTML = `
    <div class="bg-slate-700/40 p-6 rounded-xl border border-slate-600/50 mb-6">
      <h4 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <i class="fas fa-user-circle"></i> Student Information
      </h4>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-slate-400 text-sm mb-1">Name</p>
          <p class="text-white font-semibold">${data.userName || 'Unknown'}</p>
        </div>
        <div>
          <p class="text-slate-400 text-sm mb-1">Email</p>
          <p class="text-white font-semibold text-sm">${data.userEmail}</p>
        </div>
      </div>
    </div>

    <div class="bg-slate-700/40 p-6 rounded-xl border border-slate-600/50">
      <h4 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <i class="fas fa-shopping-cart"></i> Orders
      </h4>
      <div class="space-y-3">
        ${data.meals.map(meal => `
          <div class="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg">
            <div>
              <p class="text-white font-semibold">${meal.name}</p>
              <p class="text-slate-400 text-sm">Quantity: ${meal.quantity}</p>
            </div>
            <p class="text-emerald-400 font-bold text-lg">₹${meal.totalPrice}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('verifyModal').classList.remove('hidden');

  document.getElementById('doneVerify').onclick = async () => {
    try {
      const res = await fetch('/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: data.userEmail,
          date: data.date
        })
      });

      const result = await res.json();

      if (result.success) {
        showNotificationToast('✅ Order verified successfully!', 'success');
        document.getElementById('verifyModal').classList.add('hidden');
        loadStats();
      } else {
        showNotificationToast('❌ Verification failed', 'error');
      }
    } catch (err) {
      console.error('Verification error:', err);
      showNotificationToast('❌ Error during verification', 'error');
    }
  };
}

document.getElementById('closeVerify').addEventListener('click', () => {
  document.getElementById('verifyModal').classList.add('hidden');
});

document.getElementById('cancelVerify').addEventListener('click', () => {
  document.getElementById('verifyModal').classList.add('hidden');
});

// Live ratings SSE
function connectToRatingsSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/sse-ratings');
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      displayLiveUpdate(data);
    } catch (err) {
      console.error('SSE parse error:', err);
    }
  };

  eventSource.onerror = () => {
    console.log('SSE connection lost, reconnecting...');
    setTimeout(connectToRatingsSSE, 5000);
  };
}

function displayLiveUpdate(data) {
  const liveDiv = document.getElementById('live');
  const stars = Array.from({ length: 5 }, (_, i) => 
    i < Math.round(data.avgRating) ? '⭐' : '☆'
  ).join('');

  const update = document.createElement('div');
  update.className = 'bg-slate-700/40 p-6 rounded-xl mb-4 border border-slate-600/50 animate-slide-in';
  update.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xl font-bold text-white">${data.mealName}</p>
        <p class="text-sm text-slate-300 mt-1">New rating received</p>
      </div>
      <div class="text-right">
        <p class="text-2xl mb-1">${stars}</p>
        <p class="text-emerald-400 font-bold">${data.avgRating.toFixed(1)} / 5.0</p>
        <p class="text-xs text-slate-400">${data.totalRatings} ratings</p>
      </div>
    </div>
  `;

  liveDiv.insertBefore(update, liveDiv.firstChild);
  
  while (liveDiv.children.length > 5) {
    liveDiv.removeChild(liveDiv.lastChild);
  }
}

document.getElementById('logout').addEventListener('click', () => {
  if (confirm('Are you sure you want to logout?')) {
    if (eventSource) eventSource.close();
    if (notificationEventSource) notificationEventSource.close();
    localStorage.clear();
    window.location.href = '/';
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventSource) eventSource.close();
  if (notificationEventSource) notificationEventSource.close();
  stopScanner();
});

// Initialize
loadStats();
connectToRatingsSSE();
initNotificationSystem();

console.log('✅ Producer dashboard with notifications loaded');
