import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyACgmBzV74SwJLVyUCMdN1xOxZjMI4UgCg",
    authDomain: "posapp-ed05a.firebaseapp.com",
    databaseURL: "https://posapp-ed05a-default-rtdb.firebaseio.com",
    projectId: "posapp-ed05a",
    storageBucket: "posapp-ed05a.firebasestorage.app",
    messagingSenderId: "486175914054",
    appId: "1:486175914054:web:b2f7d71ae98c451f417247"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- Global State ---
let currentUser = { name: "Seller", id: null };
let products = [];
let customers = [];
let cart = [];
let sellerRefId = "";

// --- Lifecycle ---
document.addEventListener("DOMContentLoaded", () => {
    startClock();
    generateRefNo();
    setupAuthListeners();
    setupDOMEventListeners();
});

// --- UI / Util Setup ---
function startClock() {
    setInterval(() => {
        const n = new Date();
        const clockEl = document.getElementById('clock');
        const dateEl = document.getElementById('date');
        if(clockEl) clockEl.innerText = n.toLocaleTimeString();
        if(dateEl) dateEl.innerText = n.toLocaleDateString();
    }, 1000);
}

function generateRefNo() {
    sellerRefId = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    const dipRef = document.getElementById('sellerRefNo');
    if(dipRef) dipRef.innerText = sellerRefId;
}

function showAlert(title, message, type='info') {
    const el = document.createElement('div');
    el.className = `alert alert-${type} alert-dismissible fade show shadow`;
    el.innerHTML = `<strong>${title}</strong><br>${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.getElementById('alertsContainer').appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

// --- Auth ---
function setupAuthListeners() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            console.warn("No firebase user found. Using test user.");
            currentUser.name = "Test Seller";
            currentUser.id = "test-seller-id";
        } else {
            currentUser.name = user.displayName || user.email || 'Seller';
            currentUser.id = user.uid;
        }
        
        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) userNameDisplay.textContent = currentUser.name;
        
        const pic = document.getElementById('profilePics');
        if(pic) pic.innerHTML = currentUser.name.charAt(0);

        loadDataSubscriptions();
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(()=> window.location.href = '../timson-pos-login/index.html');
        });
    }
}

// --- Data Subs ---
function loadDataSubscriptions() {
    onValue(ref(db, 'stockRef'), snapshot => {
        const data = snapshot.val() || {};
        products = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        populateCategories();
        renderCatalog();
        updateCartAfterStockChange();
    });

    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        customers = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        populateCustomerList();
    });
}

function populateCustomerList() {
    const list = document.getElementById('customerDataList');
    if(!list) return;
    list.innerHTML = '';
    customers.forEach(c => {
        list.innerHTML += `<option value="${c.name}"></option>`;
    });
}

// --- DOM Events ---
function setupDOMEventListeners() {
    const searchInput = document.getElementById('sellerSearchInput');
    const catFilter = document.getElementById('sellerCategoryFilter');
    const clearBtn = document.getElementById('clearCartBtn');
    const applyBtn = document.getElementById('submitOrderBtn');
    
    if(searchInput) searchInput.addEventListener('input', renderCatalog);
    if(catFilter) catFilter.addEventListener('change', renderCatalog);
    if(clearBtn) clearBtn.addEventListener('click', () => { cart = []; renderCart(); });
    if(applyBtn) applyBtn.addEventListener('click', submitOrderToCashier);

    const mUnit = document.getElementById('modalUnitType');
    if(mUnit) mUnit.addEventListener('change', updateModalPrice);
}

// --- Catalog Rendering ---
function populateCategories() {
    const filter = document.getElementById('sellerCategoryFilter');
    if(!filter) return;
    const catSet = new Set(products.map(p => p.ProductCategory).filter(Boolean));
    const curr = filter.value;
    filter.innerHTML = `<option value="all">All Categories</option>`;
    catSet.forEach(c => filter.innerHTML += `<option value="${c}">${c}</option>`);
    filter.value = curr || 'all';
}

function renderCatalog() {
    const q = (document.getElementById('sellerSearchInput').value || '').toLowerCase();
    const cat = document.getElementById('sellerCategoryFilter').value;
    const tbody = document.getElementById('catalogBody');
    if(!tbody) return;
    
    let filtered = products.filter(p => {
        const mQ = (p.Product || '').toLowerCase().includes(q);
        const mCat = cat === 'all' || p.ProductCategory === cat;
        return mQ && mCat;
    });
    
    tbody.innerHTML = '';
    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-muted text-center">No products found.</td></tr>';
        return;
    }
    
    filtered.forEach(p => {
        const qty = Number(p.StockQuantity) || 0;
        let badge = '';
        let dis = '';
        if(qty <= 0) { badge = '<span class="badge bg-danger stock-badge">Out</span>'; dis = 'disabled'; }
        else if(qty <= 5) { badge = `<span class="badge bg-warning text-dark stock-badge">${qty} Low</span>`; }
        else { badge = `<span class="badge bg-success stock-badge">${qty} In Stock</span>`; }
        
        const row = document.createElement('tr');
        row.className = 'catalog-item-row';
        row.innerHTML = `
            <td class="ps-3 fw-bold">${p.Product}</td>
            <td class="text-muted small">${p.ProductCategory || '-'}</td>
            <td class="fw-bold text-primary">₦${Number(p.SellingPrice||0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
            <td>${badge}</td>
            <td class="pe-3 text-end"><button class="btn btn-sm btn-outline-primary fw-bold" onclick="addToCart('${p.id}')" ${dis}><i class="fas fa-plus"></i></button></td>
        `;
        tbody.appendChild(row);
    });
}

// --- Cart System & Modal ---
let currentModalProduct = null;

window.addToCart = function(id) {
    const prod = products.find(p => p.id === id);
    if(!prod) return;
    
    currentModalProduct = prod;
    document.getElementById('modalProductId').value = id;
    document.getElementById('modalProductName').innerText = `Add ${prod.Product}`;
    document.getElementById('modalUnitType').value = 'unit';
    document.getElementById('modalQty').value = 1;
    document.getElementById('modalDiscount').value = 0;
    updateModalPrice();
    
    const modalEl = document.getElementById('addToCartModal');
    if(modalEl) {
        new bootstrap.Modal(modalEl).show();
    }
};

window.updateModalPrice = function() {
    if(!currentModalProduct) return;
    const uType = document.getElementById('modalUnitType').value;
    let rate = 0;
    
    if(uType === 'carton') rate = Number(currentModalProduct.sellPerCarton) || 0;
    else if(uType === 'dozen') rate = Number(currentModalProduct.pricePerDozen) || 0;
    else if(uType === 'half') rate = Number(currentModalProduct.pricePerHalf) || 0;
    else if(uType === 'quarter') rate = Number(currentModalProduct.pricePerQuarter) || 0;
    else rate = Number(currentModalProduct.pricePerUnit) || Number(currentModalProduct.SellingPrice) || 0;

    document.getElementById('modalPrice').value = rate > 0 ? rate : 'N/A';
};

window.confirmAddToCart = function() {
    if(!currentModalProduct) return;
    
    const id = document.getElementById('modalProductId').value;
    const uType = document.getElementById('modalUnitType').value;
    const qty = Number(document.getElementById('modalQty').value) || 1;
    const disc = Number(document.getElementById('modalDiscount').value) || 0;
    const priceStr = document.getElementById('modalPrice').value;
    const price = Number(priceStr);
    
    if(isNaN(price) || price <= 0) {
        showAlert("Warning", "Selected unit type has no valid price.", "warning");
        return;
    }
    
    // Check if adding same product + unit type + discount strictly
    const existingIndex = cart.findIndex(c => c.id === id && c.unitType === uType && c.discountPercent === disc);
    if(existingIndex !== -1) {
        cart[existingIndex].qty += qty;
    } else {
        cart.push({
            id: currentModalProduct.id,
            name: currentModalProduct.Product,
            price: price,
            qty: qty,
            discountPercent: disc,
            maxQty: Number(currentModalProduct.StockQuantity) || 0,
            unitType: uType
        });
    }
    
    const max = Number(currentModalProduct.StockQuantity) || 0;
    
    const modalEl = document.getElementById('addToCartModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();
    
    renderCart();
}

window.changeCartQty = function(i, d) {
    const item = cart[i];
    const nq = item.qty + d;
    if(nq <= 0) { cart.splice(i, 1); }
    else { item.qty = nq; }
    renderCart();
};

window.removeFromCart = function(i) {
    cart.splice(i, 1);
    renderCart();
};

function updateCartAfterStockChange() {
    if(cart.length === 0) return;
    let modified = false;
    cart.forEach(c => {
        const p = products.find(x => x.id === c.id);
        if(p) {
            c.maxQty = Number(p.StockQuantity)||0;
            if(c.qty > c.maxQty) { c.qty = c.maxQty; modified = true; }
        } else {
            c.qty = 0; modified = true;
        }
    });
    cart = cart.filter(c => c.qty > 0);
    if(modified) {
        showAlert("Updated", "Cart items adjusted due to stock changes.", "info");
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cartItemsList');
    const emptyMsg = document.getElementById('emptyCartMsg');
    const badge = document.getElementById('cartCountBadge');
    const gTot = document.getElementById('cartTotal');
    const btn = document.getElementById('submitOrderBtn');
    
    container.innerHTML = '';
    if(cart.length === 0) {
        emptyMsg.classList.remove('d-none');
        badge.innerText = '0 Items';
        gTot.innerText = '₦0.00';
        btn.disabled = true;
        return;
    }
    
    emptyMsg.classList.add('d-none');
    btn.disabled = false;
    
    let gTotal = 0; let totalItems = 0;
    cart.forEach((c, i) => {
        const baseTot = c.price * c.qty;
        const discountAmt = baseTot * (c.discountPercent / 100);
        const itemFinal = baseTot - discountAmt;
        
        gTotal += itemFinal;
        totalItems += c.qty;
        
        container.innerHTML += `
            <div class="p-3 bg-light rounded border">
                <div class="d-flex justify-content-between mb-2">
                    <span class="fw-bold text-dark w-75 text-truncate" title="${c.name}">${c.name} (${c.unitType})</span>
                    <i class="fas fa-trash text-danger" style="cursor:pointer;" onclick="removeFromCart(${i})"></i>
                </div>
                ${c.discountPercent > 0 ? `<div class="text-danger small fw-bold mb-1"><i class="fas fa-tag"></i> ${c.discountPercent}% OFF</div>` : ''}
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-primary fw-bold small">₦${(c.price - (c.price * (c.discountPercent/100))).toLocaleString(undefined, {minimumFractionDigits:2})} / ea</span>
                    <div class="input-group input-group-sm" style="width: 100px;">
                        <button class="btn btn-outline-secondary px-2" onclick="changeCartQty(${i}, -1)">-</button>
                        <input type="text" class="form-control text-center px-1 bg-white fw-bold" value="${c.qty}" readonly>
                        <button class="btn btn-outline-secondary px-2" onclick="changeCartQty(${i}, 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    badge.innerText = `${totalItems} Items`;
    gTot.innerText = `₦${gTotal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

// --- Submit Order ---
async function submitOrderToCashier() {
    if(cart.length === 0) return;
    
    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
    
    const cInput = document.getElementById('cartCustomerInput').value.trim();
    let cId = null;
    let cName = cInput || "Walk-in";
    
    // Check if the typed customer exists to link ID
    const cObj = customers.find(x => x.name.toLowerCase() === cName.toLowerCase());
    if(cObj) {
        cId = cObj.id;
        cName = cObj.name;
    }
    
    let sub = 0; 
    let finalTotal = 0;
    cart.forEach(c => {
        const t = c.price * c.qty;
        sub += t;
        finalTotal += t - (t * (c.discountPercent / 100));
    });
    
    const payload = {
        refNo: sellerRefId,
        sellerName: currentUser.name,
        sellerId: currentUser.id,
        customerId: cId,
        customerName: cName,
        items: cart,
        subtotal: sub,
        discountPercent: 0, // General discount is 0 now, tracked per item
        totalDue: finalTotal,
        timestamp: new Date().toISOString()
    };
    
    try {
        await push(ref(db, 'pendingOrdersRef'), payload);
        showAlert("Success", "Order dispatched to Cashier!", "success");
        cart = [];
        document.getElementById('cartCustomerInput').value = "";
        generateRefNo();
        renderCart();
    } catch(err) {
        console.error(err);
        showAlert("Error", "Failed to send order.", "danger");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Send to Cashier';
    }
}
