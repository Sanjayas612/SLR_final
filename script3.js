let editingMealId = null;
let libraryImageUrl = null; // Stores URL if picked from library

document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    loadMeals();
});

// Image Preview
document.getElementById('image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').classList.remove('hidden');
            libraryImageUrl = null;
        };
        reader.readAsDataURL(file);
    }
});

async function loadLibrary() {
    const res = await fetch("/library");
    const data = await res.json();
    const container = document.getElementById('mealLibrary');
    container.innerHTML = data.map(item => `
        <div onclick='useLibraryItem(${JSON.stringify(item)})' class="library-item cursor-pointer bg-slate-700/30 p-3 rounded-xl border border-slate-600 flex items-center gap-4 transition-all">
            <img src="${item.image}" class="w-12 h-12 rounded-lg object-cover">
            <div class="flex-1"><p class="font-bold text-sm">${item.name}</p><p class="text-xs text-emerald-400">₹${item.price}</p></div>
            <i class="fas fa-plus-circle text-indigo-400"></i>
        </div>`).join('');
}

function useLibraryItem(item) {
    document.getElementById('name').value = item.name;
    document.getElementById('price').value = item.price;
    document.getElementById('description').value = item.description || '';
    document.getElementById('previewImg').src = item.image;
    document.getElementById('imagePreview').classList.remove('hidden');
    libraryImageUrl = item.image; // Keep the Cloudinary URL
}

async function saveMeal() {
    const name = document.getElementById('name').value;
    const price = document.getElementById('price').value;
    const file = document.getElementById('image').files[0];

    if (!name || !price) return alert("Name and Price required");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("price", price);
    formData.append("description", document.getElementById('description').value);
    
    // If we picked from library, we send the URL. If we picked a file, multer handles it.
    if (file) {
        formData.append("image", file);
    } else if (libraryImageUrl) {
        // We tell the server to use this URL instead of a new file
        formData.append("existingImageUrl", libraryImageUrl); 
    }

    const url = editingMealId ? `/update-meal/${editingMealId}` : "/add-meal";
    const method = editingMealId ? "PUT" : "POST";

    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (data.success) {
        alert("Meal Saved!");
        resetForm();
        loadMeals();
    }
}

async function loadMeals() {
    const res = await fetch("/meals");
    const data = await res.json();
    const container = document.getElementById('meals');
    container.innerHTML = data.map(m => `
        <div class="meal-card bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700/30">
            <img src="${m.image}" class="h-48 w-full object-cover">
            <div class="p-6">
                <h3 class="text-xl font-bold">${m.name}</h3>
                <p class="text-2xl font-bold text-emerald-400">₹${m.price}</p>
                <div class="flex gap-2 mt-4">
                    <button onclick='editMeal(${JSON.stringify(m).replace(/'/g, "&apos;")})' class="flex-1 bg-indigo-600 py-2 rounded-lg">Edit</button>
                    <button onclick="deleteMeal('${m._id}')" class="flex-1 bg-red-600/20 text-red-400 py-2 rounded-lg">Delete</button>
                </div>
            </div>
        </div>`).join('');
}

async function saveToLibrary() {
    const name = document.getElementById('name').value;
    const price = document.getElementById('price').value;
    const desc = document.getElementById('description').value;
    const img = document.getElementById('previewImg').src; // This is either Base64 or Cloudinary URL

    if (!name || !price || !img) return alert("Fill Name, Price and choose an image first!");

    await fetch("/api/library/save", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name, price, description: desc, image: img })
    });
    loadLibrary();
    alert("Template saved!");
}

function resetForm() {
    editingMealId = null; libraryImageUrl = null;
    document.getElementById('name').value = ""; document.getElementById('price').value = "";
    document.getElementById('description').value = ""; document.getElementById('image').value = "";
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('formTitle').innerText = "Add New Meal";
}

function editMeal(m) {
    editingMealId = m._id;
    document.getElementById('name').value = m.name;
    document.getElementById('price').value = m.price;
    document.getElementById('description').value = m.description || '';
    document.getElementById('previewImg').src = m.image;
    document.getElementById('imagePreview').classList.remove('hidden');
    document.getElementById('formTitle').innerText = "Edit Meal";
    document.getElementById('cancelBtn').style.display = 'inline-block';
}

async function deleteMeal(id) {
    if (confirm("Delete this meal?")) {
        await fetch(`/delete-meal/${id}`, { method: "DELETE" });
        loadMeals();
    }
}
function cancelEdit() { resetForm(); }
