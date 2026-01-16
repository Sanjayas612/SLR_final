// script_updated.js - Student Dashboard Logic with Token System
const userEmail = localStorage.getItem('messmate_user_email');
const userRole = localStorage.getItem('messmate_user_role') || 'student';
const userName = localStorage.getItem('messmate_user_name') || '';

if (!userEmail) {
  window.location.href = '/';
}

document.getElementById('welcome').textContent = `Welcome, ${userName || userEmail} • ${userRole}`;

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('messmate_user_email');
  localStorage.removeItem('messmate_user_role');
  localStorage.removeItem('messmate_user_name');
  window.location.href = '/';
});

// Global state
let userOrders = [];
let eventSource = null;

// SSE: Real-time rating updates
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/sse-ratings');

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const ratingContainer = document.querySelector(`[data-rating="${data.mealName}"]`);
    if (ratingContainer) {
      ratingContainer.classList.add('rating-update');
      const stars = ratingContainer.querySelectorAll('span');
      stars.forEach((star, i) => {
        star.innerHTML = '★';
        star.className = i + 1 <= Math.round(data.avgRating)
          ? 'text-xl text-yellow-400 transition-all duration-300'
          : 'text-xl text-gray-600 transition-all duration-300';
      });
      const mealCard = ratingContainer.closest('.meal-card');
      if (mealCard) {
        const ratingText = mealCard.querySelector('.text-xs.text-slate-400');
        if (ratingText) {
          ratingText.textContent = `${data.totalRatings} rating${data.totalRatings !== 1 ? 's' : ''}`;
        }
      }
      setTimeout(() => ratingContainer.classList.remove('rating-update'), 600);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(connectSSE, 3000);
  };
}

// Load meals
async function loadMeals() {
  try {
    const res = await fetch('/meals');
    const meals = await res.json();
    const container = document.getElementById('meals');
    container.innerHTML = '';

    meals.forEach(m => {
      const imageUrl = m.image && m.image !== 'Meal1.jpg' ? m.image : `${m.name.replace(/\s+/g, '')}.jpg`;
      const card = document.createElement('div');
      card.className = 'meal-card bg-slate-800/60 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/40 hover:border-indigo-500/60 transition-all duration-500 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/30 flex flex-col group';
      card.setAttribute('data-meal', m.name);
      card.style.transform = 'translateY(0)';

      card.innerHTML = `
        <div class="image-container h-56 relative group-hover:brightness-110 transition-all duration-500">
          <img src="${imageUrl}" alt="${m.name}" class="meal-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect fill=%22%23667eea%22 width=%22400%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%22 font-size=%2224%22 fill=%22white%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3EMeal Image%3C/text%3E%3C/svg%3E'"/>
          <div class="absolute top-4 right-4 bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">₹${m.price}</div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        <div class="flex-1 p-6 flex flex-col">
          <h3 class="text-xl font-bold mb-3 text-white">${m.name}</h3>
          <p class="text-sm text-slate-300 mb-6 flex-1 line-clamp-3">${m.description || 'Delicious meal prepared fresh daily'}</p>
          <div class="mb-6 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex gap-1" data-rating="${m.name}">
                ${[1,2,3,4,5].map(i => `<span class="text-xl ${i <= Math.round(m.avgRating) ? 'text-yellow-400' : 'text-gray-600'} transition-all duration-300 cursor-pointer hover:scale-110">★</span>`).join('')}
              </div>
              <span class="text-xs text-slate-400">${m.totalRatings} rating${m.totalRatings !== 1 ? 's' : ''}</span>
            </div>
            <button onclick="bookMeal('${m.name}', ${m.price})" class="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl">
              <i class="fas fa-shopping-cart mr-2"></i> Order Now
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading meals:', err);
  }
}

// Book meal
window.bookMeal = async (mealName, price) => {
  try {
    const res = await fetch('/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealName, email: userEmail, price })
    });
    const data = await res.json();
    if (data.success) {
      const alertDiv = document.createElement('div');
      alertDiv.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-lg z-50 animate-pulse';
      alertDiv.innerHTML = `<i class="fas fa-check mr-2"></i> ${mealName} booked successfully!`;
      document.body.appendChild(alertDiv);
      setTimeout(() => {
        alertDiv.classList.add('opacity-0', 'transform', 'translate-x-full');
        setTimeout(() => alertDiv.remove(), 300);
      }, 3000);
      loadOrders();
    } else {
      showErrorToast(`❌ ${data.error || 'Booking failed'}`);
    }
  } catch (e) {
    showErrorToast('❌ Booking failed. Please try again.');
    console.error('Booking error:', e);
  }
};

function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg z-50';
  toast.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transform', 'translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Load orders
async function loadOrders() {
  try {
    const res = await fetch(`/user/${userEmail}`);
    const data = await res.json();
    if (data.success) {
      userOrders = data.orders || [];
      renderOrders();
      updateProfileModal();
    }
  } catch (err) {
    console.error('Error loading orders:', err);
    document.getElementById('orders').innerHTML = '<div class="text-red-400 text-center py-12 flex items-center justify-center gap-3"><i class="fas fa-exclamation-triangle text-2xl"></i> Failed to load orders</div>';
  }
}

function renderOrders() {
  const container = document.getElementById('orders');
  const now = new Date();
  const todayStr = now.toDateString();
  const todayUnpaid = userOrders.filter(o => new Date(o.date).toDateString() === todayStr && !o.paid);
  const todayPaid = userOrders.filter(o => new Date(o.date).toDateString() === todayStr && o.paid);

  let html = '';
  if (todayUnpaid.length > 0) {
    const totalAmount = todayUnpaid.reduce((sum, o) => sum + o.price, 0);
    html += `
      <div class="mb-8 p-6 bg-gradient-to-r from-indigo-900/50 to-blue-900/50 rounded-2xl border border-indigo-700/50 shadow-xl">
        <h4 class="text-xl font-bold mb-3 flex items-center gap-2 text-indigo-200">
          <i class="fas fa-credit-card"></i> Pay for Today's Orders
        </h4>
        <p class="text-base text-indigo-200 mb-6">You have ${todayUnpaid.length} unpaid order${todayUnpaid.length !== 1 ? 's' : ''} today.</p>
        <button id="payAllBtn" class="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl">
          <i class="fas fa-lock mr-2"></i> Pay ₹${totalAmount} Now
        </button>
      </div>
    `;
  }

  if (userOrders.length > 0) {
    html += userOrders.map(o => {
      const paidStatus = o.paid ? 'Paid' : 'Unpaid';
      const statusClass = o.paid ? 'text-emerald-400' : 'text-red-400';
      let cancelBtn = '';
      if (!o.paid && new Date(o.date).toDateString() === todayStr) {
        cancelBtn = `<button class="ml-3 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg" onclick="cancelOrder('${o._id}')">
          <i class="fas fa-times mr-1"></i> Cancel
        </button>`;
      }
      let tokenInfo = '';
      if (o.token && o.paid) {
        tokenInfo = `<span class="ml-3 text-indigo-400 font-semibold">Token: #${o.token}</span>`;
      }
      return `
        <div class="bg-slate-700/40 border border-slate-600/50 rounded-xl p-6 mb-4 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg group">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <p class="font-bold text-white text-xl mb-1">${o.mealName}</p>
              <p class="text-base text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <i class="fas fa-clock text-xs"></i> ${new Date(o.date).toLocaleString()} 
                <span class="${statusClass} font-semibold px-2 py-1 rounded-full text-xs bg-${o.paid ? 'emerald' : 'red'}-900/30">${paidStatus}</span>
                ${tokenInfo}
              </p>
            </div>
            <div class="text-right ml-4">
              <p class="text-xl font-bold text-emerald-400 mb-2">₹${o.price}</p>
              ${cancelBtn}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    html += '<div class="text-slate-400 text-center py-16 flex items-center justify-center gap-3"><i class="fas fa-inbox text-3xl opacity-50"></i> No orders found.</div>';
  }

  container.innerHTML = html;

  const payBtn = document.getElementById('payAllBtn');
  if (payBtn) payBtn.addEventListener('click', () => handlePay(userEmail));

  // Token Section
  const savedToken = localStorage.getItem(`token_${todayStr}_${userEmail}`);
  const savedTokenData = localStorage.getItem(`tokenData_${todayStr}_${userEmail}`);
  const tokenSection = document.getElementById('tokenSection');
  
  if (savedToken && savedTokenData && todayPaid.length > 0) {
    tokenSection.classList.remove('hidden');
    document.getElementById('tokenNumber').textContent = savedToken;
    displayTokenMeals(savedTokenData, 'tokenMealsList', 'tokenMealsItems');
  } else {
    tokenSection.classList.add('hidden');
  }
}

// Pay handler
async function handlePay(email) {
  const btn = document.getElementById('payAllBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
  }

  try {
    const res = await fetch('/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('modalTokenNumber').textContent = data.token;
      displayTokenMeals(JSON.stringify(data.meals), 'modalMealsList', 'modalMealsItems');
      
      const today = new Date().toDateString();
      localStorage.setItem(`token_${today}_${email}`, data.token);
      localStorage.setItem(`tokenData_${today}_${email}`, JSON.stringify(data.meals));
      
      document.getElementById('tokenModal').classList.remove('hidden');
      loadOrders();
    } else {
      showErrorToast(`❌ ${data.error || 'Payment failed'}`);
    }
  } catch (e) {
    showErrorToast('❌ Payment failed. Please try again.');
    console.error('Payment error:', e);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock mr-2"></i> Pay Now';
    }
  }
}

// Cancel order
window.cancelOrder = async (orderId) => {
  if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Cancelling...';

  try {
    const res = await fetch('/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email: userEmail })
    });
    const data = await res.json();
    if (data.success) {
      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-lg z-50';
      successToast.innerHTML = '<i class="fas fa-check mr-2"></i> Order cancelled successfully!';
      document.body.appendChild(successToast);
      setTimeout(() => {
        successToast.classList.add('opacity-0', 'transform', 'translate-x-full');
        setTimeout(() => successToast.remove(), 300);
      }, 3000);
      loadOrders();
    } else {
      showErrorToast(`❌ ${data.error || 'Cancel failed'}`);
    }
  } catch (e) {
    showErrorToast('❌ Cancel failed. Please try again.');
    console.error('Cancel error:', e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-times mr-1"></i> Cancel';
  }
};

// Token Display Helper
function displayTokenMeals(mealsData, containerId, itemsId) {
  try {
    const meals = JSON.parse(mealsData);
    const container = document.getElementById(containerId);
    const itemsList = document.getElementById(itemsId);
    if (meals.length > 0) {
      itemsList.innerHTML = meals.map(m => `<li class="flex items-center justify-between gap-2 bg-white/5 p-3 rounded-lg"><span class="flex items-center gap-2"><i class="fas fa-check text-emerald-400 text-sm"></i> ${m.name}</span> <span class="font-bold">Qty: ${m.quantity} × ₹${m.price}</span></li>`).join('');
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  } catch (e) {
    console.error('Error parsing token data:', e);
    document.getElementById(containerId).classList.add('hidden');
  }
}

// Profile Modal
const profileModal = document.getElementById('profileModal');
const profileBtn = document.getElementById('profileBtn');
const closeProfile = document.getElementById('closeProfile');
const periodSelect = document.getElementById('periodSelect');
let spendingChart = null, foodChart = null;

profileBtn.addEventListener('click', () => {
  updateProfileModal();
  profileModal.classList.remove('hidden');
});

closeProfile.addEventListener('click', () => {
  profileModal.classList.add('hidden');
  destroyCharts();
});

profileModal.addEventListener('click', (e) => {
  if (e.target === profileModal) {
    profileModal.classList.add('hidden');
    destroyCharts();
  }
});

periodSelect.addEventListener('change', () => {
  updateSpendingChart();
  updateFoodChart();
});

function destroyCharts() {
  if (spendingChart) { spendingChart.destroy(); spendingChart = null; }
  if (foodChart) { foodChart.destroy(); foodChart = null; }
}

function updateProfileModal() {
  const todayStr = new Date().toDateString();
  const todayUnpaid = userOrders.filter(o => new Date(o.date).toDateString() === todayStr && !o.paid);
  const unpaidCount = todayUnpaid.length;
  const score = -unpaidCount;

  document.getElementById('unpaidCount').textContent = unpaidCount;
  const scoreEl = document.getElementById('score');
  scoreEl.textContent = score;
  scoreEl.className = `font-bold ${score < 0 ? 'text-red-400' : 'text-emerald-400'}`;

  const profileOrdersEl = document.getElementById('profileOrders');
  if (userOrders.length > 0) {
    profileOrdersEl.innerHTML = userOrders.map(o => {
      const paidStatus = o.paid ? 'Paid' : 'Unpaid';
      let tokenInfo = o.token && o.paid ? `<br/><span class="text-indigo-400 text-sm">Token: #${o.token}</span>` : '';
      return `
        <div class="bg-slate-700/40 border border-slate-600/50 rounded-xl p-6 hover:border-indigo-500/50 transition-all duration-300 group">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <p class="font-bold text-white text-lg mb-1">${o.mealName}</p>
              <p class="text-sm text-slate-300 mt-1 flex items-center gap-2">
                <i class="fas fa-clock text-xs"></i> ${new Date(o.date).toLocaleString()} 
                <span class="text-${o.paid ? 'emerald' : 'red'}-400 font-semibold px-2 py-1 rounded-full text-xs bg-${o.paid ? 'emerald' : 'red'}-900/30">${paidStatus}</span>
                ${tokenInfo}
              </p>
            </div>
            <p class="text-lg font-bold text-emerald-400 ml-4">₹${o.price}</p>
          </div>
        </div>
      `;
    }).join('');
  } else {
    profileOrdersEl.innerHTML = '<div class="text-slate-400 text-center py-12 flex items-center justify-center gap-3"><i class="fas fa-inbox text-3xl opacity-50"></i> No previous orders found.</div>';
  }

  updateSpendingChart();
  updateFoodChart();
}

function updateSpendingChart() {
  const period = periodSelect.value;
  const now = new Date();
  let startDate;
  switch (period) {
    case 'day': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'week': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()); break;
    case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
  }

  const filtered = userOrders.filter(o => new Date(o.date) >= startDate);
  const total = filtered.reduce((s, o) => s + o.price, 0);
  document.getElementById('totalSpent').textContent = `₹${total}`;

  const grouped = {};
  filtered.forEach(o => {
    const d = new Date(o.date);
    let key;
    switch (period) {
      case 'day': key = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); break;
      case 'week': key = `Day ${d.getDay() + 1}`; break;
      case 'month': key = d.getDate(); break;
      case 'year': key = d.toLocaleString('default', { month: 'short' }); break;
    }
    grouped[key] = (grouped[key] || 0) + o.price;
  });

  const labels = Object.keys(grouped);
  const data = labels.map(l => grouped[l]);

  const ctx = document.getElementById('spendingChart').getContext('2d');
  destroyCharts();
  spendingChart = new Chart(ctx, {
    type: 'line',
    data: { 
      labels, 
      datasets: [{ 
        label: 'Amount Spent (₹)', 
        data, 
        borderColor: 'rgba(99, 102, 241, 1)', 
        backgroundColor: 'rgba(99, 102, 241, 0.1)', 
        tension: 0.4, 
        fill: true,
        borderWidth: 3,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }] 
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: { 
        y: { 
          beginAtZero: true, 
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } }, 
          grid: { color: 'rgba(255,255,255,0.1)' },
          border: { color: 'rgba(255,255,255,0.2)' }
        }, 
        x: { 
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } }, 
          grid: { color: 'rgba(255,255,255,0.1)' },
          border: { color: 'rgba(255,255,255,0.2)' }
        } 
      },
      plugins: { 
        legend: { 
          labels: { 
            color: 'rgba(255,255,255,0.8)', 
            font: { size: 14, weight: 'bold' },
            padding: 20
          } 
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: 'white',
          bodyColor: 'rgba(255,255,255,0.9)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function updateFoodChart() {
  const period = periodSelect.value;
  const now = new Date();
  let startDate;
  switch (period) {
    case 'day': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'week': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()); break;
    case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
  }

  const filtered = userOrders.filter(o => new Date(o.date) >= startDate);
  const counts = {};
  filtered.forEach(o => counts[o.mealName] = (counts[o.mealName] || 0) + 1);

  const labels = Object.keys(counts);
  const data = labels.map(l => counts[l]);

  const ctx = document.getElementById('foodChart').getContext('2d');
  destroyCharts();
  foodChart = new Chart(ctx, {
    type: 'bar',
    data: { 
      labels, 
      datasets: [{ 
        label: 'Orders', 
        data, 
        backgroundColor: 'rgba(34, 197, 62, 0.8)', 
        borderColor: 'rgba(34, 197, 62, 1)', 
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }] 
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { 
        y: { 
          beginAtZero: true, 
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } }, 
          grid: { color: 'rgba(255,255,255,0.1)' },
          border: { color: 'rgba(255,255,255,0.2)' }
        }, 
        x: { 
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } }, 
          grid: { color: 'rgba(255,255,255,0.1)' },
          border: { color: 'rgba(255,255,255,0.2)' }
        } 
      },
      plugins: { 
        legend: { 
          labels: { 
            color: 'rgba(255,255,255,0.8)', 
            font: { size: 14, weight: 'bold' },
            padding: 20
          } 
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: 'white',
          bodyColor: 'rgba(255,255,255,0.9)',
          borderColor: 'rgba(34, 197, 62, 1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart'
      }
    }
  });
}

// Token Modal Close
document.getElementById('closeToken').addEventListener('click', () => {
  document.getElementById('tokenModal').classList.add('hidden');
});
document.getElementById('tokenModal').addEventListener('click', (e) => {
  if (e.target.id === 'tokenModal') document.getElementById('tokenModal').classList.add('hidden');
});

// Initialize
loadMeals();
loadOrders();
connectSSE();

window.addEventListener('beforeunload', () => {
  if (eventSource) eventSource.close();
});