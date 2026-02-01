const userEmail = localStorage.getItem('messmate_user_email');
let cart = JSON.parse(localStorage.getItem('messmate_cart') || '[]');
let currentSelectedMeal = null;

if (!userEmail) window.location.href = '/';

function getDateString(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset); // 0 for today, 1 for tomorrow
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const total = cart.reduce((sum, item) => sum + item.days.length, 0);
  if (total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }
}

function openAddToCartModal(meal) {
  currentSelectedMeal = meal;
  document.getElementById('selectedMealInfo').innerHTML = `
    <div class="flex items-center gap-4">
      <img src="${meal.image || 'https://via.placeholder.com/80'}" class="w-16 h-16 rounded-lg object-cover">
      <div>
        <h4 class="font-bold">${meal.name}</h4>
        <p class="text-emerald-400">₹${meal.price}</p>
      </div>
    </div>`;
  document.getElementById('addToCartModal').classList.remove('hidden');
}

document.getElementById('addSelectedToCart').onclick = () => {
  const dateType = document.querySelector('input[name="order-date"]:checked').value;
  const batch = document.querySelector('input[name="batch-time"]:checked').value;
  const targetDate = getDateString(dateType === 'today' ? 0 : 1); // logic for tomorrow

  const mealEntry = {
    mealId: currentSelectedMeal._id,
    mealName: currentSelectedMeal.name,
    price: currentSelectedMeal.price,
    days: [{ date: targetDate, batch: parseInt(batch) }]
  };

  // Prevent duplicate items for the same date/batch
  const existing = cart.find(i => i.mealId === mealEntry.mealId && i.days[0].date === targetDate);
  if (!existing) cart.push(mealEntry);
  
  localStorage.setItem('messmate_cart', JSON.stringify(cart));
  updateCartBadge();
  document.getElementById('addToCartModal').classList.add('hidden');
  alert(`Added ${currentSelectedMeal.name} for ${dateType} (Batch ${batch})`);
};

async function loadMeals() {
  const res = await fetch('/meals');
  const meals = await res.json();
  document.getElementById('meals').innerHTML = meals.map(m => `
    <div class="meal-card bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700/30 p-6">
      <img src="${m.image || 'https://via.placeholder.com/400x300'}" class="h-48 w-full object-cover rounded-xl mb-4">
      <h3 class="text-xl font-bold">${m.name}</h3>
      <p class="text-2xl font-bold text-emerald-400 mb-4">₹${m.price}</p>
      <button onclick='openAddToCartModal(${JSON.stringify(m).replace(/'/g, "&#39;")})' class="w-full bg-emerald-600 py-2 rounded-xl font-semibold">Book Meal</button>
    </div>`).join('');
}

// Basic Event Listeners
document.getElementById('closeAddToCart').onclick = () => document.getElementById('addToCartModal').classList.add('hidden');
document.getElementById('cancelAddToCart').onclick = () => document.getElementById('addToCartModal').classList.add('hidden');
document.getElementById('logout').onclick = () => { localStorage.clear(); window.location.href = '/'; };

loadMeals(); updateCartBadge();
