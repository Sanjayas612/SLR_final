let editingMealId = null;
let libraryImageUrl = null;

document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    loadMeals();
});

// Image Preview logic
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
    try {
        const res = await fetch("/library");
        const data = await res.json();
        const container = document.getElementById('mealLibrary');
        container.innerHTML = data.map(item => `
            <div onclick='useLibraryItem(${JSON.stringify(item)})' class="cursor-pointer bg-slate-700/30 p-3 rounded-xl border border-slate-600 hover:border-indigo-500 transition-all flex items-center gap-4">
                <img src="${item.image}" class="w-12 h-12 rounded-lg object-cover">
                <div class="flex-1"><p class="font-bold text-sm">${item.name}</p><p class="text-xs text-emerald-400">₹${item.price}</p></div>
                <i class="fas fa-plus-circle text-indigo-400"></i>
            </div>`).join('');
    } catch (err) { console.error(err); }
}

function useLibraryItem(item) {
    document.getElementById('name').value = item.name;
    document.getElementById('price').value = item.price;
    document.getElementById('description').value = item.description || '';
    document.getElementById('previewImg').src = item.image;
    document.getElementById('imagePreview').classList.remove('hidden');
    libraryImageUrl = item.image;
    document.getElementById('image').value = "";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Mobile Optimized Save to Library
async function saveToLibrary() {
    const name = document.getElementById('name').value.trim();
    const price = document.getElementById('price').value.trim();
    const description = document.getElementById('description').value.trim();
    const file = document.getElementById('image').files[0];

    if (!name || !price) return alert("Name and price required");

    if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 400 / img.width;
                canvas.width = 400;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                sendLibraryData(name, price, description, compressedBase64);
            };
        };
    } else if (libraryImageUrl) {
        sendLibraryData(name, price, description, libraryImageUrl);
    } else {
        alert("Please choose an image");
    }
}

async function sendLibraryData(name, price, description, imageData) {
    try {
        const res = await fetch("/api/library/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, price: Number(price), description, image: imageData })
        });
        const data = await res.json();
        if (data.success) {
            alert("✅ Added to Library!");
            loadLibrary();
            resetForm();
        }
    } catch (err) {
        alert("Error: Image might be too large for mobile data.");
    }
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
    
    if (file) { formData.append("image", file); } 
    else if (libraryImageUrl) { formData.append("libraryImage", libraryImageUrl); } 
    else { return alert("Image required"); }

    const url = editingMealId ? `/update-meal/${editingMealId}` : "/add-meal";
    const method = editingMealId ? "PUT" : "POST";

    const res = await fetch(url, { method, body: formData });
    const result = await res.json();
    if (result.success) {
        resetForm();
        loadMeals();
    }
}

async function loadMeals() {
    const res = await fetch("/meals");
    const data = await res.json();
    document.getElementById('meals').innerHTML = data.map(m => `
        <div class="meal-card bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700/30">
            <img src="${m.image}" class="h-48 w-full object-cover">
            <div class="p-6">
                <h3 class="text-xl font-bold">${m.name}</h3>
                <p class="text-2xl font-bold text-emerald-400">₹${m.price}</p>
                <div class="flex gap-2 mt-4">
                    <button onclick='editMeal(${JSON.stringify(m).replace(/'/g, "&apos;")})' class="flex-1 bg-indigo-600 py-2 rounded-lg text-sm">Edit</button>
                    <button onclick="deleteMeal('${m._id}')" class="flex-1 bg-red-600/20 text-red-400 py-2 rounded-lg text-sm">Delete</button>
                </div>
            </div>
        </div>`).join('');
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
    if (confirm("Delete?")) {
        await fetch(`/delete-meal/${id}`, { method: "DELETE" });
        loadMeals();
    }
}
function cancelEdit() { resetForm(); }

document.getElementById('logout').addEventListener('click', () => {
    localStorage.clear(); window.location.href = '/';
});
