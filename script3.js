// script3.js - Producer Menu Management (Dashboard3)
// Place this file in the same directory as dashboard3.html

const userEmail = localStorage.getItem('messmate_user_email');
const userRole = localStorage.getItem('messmate_user_role') || 'producer';
const userName = localStorage.getItem('messmate_user_name') || '';

// Redirect if not logged in or not a producer
if (!userEmail || userRole !== 'producer') {
  window.location.href = '/';
}

let editingMealId = null;

// Image preview functionality
document.getElementById('image').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      e.target.value = '';
      document.getElementById('imagePreview').classList.add('hidden');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image (JPEG, PNG, or WebP)');
      e.target.value = '';
      document.getElementById('imagePreview').classList.add('hidden');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('imagePreview').classList.remove('hidden');
    }
    reader.readAsDataURL(file);
  } else {
    document.getElementById('imagePreview').classList.add('hidden');
  }
});

// Save meal function
async function saveMeal() {
  const nameVal = document.getElementById('name').value.trim();
  const priceVal = document.getElementById('price').value.trim();

  if (!nameVal || !priceVal) {
    showToast('Please fill in meal name and price', 'error');
    return;
  }

  // Validate price
  if (isNaN(priceVal) || Number(priceVal) <= 0) {
    showToast('Please enter a valid price', 'error');
    return;
  }

  const formData = new FormData();
  formData.append("name", nameVal);
  formData.append("price", priceVal);
  formData.append("description", document.getElementById('description').value);

  const imageFile = document.getElementById('image').files[0];
  if (imageFile) {
    formData.append("image", imageFile);
  }

  let url = "/add-meal";
  let method = "POST";

  if (editingMealId) {
    url = "/update-meal/" + editingMealId;
    method = "PUT";
  }

  // Show loading state
  const saveBtn = document.getElementById('saveBtn');
  const originalBtnText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    const response = await fetch(url, { method, body: formData });
    const data = await response.json();

    if (data.success) {
      showToast(editingMealId ? "Meal Updated Successfully!" : "Meal Added Successfully!", 'success');
      resetForm();
      loadMeals();
    } else {
      showToast(data.error || 'Error saving meal', 'error');
    }
  } catch (error) {
    showToast('Error saving meal. Please try again.', 'error');
    console.error('Save meal error:', error);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalBtnText;
  }
}

// Edit meal function
function editMeal(meal) {
  editingMealId = meal._id;

  document.getElementById('name').value = meal.name;
  document.getElementById('price').value = meal.price;
  document.getElementById('description').value = meal.description || '';

  if (meal.image) {
    document.getElementById('previewImg').src = meal.image;
    document.getElementById('imagePreview').classList.remove('hidden');
  }

  document.getElementById("formTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Meal';
  document.getElementById("saveBtn").innerHTML = '<i class="fas fa-save"></i> Update Meal';
  document.getElementById("cancelBtn").style.display = "inline-flex";

  // Scroll to form smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancel edit function
function cancelEdit() {
  if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
    resetForm();
  }
}

// Reset form function
function resetForm() {
  editingMealId = null;
  document.getElementById('name').value = "";
  document.getElementById('price').value = "";
  document.getElementById('description').value = "";
  document.getElementById('image').value = "";
  document.getElementById('imagePreview').classList.add('hidden');

  document.getElementById("formTitle").innerHTML = '<i class="fas fa-plus-circle"></i> Add New Meal';
  document.getElementById("saveBtn").innerHTML = '<i class="fas fa-check"></i> Add Meal';
  document.getElementById("cancelBtn").style.display = "none";
}

// Load meals function
async function loadMeals() {
  try {
    const res = await fetch("/meals");
    const data = await res.json();

    const mealsContainer = document.getElementById('meals');
    
    if (data.length === 0) {
      mealsContainer.innerHTML = `
        <div class="col-span-full text-center py-16 text-slate-400">
          <i class="fas fa-utensils text-6xl mb-4 opacity-50"></i>
          <p class="text-xl">No meals added yet. Add your first meal above!</p>
        </div>
      `;
      return;
    }

    mealsContainer.innerHTML = data.map(m => `
      <div class="meal-card bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/30 shadow-xl">
        ${m.image ? `
          <div class="h-48 overflow-hidden bg-gradient-to-br from-indigo-900 to-purple-900">
            <img src="${m.image}" class="w-full h-full object-cover" alt="${m.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/667eea/ffffff?text=Error+Loading'">
          </div>
        ` : `
          <div class="h-48 bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
            <i class="fas fa-utensils text-6xl text-indigo-300 opacity-50"></i>
          </div>
        `}
        
        <div class="p-6">
          <h3 class="text-2xl font-bold text-white mb-2">${escapeHtml(m.name)}</h3>
          <p class="text-3xl font-bold text-emerald-400 mb-3">₹${m.price}</p>
          ${m.description ? `
            <p class="text-slate-300 text-sm mb-4 line-clamp-2">${escapeHtml(m.description)}</p>
          ` : ''}
          
          <div class="flex items-center gap-2 mb-4">
            <div class="flex gap-1">
              ${[1,2,3,4,5].map(i => `<span class="text-lg ${i <= Math.round(m.avgRating) ? 'text-yellow-400' : 'text-gray-600'}">★</span>`).join('')}
            </div>
            <span class="text-xs text-slate-400">${m.avgRating.toFixed(1)} (${m.totalRatings} ratings)</span>
          </div>
          
          <div class="flex gap-3 mt-4">
            <button 
              onclick='editMeal(${JSON.stringify(m).replace(/'/g, "&#39;")})'
              class="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-4 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
              <i class="fas fa-edit"></i> Edit
            </button>
            <button 
              onclick="deleteMeal('${m._id}', '${escapeHtml(m.name)}')"
              class="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-4 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading meals:', error);
    document.getElementById('meals').innerHTML = `
      <div class="col-span-full text-center py-16 text-red-400">
        <i class="fas fa-exclamation-triangle text-6xl mb-4"></i>
        <p class="text-xl">Error loading meals. Please refresh the page.</p>
      </div>
    `;
  }
}

// Delete meal function
async function deleteMeal(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch("/delete-meal/" + id, { method: "DELETE" });
    const data = await response.json();

    if (data.success) {
      showToast('Meal deleted successfully!', 'success');
      loadMeals();
      
      // If we're editing this meal, reset the form
      if (editingMealId === id) {
        resetForm();
      }
    } else {
      showToast(data.error || 'Error deleting meal', 'error');
    }
  } catch (error) {
    showToast('Error deleting meal. Please try again.', 'error');
    console.error('Delete meal error:', error);
  }
}

// Toast notification function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
  
  toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-lg z-50 flex items-center gap-3 animate-slide-in`;
  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transform', 'translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Logout functionality
document.getElementById('logout').addEventListener('click', () => {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('messmate_user_email');
    localStorage.removeItem('messmate_user_role');
    localStorage.removeItem('messmate_user_name');
    window.location.href = '/';
  }
});

// Add CSS for animation
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

// Load meals on page load
loadMeals();

// Make functions globally accessible
window.saveMeal = saveMeal;
window.editMeal = editMeal;
window.cancelEdit = cancelEdit;
window.deleteMeal = deleteMeal;