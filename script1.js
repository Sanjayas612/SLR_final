// script1.js - Producer Dashboard Logic (Improved)
// Place this file in the same directory as dashboard1.html

const userEmail = localStorage.getItem('messmate_user_email');
const userRole = localStorage.getItem('messmate_user_role') || 'producer';
const userName = localStorage.getItem('messmate_user_name') || '';

if (!userEmail || userRole !== 'producer') {
  window.location.href = '/';
}

document.getElementById('producer-welcome').textContent = `Hello, ${userName || userEmail} — Role: Producer`;

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('messmate_user_email');
  localStorage.removeItem('messmate_user_role');
  localStorage.removeItem('messmate_user_name');
  window.location.href = '/';
});

const periodSelect = document.getElementById('periodSelect');
let html5QrCode;
let currentPending = [];

// Render pending verifications
function renderPending() {
  const container = document.getElementById('pendingVerifications');
  if (currentPending.length === 0) {
    container.innerHTML = `
      <div class="text-slate-400 text-center py-12 flex items-center justify-center gap-3">
        <i class="fas fa-qrcode text-3xl opacity-50"></i>
        <div>
          <p class="text-lg">Scan a QR to start verification.</p>
          <p class="text-sm mt-1">Ready to process student orders</p>
        </div>
      </div>
    `;
    return;
  }
  container.innerHTML = currentPending.map((item, index) => `
    <div class="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50 hover:border-emerald-500/50 transition-all duration-300 group">
      <div class="flex justify-between items-start mb-4">
        <h4 class="font-bold text-white text-lg">${item.userName || 'Unknown'} (${item.userEmail})</h4>
        <span class="text-sm text-emerald-400 font-semibold px-3 py-1 bg-emerald-900/30 rounded-full">
          <i class="fas fa-check mr-1"></i> Paid
        </span>
      </div>
      <ul class="space-y-2 text-sm mb-6">
        ${item.meals.map(m => `<li class="flex items-center gap-2 text-slate-300"><i class="fas fa-utensils text-emerald-400 text-xs"></i> ${m.name} (Qty: ${m.quantity}) - ₹${m.totalPrice}</li>`).join('')}
      </ul>
      <button onclick="verifyOrder('${item.userEmail}', ${index})" class="w-full bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg group-hover:shadow-xl">
        <i class="fas fa-check-double mr-2"></i> Verify Order
      </button>
    </div>
  `).join('');
}

// Scanner
const scanBtn = document.getElementById('scanBtn');
const scannerModal = document.getElementById('scannerModal');
const closeScanner = document.getElementById('closeScanner');

scanBtn.addEventListener('click', () => {
  scannerModal.classList.remove('hidden');
  startScanner();
});

closeScanner.addEventListener('click', () => {
  scannerModal.classList.add('hidden');
  stopScanner();
});

function startScanner() {
  html5QrCode = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    () => {}
  );
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
  }
}

async function onScanSuccess(decodedText) {
  stopScanner();
  scannerModal.classList.add('hidden');
  handleScan(decodedText);
}

async function handleScan(qrData) {
  try {
    const parsed = JSON.parse(qrData);
    if (!parsed.userEmail || !parsed.meals) throw new Error('Invalid QR');

    const res = await fetch('/check-verified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: parsed.userEmail, date: new Date().toDateString() })
    });
    const check = await res.json();
    if (check.verified) {
      showErrorToast('QR already scanned and verified today.');
      return;
    }

    const userRes = await fetch(`/user/${parsed.userEmail}`);
    const userData = await userRes.json();
    const userName = userData.success ? userData.name : 'Unknown';

    const groupedMeals = parsed.meals.reduce((acc, meal) => {
      const name = meal.name;
      if (!acc[name]) acc[name] = { quantity: 0, totalPrice: 0 };
      acc[name].quantity++;
      acc[name].totalPrice += meal.price;
      return acc;
    }, {});

    const scanItem = {
      userEmail: parsed.userEmail,
      userName,
      meals: Object.entries(groupedMeals).map(([name, info]) => ({ name, quantity: info.quantity, totalPrice: info.totalPrice }))
    };

    currentPending.push(scanItem);
    renderPending();
    showVerifyModal(scanItem);
  } catch (e) {
    showErrorToast('Error: ' + e.message);
  }
}

function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-red-500/90 text-white px-6 py-4 rounded-xl shadow-lg z-50 backdrop-blur-sm';
  toast.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transform', 'translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showVerifyModal(data) {
  const content = document.getElementById('verifyContent');
  content.innerHTML = `
    <div class="scan-result bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
      <div class="flex items-center gap-4 mb-4">
        <div class="text-3xl text-blue-400">
          <i class="fas fa-user-graduate"></i>
        </div>
        <div>
          <p class="font-bold text-blue-300 text-lg">Student: ${data.userName} (${data.userEmail})</p>
          <p class="text-sm text-slate-400">Payment Status: <span class="text-emerald-400 font-semibold"><i class="fas fa-check mr-1"></i> Paid</span></p>
        </div>
      </div>
      <h4 class="font-bold mb-4 text-emerald-400 flex items-center gap-2">
        <i class="fas fa-utensils"></i> Meals:
      </h4>
      <ul class="space-y-3 mb-6">
        ${data.meals.map(m => `
          <li class="flex justify-between items-center p-3 bg-slate-600/50 rounded-lg">
            <span class="text-white font-medium">${m.name}</span>
            <div class="text-right">
              <span class="text-emerald-400 font-bold">Qty: ${m.quantity}</span>
              <span class="text-slate-300 mx-2">|</span>
              <span class="text-green-400 font-bold">₹${m.totalPrice}</span>
            </div>
          </li>
        `).join('')}
      </ul>
      <p class="text-base text-slate-300 font-semibold mt-4 flex items-center justify-center gap-2">
        <i class="fas fa-box text-emerald-400"></i> Total Items: ${data.meals.reduce((s, m) => s + m.quantity, 0)}
      </p>
    </div>
  `;

  const modal = document.getElementById('verifyModal');
  modal.classList.remove('hidden');

  document.getElementById('doneVerify').onclick = () => verifyOrder(data.userEmail, currentPending.findIndex(p => p.userEmail === data.userEmail));
  document.getElementById('cancelVerify').onclick = () => {
    const index = currentPending.findIndex(p => p.userEmail === data.userEmail);
    if (index > -1) currentPending.splice(index, 1);
    renderPending();
    modal.classList.add('hidden');
  };
  document.getElementById('closeVerify').onclick = () => document.getElementById('cancelVerify').onclick();
}

window.verifyOrder = async (userEmail, index) => {
  try {
    const res = await fetch('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, date: new Date().toDateString() })
    });
    const result = await res.json();
    if (result.success) {
      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-emerald-500/90 text-white px-6 py-4 rounded-xl shadow-lg z-50 backdrop-blur-sm';
      successToast.innerHTML = '<i class="fas fa-check-double mr-2"></i> Order verified successfully!';
      document.body.appendChild(successToast);
      setTimeout(() => {
        successToast.classList.add('opacity-0', 'transform', 'translate-x-full');
        setTimeout(() => successToast.remove(), 300);
      }, 3000);
      if (index > -1) currentPending.splice(index, 1);
      renderPending();
      loadStats(periodSelect.value);
      document.getElementById('verifyModal').classList.add('hidden');
    } else {
      showErrorToast('Verification failed: ' + result.error);
    }
  } catch (e) {
    showErrorToast('Error verifying: ' + e.message);
  }
};

// Load stats
async function loadStats(period = 'day') {
  try {
    const res = await fetch(`/producer/stats?period=${period}`);
    const data = await res.json();

    document.getElementById('totalOrders').textContent = data.total || 0;
    document.getElementById('paidOrders').textContent = data.paid || 0;
    document.getElementById('unpaidOrders').textContent = data.unpaid || 0;
    document.getElementById('scannedOrders').textContent = data.verified || 0;

    const label = document.getElementById('scannedLabel');
    label.innerHTML = `<i class="fas fa-qrcode text-purple-200"></i> ${period === 'day' ? "Today's Verified" : "Verified Orders"}`;

    const mealTypes = document.getElementById('mealTypes');
    if (data.meals && Object.keys(data.meals).length > 0) {
      mealTypes.innerHTML = Object.entries(data.meals).map(([name, count]) => `
        <div class="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg">
          <h4 class="font-bold text-white mb-2">${name}</h4>
          <p class="text-3xl font-bold text-emerald-400">${count} <span class="text-sm text-emerald-200">orders</span></p>
        </div>
      `).join('');
    } else {
      mealTypes.innerHTML = '<div class="col-span-full text-slate-400 text-center py-12 flex items-center justify-center gap-3"><i class="fas fa-inbox text-3xl opacity-50"></i> No orders for this period.</div>';
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

periodSelect.addEventListener('change', (e) => loadStats(e.target.value));

// Live ratings via SSE
function startSSE() {
  const evtSource = new EventSource('/sse-ratings');
  const live = document.getElementById('live');
  evtSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      const entry = document.createElement('div');
      entry.className = 'py-4 border-b border-slate-700/50 flex justify-between items-center hover:bg-slate-700/20 transition-all duration-200 rounded-lg px-4 -mx-4';
      entry.innerHTML = `
        <span class="text-yellow-400 font-semibold flex items-center gap-2">
          <i class="fas fa-star"></i> ${payload.mealName}
        </span>
        <span class="text-slate-300">Avg: ${payload.avgRating} (${payload.totalRatings} ratings)</span>
      `;
      live.insertBefore(entry, live.firstChild);
      while (live.children.length > 10) live.removeChild(live.lastChild);
    } catch (e) { console.error('SSE parse error', e); }
  };
  evtSource.onerror = () => { evtSource.close(); setTimeout(startSSE, 3000); };
}

// Init
loadStats('day');
renderPending();
startSSE();