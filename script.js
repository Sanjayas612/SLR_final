// Updated script.js with Cart System and Weekly Meal Planning - FIXED
const userEmail = localStorage.getItem('messmate_user_email');
const userName = localStorage.getItem('messmate_user_name') || '';
let profileComplete = localStorage.getItem('messmate_profile_complete') === 'true';
let profilePhoto = localStorage.getItem('messmate_profile_photo');
let userOrders = [];
let spendingChart = null, foodChart = null;
let cameraStream = null;
let cart = JSON.parse(localStorage.getItem('messmate_cart') || '[]');
let currentSelectedMeal = null;

if (!userEmail) window.location.href = '/';

// Cart Management Functions
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const totalItems = cart.reduce((sum, item) => sum + item.days.length, 0);
  
  if (totalItems > 0) {
    badge.textContent = totalItems;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function saveCart() {
  localStorage.setItem('messmate_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(meal, selectedDays) {
  // selectedDays is an array of objects: [{day: 'monday', batch: '1'}, ...]
  
  // Check if meal already exists in cart
  const existingIndex = cart.findIndex(item => item.mealId === meal._id);
  
  if (existingIndex >= 0) {
    // Merge new days with existing days
    const existing = cart[existingIndex];
    selectedDays.forEach(newDay => {
      // Check if this day already exists
      const dayExists = existing.days.find(d => d.day === newDay.day);
      if (!dayExists) {
        existing.days.push(newDay);
      } else {
        // Update batch if different
        dayExists.batch = newDay.batch;
      }
    });
  } else {
    // Add new meal to cart
    cart.push({
      mealId: meal._id,
      mealName: meal.name,
      price: meal.price,
      image: meal.image,
      days: selectedDays
    });
  }
  
  saveCart();
  showToast('Added to cart successfully!', 'success');
}

function removeFromCart(mealId, day = null) {
  if (day) {
    // Remove specific day from meal
    const item = cart.find(item => item.mealId === mealId);
    if (item) {
      item.days = item.days.filter(d => d.day !== day);
      if (item.days.length === 0) {
        // Remove entire meal if no days left
        cart = cart.filter(item => item.mealId !== mealId);
      }
    }
  } else {
    // Remove entire meal
    cart = cart.filter(item => item.mealId !== mealId);
  }
  
  saveCart();
  renderCart();
  showToast('Removed from cart', 'info');
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function renderCart() {
  const cartContent = document.getElementById('cartContent');
  const cartTotal = document.getElementById('cartTotal');
  
  if (cart.length === 0) {
    cartContent.innerHTML = `
      <div class="text-center py-16 text-slate-400">
        <i class="fas fa-shopping-cart text-6xl mb-4 opacity-50"></i>
        <p class="text-xl">Your cart is empty</p>
        <p class="text-sm mt-2">Add some delicious meals to get started!</p>
      </div>
    `;
    cartTotal.textContent = '₹0';
    return;
  }
  
  let total = 0;
  
  cartContent.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.days.length;
    total += itemTotal;
    
    return `
      <div class="bg-slate-700/40 p-6 rounded-xl border border-slate-600/50">
        <div class="flex gap-4">
          ${item.image ? `
            <img src="${item.image}" class="w-24 h-24 rounded-lg object-cover" alt="${item.mealName}" onerror="this.src='https://via.placeholder.com/96/667eea/ffffff?text=Meal'">
          ` : `
            <div class="w-24 h-24 rounded-lg bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
              <i class="fas fa-utensils text-3xl text-indigo-300 opacity-50"></i>
            </div>
          `}
          
          <div class="flex-1">
            <h4 class="text-xl font-bold text-white mb-2">${item.mealName}</h4>
            <p class="text-emerald-400 font-bold mb-3">₹${item.price} per meal</p>
            
            <div class="space-y-2">
              <p class="text-sm text-slate-300 font-semibold mb-2">
                <i class="fas fa-calendar-check mr-2"></i> Selected Days:
              </p>
              <div class="flex flex-wrap gap-2">
                ${item.days.map(d => `
                  <div class="bg-slate-600/50 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                    <span class="capitalize">${d.day} (Batch ${d.batch})</span>
                    <button onclick="removeFromCart('${item.mealId}', '${d.day}')" class="text-red-400 hover:text-red-300 ml-1">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="text-right">
            <p class="text-sm text-slate-400 mb-2">Subtotal</p>
            <p class="text-2xl font-bold text-emerald-400">₹${itemTotal}</p>
            <p class="text-xs text-slate-400 mt-1">${item.days.length} meal(s)</p>
            <button onclick="removeFromCart('${item.mealId}')" class="mt-4 text-red-400 hover:text-red-300 text-sm">
              <i class="fas fa-trash mr-1"></i> Remove All
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  cartTotal.textContent = `₹${total}`;
}

// Modal handlers for Add to Cart
function openAddToCartModal(meal) {
  currentSelectedMeal = meal;
  
  // Update meal info
  const mealInfo = document.getElementById('selectedMealInfo');
  mealInfo.innerHTML = `
    <div class="flex items-center gap-4">
      ${meal.image ? `
        <img src="${meal.image}" class="w-20 h-20 rounded-lg object-cover" alt="${meal.name}" onerror="this.src='https://via.placeholder.com/80/667eea/ffffff?text=Meal'">
      ` : `
        <div class="w-20 h-20 rounded-lg bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
          <i class="fas fa-utensils text-2xl text-indigo-300 opacity-50"></i>
        </div>
      `}
      <div>
        <h4 class="text-xl font-bold text-white">${meal.name}</h4>
        <p class="text-emerald-400 font-bold">₹${meal.price} per meal</p>
      </div>
    </div>
  `;
  
  // Reset checkboxes and batch selections
  document.querySelectorAll('.day-checkbox').forEach(cb => {
    cb.checked = false;
    const row = cb.closest('.day-row');
    row.querySelector('.batch-selection').classList.add('hidden');
  });
  
  // Check if this meal is already in cart and pre-select those days
  const existingCartItem = cart.find(item => item.mealId === meal._id);
  if (existingCartItem) {
    existingCartItem.days.forEach(dayInfo => {
      const checkbox = document.querySelector(`.day-checkbox[data-day="${dayInfo.day}"]`);
      if (checkbox) {
        checkbox.checked = true;
        const row = checkbox.closest('.day-row');
        row.querySelector('.batch-selection').classList.remove('hidden');
        const batchRadio = row.querySelector(`input[name="batch-${dayInfo.day}"][value="${dayInfo.batch}"]`);
        if (batchRadio) batchRadio.checked = true;
      }
    });
  }
  
  document.getElementById('addToCartModal').classList.remove('hidden');
}

// Day checkbox change handlers
document.querySelectorAll('.day-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    const row = this.closest('.day-row');
    const batchSelection = row.querySelector('.batch-selection');
    
    if (this.checked) {
      batchSelection.classList.remove('hidden');
      // Auto-select batch 1 if none selected
      const batchRadios = row.querySelectorAll('.batch-radio');
      const anyChecked = Array.from(batchRadios).some(r => r.checked);
      if (!anyChecked && batchRadios.length > 0) {
        batchRadios[0].checked = true;
      }
    } else {
      batchSelection.classList.add('hidden');
    }
  });
});

// Add selected to cart
document.getElementById('addSelectedToCart').addEventListener('click', () => {
  if (!currentSelectedMeal) return;
  
  const selectedDays = [];
  
  document.querySelectorAll('.day-checkbox:checked').forEach(checkbox => {
    const day = checkbox.dataset.day;
    const row = checkbox.closest('.day-row');
    const selectedBatch = row.querySelector(`.batch-radio:checked`);
    
    if (selectedBatch) {
      selectedDays.push({
        day: day,
        batch: selectedBatch.value
      });
    }
  });
  
  if (selectedDays.length === 0) {
    showToast('Please select at least one day', 'error');
    return;
  }
  
  addToCart(currentSelectedMeal, selectedDays);
  document.getElementById('addToCartModal').classList.add('hidden');
  currentSelectedMeal = null;
});

document.getElementById('cancelAddToCart').addEventListener('click', () => {
  document.getElementById('addToCartModal').classList.add('hidden');
  currentSelectedMeal = null;
});

document.getElementById('closeAddToCart').addEventListener('click', () => {
  document.getElementById('addToCartModal').classList.add('hidden');
  currentSelectedMeal = null;
});

// Cart button handler
document.getElementById('cartBtn').addEventListener('click', () => {
  renderCart();
  document.getElementById('cartModal').classList.remove('hidden');
});

document.getElementById('closeCart').addEventListener('click', () => {
  document.getElementById('cartModal').classList.add('hidden');
});

// Checkout handler
document.getElementById('proceedToCheckout').addEventListener('click', async () => {
  if (cart.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }
  
  // Prepare order data
  const orders = [];
  cart.forEach(item => {
    item.days.forEach(dayInfo => {
      orders.push({
        mealId: item.mealId,
        mealName: item.mealName,
        price: item.price,
        day: dayInfo.day,
        batch: dayInfo.batch
      });
    });
  });
  
  const btn = document.getElementById('proceedToCheckout');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
  
  try {
    const response = await fetch('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        orders: orders
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Store token info
      const today = new Date().toDateString();
      localStorage.setItem(`token_${today}_${userEmail}`, data.token);
      localStorage.setItem(`tokenData_${today}_${userEmail}`, JSON.stringify(data.meals));
      
      // Clear cart
      clearCart();
      
      // Close cart modal
      document.getElementById('cartModal').classList.add('hidden');
      
      // Show success message
      showToast('✓ Order placed! Token generated. Please verify payment at Token Verification page.', 'success');
      
      // Reload orders
      loadOrders();
    } else {
      showToast(data.error || 'Checkout failed', 'error');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Error during checkout. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-credit-card mr-2"></i> Proceed to Checkout';
  }
});

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
  
  toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-lg z-50 flex items-center gap-3`;
  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transform', 'translate-x-full', 'transition-all', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Check profile completion
async function checkProfile() {
  const res = await fetch(`/user/${userEmail}`);
  const data = await res.json();
  if (data.success) {
    profileComplete = data.profileComplete;
    profilePhoto = data.profilePhoto;
    const currentName = data.name || userName;
    
    localStorage.setItem('messmate_profile_complete', profileComplete);
    localStorage.setItem('messmate_profile_photo', profilePhoto || '');
    localStorage.setItem('messmate_user_name', currentName);
    
    document.getElementById('editProfilePreview').src = profilePhoto || 'https://via.placeholder.com/120/667eea/ffffff?text=User';
    document.getElementById('modalTokenPhoto').src = profilePhoto || 'https://via.placeholder.com/120/667eea/ffffff?text=User';
    document.getElementById('currentProfileName').textContent = currentName;
    document.getElementById('welcome').textContent = `Welcome, ${currentName}`;
    
    const avatar = document.getElementById('initialsAvatar');
    avatar.textContent = currentName.charAt(0).toUpperCase();

    if (!profileComplete) {
      document.getElementById('profileSetupModal').classList.remove('hidden');
      document.getElementById('mainContent').style.display = 'none';
      document.getElementById('cancelSetup').classList.add('hidden');
      document.getElementById('nameInput').disabled = false;
    } else {
      document.getElementById('mainContent').style.display = 'block';
      document.getElementById('nameInput').value = currentName;
      document.getElementById('nameInput').disabled = true;
      document.getElementById('nameInput').classList.add('opacity-50', 'cursor-not-allowed');
    }
  }
}

// Camera functionality
document.getElementById('startCamera').onclick = async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { aspectRatio: 1, facingMode: 'user' } 
    });
    const video = document.getElementById('cameraStream');
    video.srcObject = cameraStream;
    document.getElementById('cameraContainer').style.display = 'block';
    document.getElementById('previewPhoto').style.display = 'none';
    document.getElementById('startCamera').classList.add('hidden');
    document.getElementById('capturePhoto').classList.remove('hidden');
  } catch (err) {
    alert("Camera access denied or not available.");
    console.error(err);
  }
};

document.getElementById('capturePhoto').onclick = () => {
  const video = document.getElementById('cameraStream');
  const canvas = document.createElement('canvas');
  const size = Math.min(video.videoWidth, video.videoHeight);
  canvas.width = size;
  canvas.height = size;
  
  const startX = (video.videoWidth - size) / 2;
  const startY = (video.videoHeight - size) / 2;
  canvas.getContext('2d').drawImage(video, startX, startY, size, size, 0, 0, size, size);
  
  const dataUrl = canvas.toDataURL('image/jpeg');
  document.getElementById('previewPhoto').src = dataUrl;
  document.getElementById('previewPhoto').style.display = 'block';
  document.getElementById('cameraContainer').style.display = 'none';
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
  
  document.getElementById('startCamera').classList.remove('hidden');
  document.getElementById('capturePhoto').classList.add('hidden');
  
  canvas.toBlob(blob => {
    const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('photoInput').files = dataTransfer.files;
  });
};

document.getElementById('photoInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('previewPhoto').src = e.target.result;
      document.getElementById('previewPhoto').style.display = 'block';
      document.getElementById('cameraContainer').style.display = 'none';
    }
    reader.readAsDataURL(file);
  }
});

document.getElementById('triggerEdit').onclick = () => {
  document.getElementById('profileModal').classList.add('hidden');
  document.getElementById('profileSetupModal').classList.remove('hidden');
  document.getElementById('cancelSetup').classList.remove('hidden');
  document.getElementById('previewPhoto').src = document.getElementById('editProfilePreview').src;
};

document.getElementById('cancelSetup').onclick = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('profileSetupModal').classList.add('hidden');
  document.getElementById('profileModal').classList.remove('hidden');
};

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const name = document.getElementById('nameInput').value.trim();
  const photo = document.getElementById('photoInput').files[0];
  
  if (!name) {
    alert('Please enter your name');
    return;
  }
  
  if (!profileComplete && !photo) {
    alert('Please select or capture a photo');
    return;
  }

  const formData = new FormData();
  formData.append('email', userEmail);
  formData.append('name', name);
  if (photo) {
    formData.append('photo', photo);
  }

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

  try {
    const res = await fetch('/update-profile', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('messmate_user_name', data.name);
      localStorage.setItem('messmate_profile_complete', true);
      localStorage.setItem('messmate_profile_photo', data.profilePhoto);
      profileComplete = true;
      profilePhoto = data.profilePhoto;
      
      document.getElementById('profileSetupModal').classList.add('hidden');
      document.getElementById('mainContent').style.display = 'block';
      location.reload();
    } else {
      alert(data.error || 'Failed to save profile');
    }
  } catch (err) {
    alert('Error saving profile');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check mr-2"></i> Save & Continue';
  }
});

document.getElementById('logout').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/';
});

// Token button handler
document.getElementById('tokenBtn').addEventListener('click', () => {
  const today = new Date().toDateString();
  const token = localStorage.getItem(`token_${today}_${userEmail}`);
  const meals = localStorage.getItem(`tokenData_${today}_${userEmail}`);

  if (!token || !meals) {
    alert('❌ No active token for today. Please make a payment first!');
    return;
  }

  document.getElementById('modalTokenNumber').textContent = token;
  document.getElementById('modalTokenName').textContent = userName || userEmail;
  document.getElementById('modalTokenPhoto').src = profilePhoto || 'https://via.placeholder.com/120/667eea/ffffff?text=User';

  const mealList = JSON.parse(meals);
  const mealsHtml = mealList.map(m => 
    `<li class="bg-white/5 p-2 rounded flex justify-between">
      <span>${m.name}</span>
      <span class="font-bold">Qty: ${m.quantity} × ₹${m.price}</span>
    </li>`
  ).join('');
  
  document.getElementById('modalMealsItems').innerHTML = mealsHtml;
  document.getElementById('modalMealsList').classList.remove('hidden');
  document.getElementById('tokenModal').classList.remove('hidden');
});

document.getElementById('closeTokenModal').addEventListener('click', () => {
  document.getElementById('tokenModal').classList.add('hidden');
});

document.getElementById('profileBtn').addEventListener('click', () => {
  updateProfileModal();
  document.getElementById('profileModal').classList.remove('hidden');
});

document.getElementById('closeProfile').addEventListener('click', () => {
  document.getElementById('profileModal').classList.add('hidden');
  destroyCharts();
});

async function loadMeals() {
  const res = await fetch('/meals');
  const meals = await res.json();
  const container = document.getElementById('meals');
  
  container.innerHTML = meals.map(m => `
    <div class="meal-card bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700/30 shadow-xl">
      ${m.image ? `
        <div class="h-48 overflow-hidden">
          <img src="${m.image}" class="w-full h-full object-cover" alt="${m.name}" onerror="this.src='https://via.placeholder.com/400x300/667eea/ffffff?text=No+Image'">
        </div>
      ` : `
        <div class="h-48 bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
          <i class="fas fa-utensils text-6xl text-indigo-300 opacity-50"></i>
        </div>
      `}
      
      <div class="p-6">
        <h3 class="text-2xl font-bold mb-2">${m.name}</h3>
        <p class="text-3xl font-bold text-emerald-400 mb-3">₹${m.price}</p>
        ${m.description ? `<p class="text-slate-300 text-sm mb-4 line-clamp-3">${m.description}</p>` : ''}
        
        <div class="flex items-center gap-2 mb-4">
          <div class="flex gap-1">
            ${[1,2,3,4,5].map(i => `<span class="text-lg ${i <= Math.round(m.avgRating) ? 'text-yellow-400' : 'text-gray-600'}">★</span>`).join('')}
          </div>
          <span class="text-xs text-slate-400">${m.avgRating.toFixed(1)} (${m.totalRatings})</span>
        </div>
        
        <button onclick='openAddToCartModal(${JSON.stringify(m).replace(/'/g, "&#39;")})' class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
          <i class="fas fa-cart-plus mr-2"></i> Add to Cart
        </button>
      </div>
    </div>
  `).join('');
}

async function loadOrders() {
  const res = await fetch(`/orders/${userEmail}`);
  const data = await res.json();
  if (data.success) {
    userOrders = data.orders || [];
    const todayStr = new Date().toDateString();
    const todayUnpaid = userOrders.filter(o => new Date(o.date).toDateString() === todayStr && !o.paid);

    let html = '';

    html += userOrders.map(o => `
      <div class="bg-slate-700/40 p-6 rounded-xl mb-4">
        <div class="flex justify-between">
          <div>
            <p class="font-bold text-xl">${o.mealName}</p>
            <p class="text-sm text-slate-300">${new Date(o.date).toLocaleString()}</p>
            ${o.day ? `<p class="text-xs text-indigo-300 mt-1">Day: ${o.day} | Batch: ${o.batch}</p>` : ''}
            <span class="text-${o.paid ? 'emerald' : 'red'}-400 text-sm">${o.paid ? 'Paid' : 'Unpaid'}</span>
          </div>
          <p class="text-xl font-bold text-emerald-400">₹${o.price}</p>
        </div>
      </div>
    `).join('');

    document.getElementById('orders').innerHTML = html || '<p class="text-center text-slate-400">No orders yet</p>';
  }
}

function updateProfileModal() {
  const todayStr = new Date().toDateString();
  const todayUnpaid = userOrders.filter(o => new Date(o.date).toDateString() === todayStr && !o.paid);
  document.getElementById('unpaidCount').textContent = todayUnpaid.length;
  document.getElementById('score').textContent = -todayUnpaid.length;

  const profileOrdersEl = document.getElementById('profileOrders');
  profileOrdersEl.innerHTML = userOrders.length > 0 ? userOrders.map(o => `
    <div class="bg-slate-700/40 p-4 rounded-xl">
      <div class="flex justify-between">
        <div>
          <p class="font-bold">${o.mealName}</p>
          <p class="text-sm text-slate-300">${new Date(o.date).toLocaleString()}</p>
          ${o.day ? `<p class="text-xs text-indigo-300">Day: ${o.day} | Batch: ${o.batch}</p>` : ''}
        </div>
        <p class="font-bold text-emerald-400">₹${o.price}</p>
      </div>
    </div>
  `).join('') : '<p class="text-center text-slate-400">No orders yet</p>';

  updateSpendingChart();
  updateFoodChart();
}

function destroyCharts() {
  if (spendingChart) { spendingChart.destroy(); spendingChart = null; }
  if (foodChart) { foodChart.destroy(); foodChart = null; }
}

function updateSpendingChart() {
  const period = document.getElementById('periodSelect').value;
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
      case 'week': key = d.toLocaleDateString('en-US', { weekday: 'short' }); break;
      case 'month': key = d.getDate(); break;
      case 'year': key = d.toLocaleString('default', { month: 'short' }); break;
    }
    grouped[key] = (grouped[key] || 0) + o.price;
  });

  const labels = Object.keys(grouped);
  const data = labels.map(l => grouped[l]);

  const ctx = document.getElementById('spendingChart').getContext('2d');
  if (spendingChart) spendingChart.destroy();
  
  spendingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Spending (₹)',
        data,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          labels: { color: 'white' } 
        } 
      },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { color: 'white' }, 
          grid: { color: 'rgba(255,255,255,0.1)' } 
        },
        x: { 
          ticks: { color: 'white' }, 
          grid: { color: 'rgba(255,255,255,0.1)' } 
        }
      }
    }
  });
}

function updateFoodChart() {
  const period = document.getElementById('periodSelect').value;
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
  if (foodChart) foodChart.destroy();
  
  foodChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Orders',
        data,
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: '#22c55e',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          labels: { color: 'white' } 
        } 
      },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { color: 'white' }, 
          grid: { color: 'rgba(255,255,255,0.1)' } 
        },
        x: { 
          ticks: { color: 'white' }, 
          grid: { color: 'rgba(255,255,255,0.1)' } 
        }
      }
    }
  });
}

document.getElementById('periodSelect').addEventListener('change', () => {
  updateSpendingChart();
  updateFoodChart();
});

// Make functions globally accessible
window.openAddToCartModal = openAddToCartModal;
window.removeFromCart = removeFromCart;

// Initialize
checkProfile();
loadMeals();
loadOrders();
updateCartBadge();// ============================================================================
// PUSH NOTIFICATION REGISTRATION FOR STUDENT DASHBOARD
// Add this code to the END of script.js (student dashboard)
// ============================================================================

// Check if service workers and push notifications are supported
if ('serviceWorker' in navigator && 'PushManager' in window) {
  console.log('✅ Push notifications are supported');
  initializePushNotifications();
} else {
  console.warn('⚠️ Push notifications are not supported in this browser');
}

async function initializePushNotifications() {
  try {
    // Step 1: Register the service worker
    console.log('📝 Registering service worker...');
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    
    console.log('✅ Service worker registered:', registration);
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('✅ Service worker is ready');
    
    // Step 2: Check current notification permission
    console.log('🔔 Current notification permission:', Notification.permission);
    
    if (Notification.permission === 'default') {
      // Show a friendly prompt before requesting permission
      showNotificationPrompt();
    } else if (Notification.permission === 'granted') {
      // Permission already granted, subscribe immediately
      await subscribeToPushNotifications(registration);
    } else {
      console.log('⚠️ Notification permission was denied');
    }
    
  } catch (error) {
    console.error('❌ Error initializing push notifications:', error);
  }
}

function showNotificationPrompt() {
  // Create a friendly in-app prompt
  const promptDiv = document.createElement('div');
  promptDiv.id = 'notification-prompt';
  promptDiv.className = 'fixed bottom-4 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-2xl z-50 max-w-md animate-slide-in';
  promptDiv.innerHTML = `
    <div class="flex items-start gap-4">
      <div class="text-3xl">🔔</div>
      <div class="flex-1">
        <h3 class="font-bold text-lg mb-2">Stay Updated!</h3>
        <p class="text-sm mb-4 text-white/90">
          Enable notifications to receive:
          <br>• Daily meal reminders
          <br>• Order confirmations
          <br>• Payment updates
        </p>
        <div class="flex gap-3">
          <button id="enable-notifications" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-all">
            Enable Notifications
          </button>
          <button id="dismiss-prompt" class="bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all">
            Maybe Later
          </button>
        </div>
      </div>
      <button id="close-prompt" class="text-white/80 hover:text-white text-xl">×</button>
    </div>
  `;
  
  document.body.appendChild(promptDiv);
  
  // Add event listeners
  document.getElementById('enable-notifications').addEventListener('click', async () => {
    promptDiv.remove();
    await requestNotificationPermission();
  });
  
  document.getElementById('dismiss-prompt').addEventListener('click', () => {
    promptDiv.remove();
    // Ask again in 24 hours
    localStorage.setItem('notification-prompt-dismissed', Date.now());
  });
  
  document.getElementById('close-prompt').addEventListener('click', () => {
    promptDiv.remove();
  });
}

async function requestNotificationPermission() {
  try {
    console.log('🔔 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    
    console.log('🔔 Notification permission result:', permission);
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted!');
      showToast('Notifications enabled! You\'ll receive meal reminders.', 'success');
      
      // Subscribe to push notifications
      const registration = await navigator.serviceWorker.ready;
      await subscribeToPushNotifications(registration);
    } else {
      console.log('⚠️ Notification permission denied');
      showToast('Notifications disabled. You can enable them later in settings.', 'info');
    }
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    showToast('Error enabling notifications. Please try again.', 'error');
  }
}

async function subscribeToPushNotifications(registration) {
  try {
    console.log('📡 Subscribing to push notifications...');
    
    // Get the VAPID public key from server
    const vapidResponse = await fetch('/vapid-public-key');
    const { publicKey } = await vapidResponse.json();
    
    console.log('🔑 Got VAPID public key');
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('ℹ️ Already subscribed, updating subscription...');
      // Unsubscribe first to get a fresh subscription
      await subscription.unsubscribe();
    }
    
    // Subscribe to push notifications
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    
    console.log('✅ Push subscription created:', subscription.endpoint);
    
    // Send subscription to server
    const response = await fetch('/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userEmail,
        subscription: subscription.toJSON()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Subscription saved to server');
      localStorage.setItem('push-subscription-active', 'true');
    } else {
      console.error('❌ Failed to save subscription:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error subscribing to push notifications:', error);
    if (error.name === 'NotAllowedError') {
      console.log('⚠️ Push notification permission was denied');
    }
  }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Function to check and resubscribe if needed
async function checkNotificationStatus() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription && Notification.permission === 'granted') {
      console.log('⚠️ Notification permission granted but not subscribed, resubscribing...');
      await subscribeToPushNotifications(registration);
    } else if (subscription) {
      console.log('✅ Push subscription is active');
    }
  } catch (error) {
    console.error('❌ Error checking notification status:', error);
  }
}

// Check notification status on page load
window.addEventListener('load', () => {
  // Wait a bit for the user email to be set
  setTimeout(() => {
    if (userEmail) {
      checkNotificationStatus();
    }
  }, 1000);
});


// ============================================================================
// PUSH NOTIFICATION REGISTRATION FOR STUDENT DASHBOARD
// Add this code to the END of script.js (student dashboard)
// ============================================================================

// Check if service workers and push notifications are supported
if ('serviceWorker' in navigator && 'PushManager' in window) {
  console.log('✅ Push notifications are supported');
  initializePushNotifications();
} else {
  console.warn('⚠️ Push notifications are not supported in this browser');
}

async function initializePushNotifications() {
  try {
    // Step 1: Register the service worker
    console.log('📝 Registering service worker...');
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    
    console.log('✅ Service worker registered:', registration);
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('✅ Service worker is ready');
    
    // Step 2: Check current notification permission
    console.log('🔔 Current notification permission:', Notification.permission);
    
    if (Notification.permission === 'default') {
      // Show a friendly prompt before requesting permission
      showNotificationPrompt();
    } else if (Notification.permission === 'granted') {
      // Permission already granted, subscribe immediately
      await subscribeToPushNotifications(registration);
    } else {
      console.log('⚠️ Notification permission was denied');
    }
    
  } catch (error) {
    console.error('❌ Error initializing push notifications:', error);
  }
}

function showNotificationPrompt() {
  // Create a friendly in-app prompt
  const promptDiv = document.createElement('div');
  promptDiv.id = 'notification-prompt';
  promptDiv.className = 'fixed bottom-4 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-2xl z-50 max-w-md animate-slide-in';
  promptDiv.innerHTML = `
    <div class="flex items-start gap-4">
      <div class="text-3xl">🔔</div>
      <div class="flex-1">
        <h3 class="font-bold text-lg mb-2">Stay Updated!</h3>
        <p class="text-sm mb-4 text-white/90">
          Enable notifications to receive:
          <br>• Daily meal reminders
          <br>• Order confirmations
          <br>• Payment updates
        </p>
        <div class="flex gap-3">
          <button id="enable-notifications" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-all">
            Enable Notifications
          </button>
          <button id="dismiss-prompt" class="bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all">
            Maybe Later
          </button>
        </div>
      </div>
      <button id="close-prompt" class="text-white/80 hover:text-white text-xl">×</button>
    </div>
  `;
  
  document.body.appendChild(promptDiv);
  
  // Add event listeners
  document.getElementById('enable-notifications').addEventListener('click', async () => {
    promptDiv.remove();
    await requestNotificationPermission();
  });
  
  document.getElementById('dismiss-prompt').addEventListener('click', () => {
    promptDiv.remove();
    // Ask again in 24 hours
    localStorage.setItem('notification-prompt-dismissed', Date.now());
  });
  
  document.getElementById('close-prompt').addEventListener('click', () => {
    promptDiv.remove();
  });
}

async function requestNotificationPermission() {
  try {
    console.log('🔔 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    
    console.log('🔔 Notification permission result:', permission);
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted!');
      showToast('Notifications enabled! You\'ll receive meal reminders.', 'success');
      
      // Subscribe to push notifications
      const registration = await navigator.serviceWorker.ready;
      await subscribeToPushNotifications(registration);
    } else {
      console.log('⚠️ Notification permission denied');
      showToast('Notifications disabled. You can enable them later in settings.', 'info');
    }
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    showToast('Error enabling notifications. Please try again.', 'error');
  }
}

async function subscribeToPushNotifications(registration) {
  try {
    console.log('📡 Subscribing to push notifications...');
    
    // Get the VAPID public key from server
    const vapidResponse = await fetch('/vapid-public-key');
    const { publicKey } = await vapidResponse.json();
    
    console.log('🔑 Got VAPID public key');
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('ℹ️ Already subscribed, updating subscription...');
      // Unsubscribe first to get a fresh subscription
      await subscription.unsubscribe();
    }
    
    // Subscribe to push notifications
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    
    console.log('✅ Push subscription created:', subscription.endpoint);
    
    // Send subscription to server
    const response = await fetch('/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userEmail,
        subscription: subscription.toJSON()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Subscription saved to server');
      localStorage.setItem('push-subscription-active', 'true');
    } else {
      console.error('❌ Failed to save subscription:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error subscribing to push notifications:', error);
    if (error.name === 'NotAllowedError') {
      console.log('⚠️ Push notification permission was denied');
    }
  }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Function to check and resubscribe if needed
async function checkNotificationStatus() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription && Notification.permission === 'granted') {
      console.log('⚠️ Notification permission granted but not subscribed, resubscribing...');
      await subscribeToPushNotifications(registration);
    } else if (subscription) {
      console.log('✅ Push subscription is active');
    }
  } catch (error) {
    console.error('❌ Error checking notification status:', error);
  }
}

// Check notification status on page load
window.addEventListener('load', () => {
  // Wait a bit for the user email to be set
  setTimeout(() => {
    if (userEmail) {
      checkNotificationStatus();
    }
  }, 1000);
});

// Add CSS for the animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;
document.head.appendChild(style);

console.log('✅ Push notification registration script loaded');

// Add CSS for the animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;
document.head.appendChild(style);

console.log('✅ Push notification registration script loaded');
