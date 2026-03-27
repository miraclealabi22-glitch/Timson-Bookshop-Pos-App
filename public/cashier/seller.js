import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, update, get, remove } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

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
let sellerRefId = "";
let cart = [];
let nypCart = [];
let nypSelectedCustomer = null;
let isNypMode = false;

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
    let prefix = "POS";
    if(currentUser && currentUser.name) {
        const cleanName = currentUser.name.replace(/[^a-zA-Z]/g, '');
        prefix = (cleanName.length > 0 ? cleanName.padEnd(3, 'X') : "POS").substring(0, 3).toUpperCase();
    }
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    sellerRefId = prefix + randDigits;
    
    const dipRef = document.getElementById('sellerRefNo');
    const nypRef = document.getElementById('nypRefNoDisplay');
    if(dipRef) dipRef.innerText = sellerRefId;
    if(nypRef) nypRef.value = sellerRefId;
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
        if(pic) pic.innerHTML = currentUser.name.charAt(0).toUpperCase();

        generateRefNo(); // Update prefix once user loads
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
        if(typeof window.renderNypCatalog === 'function') window.renderNypCatalog();
        updateCartAfterStockChange();
        updateProductOptionsHTML();
    });

    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        customers = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        populateCustomerList();
        populateNypSelectors();
        if (typeof renderDebtorsReport === 'function') renderDebtorsReport();
        if (typeof populateCreditCustomersCheckout === 'function') populateCreditCustomersCheckout();
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
    
    if(searchInput) {
        searchInput.addEventListener('input', renderCatalog);
        searchInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                e.preventDefault();
                const q = searchInput.value.toLowerCase().trim();
                let filtered = products.filter(p => (p.barcode || '').toLowerCase() === q);
                if(filtered.length === 1 && Number(filtered[0].StockQuantity) > 0) {
                    addToCart(filtered[0].id);
                    searchInput.value = '';
                    renderCatalog();
                }
            }
        });
    }
    if(catFilter) catFilter.addEventListener('change', renderCatalog);
    if(clearBtn) clearBtn.addEventListener('click', () => { cart = []; renderCart(); });
    if(applyBtn) applyBtn.addEventListener('click', submitOrderToCashier);

    const mUnit = document.getElementById('modalUnitType');
    if(mUnit) mUnit.addEventListener('change', updateModalPrice);

    const mEl = document.getElementById('addToCartModal');
    if(mEl) {
        mEl.addEventListener('hidden.bs.modal', () => { window.nypMode = false; });
    }
}

// --- Catalog Rendering ---
function populateCategories() {
    const filter = document.getElementById('sellerCategoryFilter');
    if(!filter) return;
    const catSet = new Set(products.map(p => p.ProductCategory).filter(Boolean));
    const curr = filter.value;
    filter.innerHTML = `<option value="all">All Categories</option>`;
    catSet.forEach(c => filter.innerHTML += `<option value="${c}">${c}</option>`);
    const nypFilter = document.getElementById('nypCategoryFilter');
    if(nypFilter) {
        const nypCurr = nypFilter.value;
        nypFilter.innerHTML = `<option value="all">All Categories</option>`;
        catSet.forEach(c => nypFilter.innerHTML += `<option value="${c}">${c}</option>`);
        nypFilter.value = nypCurr || 'all';
    }
}

let productOptionsHTML = '<option value="" disabled selected>Select product...</option>';

function updateProductOptionsHTML() {
    productOptionsHTML = '<option value="" disabled selected>Select product...</option>';
    products.forEach(p => {
        if(Number(p.StockQuantity) > 0) {
            productOptionsHTML += `<option value="${p.id}">${p.Product} (Stock: ${p.StockQuantity})</option>`;
        }
    });
    
    // Update all existing dropdowns in NYP screen while preserving their current selection
    const selects = document.querySelectorAll('.nyp-product-input');
    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = productOptionsHTML;
        sel.value = currentVal;
    });
}

window.populateCreditCustomersCheckout = function() {
    const sel = document.getElementById('creditCustomerCheckoutSelect');
    if(!sel) return;
    const eligible = customers.filter(c => Number(c.creditLimit) > 0);
    sel.innerHTML = '<option value="" disabled selected>Choose active NYP customer...</option>';
    eligible.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

function renderCatalog() {
    const q = (document.getElementById('sellerSearchInput').value || '').toLowerCase();
    const cat = document.getElementById('sellerCategoryFilter').value;
    const grid = document.getElementById('sellerCatalogGrid');
    if(!grid) return;
    
    let filtered = products.filter(p => {
        const mQ = (p.Product || '').toLowerCase().includes(q) 
                || (p.ProductCategory || '').toLowerCase().includes(q)
                || (p.barcode || '').toLowerCase().includes(q);
        const mCat = cat === 'all' || p.ProductCategory === cat;
        return mQ && mCat;
    });
    
    grid.innerHTML = '';
    if(filtered.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><i class="fas fa-search-minus fa-3x mb-3"></i><h5>No products found.</h5></div>';
        return;
    }
    
    filtered.forEach(p => {
        const qty = Number(p.StockQuantity) || 0;
        let badge = '';
        let dis = '';
        if(qty <= 0) { badge = '<span class="badge bg-danger rounded-pill px-3 py-1">Out of Stock</span>'; dis = 'disabled'; }
        else if(qty <= 5) { badge = `<span class="badge bg-warning text-dark rounded-pill px-3 py-1">${qty} Low Stock</span>`; }
        else { badge = `<span class="badge bg-success bg-opacity-10 text-success border border-success rounded-pill px-3 py-1">${qty} In Stock</span>`; }
        
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-xl-3';
        col.innerHTML = `
            <div class="card h-100 shadow-sm border-0 product-card laymen-card" onclick="if(${qty}>0) addToCart('${p.id}')" style="cursor: ${qty>0?'pointer':'not-allowed'}; transition: transform 0.2s, box-shadow 0.2s; ${qty<=0?'opacity:0.7;':''}" onmouseover="this.classList.add('shadow')" onmouseout="this.classList.remove('shadow')">
                <div class="card-body text-center p-3 d-flex flex-column">
                    <div class="mb-3 mt-2">
                        <div class="d-inline-flex align-items-center justify-content-center bg-light rounded-circle" style="width: 60px; height: 60px;">
                            <i class="fas fa-box-open fa-lg text-primary"></i>
                        </div>
                    </div>
                    <h6 class="fw-bold mb-1 text-dark text-truncate" style="font-size: 1rem;">${p.Product}</h6>
                    <small class="text-muted d-block mb-3" style="font-size: 0.8rem;">${p.ProductCategory || 'Uncategorized'}</small>
                    <div class="mt-auto">
                        <div class="fw-bold text-primary mb-2" style="font-size: 1.25rem;">₦${Number(p.SellingPrice||0).toLocaleString()}</div>
                        <div class="mb-3">${badge}</div>
                        <button class="btn ${qty>0?'btn-primary':'btn-secondary'} w-100 py-2 fw-bold shadow-sm laymen-add-btn" onclick="event.stopPropagation(); addToCart('${p.id}')" ${dis}>
                            <i class="fas fa-cart-plus me-2"></i> Add Item
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

// --- Cart System & Modal ---
let currentModalProduct = null;

window.addToCart = function(id) {
    isNypMode = false;
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
    
    if(uType === 'carton') rate = Number(currentModalProduct.cartonSellingPrice) || 0;
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
    
    const targetCart = isNypMode ? nypCart : cart;
    const existingIndex = targetCart.findIndex(c => c.id === id && c.unitType === uType && c.discountPercent === disc);
    
    if(existingIndex !== -1) {
        targetCart[existingIndex].qty += qty;
    } else {
        targetCart.push({
            id: currentModalProduct.id,
            name: currentModalProduct.Product,
            price: price,
            qty: qty,
            discountPercent: disc,
            maxQty: Number(currentModalProduct.StockQuantity) || 0,
            unitType: uType
        });
    }
    
    const modalEl = document.getElementById('addToCartModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    if(modal) modal.hide();
    
    if(isNypMode) renderNypCart();
    else renderCart();
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
            <div class="p-3 bg-white border border-light shadow-sm rounded mb-2" style="transition: all 0.2s ease;">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0 fw-bold text-dark text-truncate pe-2" style="max-width: 80%; font-size: 1.1rem;">${c.name} <span class="badge bg-light text-dark ms-1" style="font-size:0.75rem;">${c.unitType}</span></h6>
                    <button class="btn btn-link text-danger p-0 m-0 laymen-trash-btn" onclick="removeFromCart(${i})" title="Remove Item"><i class="fas fa-trash-alt fa-lg"></i></button>
                </div>
                ${c.discountPercent > 0 ? `<div class="text-danger small fw-bold mb-2"><i class="fas fa-tag"></i> ${c.discountPercent}% OFF</div>` : ''}
                <div class="d-flex justify-content-between align-items-end mt-3">
                    <div class="text-primary fw-bold fs-5">₦${itemFinal.toLocaleString(undefined, {minimumFractionDigits:2})} <small class="text-muted fs-6 fw-normal d-block" style="margin-top:-2px;">@ ₦${(c.price - (c.price * (c.discountPercent/100))).toLocaleString()} / ea</small></div>
                    <div class="input-group" style="width: 140px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <button class="btn btn-light border px-3" onclick="changeCartQty(${i}, -1)" style="font-size:1.1rem;">
                            <i class="fas fa-minus text-muted"></i>
                        </button>
                        <input type="text" class="form-control border text-center fw-bold bg-white" style="font-size:1.2rem; min-width: 40px;" value="${c.qty}" readonly>
                        <button class="btn btn-light border px-3" onclick="changeCartQty(${i}, 1)" style="font-size:1.1rem;">
                            <i class="fas fa-plus text-success"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    badge.innerText = `${totalItems} Items`;
    gTot.innerText = `₦${gTotal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // Enable checkout buttons based on items
    const chkBtn = document.getElementById('directCheckoutBtn');
    if(chkBtn) chkBtn.disabled = cart.length === 0;
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

// --- NYP SALES SCREEN (Split View Logic) ---

window.renderNypCatalog = function() {
    const grid = document.getElementById('nypCatalogGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    
    let filtered = products;
    const catFiler = document.getElementById('nypCategoryFilter')?.value;
    const search = document.getElementById('nypSearchInput')?.value.toLowerCase();
    
    if(catFiler && catFiler !== 'all') {
        filtered = filtered.filter(p => p.ProductCategory === catFiler);
    }
    if(search) {
        filtered = filtered.filter(p => 
            p.Product.toLowerCase().includes(search) || 
            p.ProductCategory?.toLowerCase().includes(search) ||
            (p.barcode || '').toLowerCase().includes(search)
        );
    }
    
    if(filtered.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><i class="fas fa-search-minus fa-3x mb-3"></i><h5>No NYP products found.</h5></div>';
        return;
    }
    
    filtered.forEach(p => {
        const qty = Number(p.StockQuantity) || 0;
        const sp = Number(p.SellingPrice) || 0;
        
        let badge = '';
        let dis = '';
        if(qty <= 0) { badge = '<span class="badge bg-danger rounded-pill px-3 py-1">Out of Stock</span>'; dis = 'disabled'; }
        else if(qty <= 5) { badge = `<span class="badge bg-warning text-dark rounded-pill px-3 py-1">${qty} Low Stock</span>`; }
        else { badge = `<span class="badge bg-success bg-opacity-10 text-success border border-success rounded-pill px-3 py-1">${qty} In Stock</span>`; }
        
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-xl-3';
        col.innerHTML = `
            <div class="card h-100 shadow-sm border-0 product-card laymen-card" onclick="if(${qty}>0) addToNypCart('${p.id}')" style="cursor: ${qty>0?'pointer':'not-allowed'}; transition: transform 0.2s, box-shadow 0.2s; ${qty<=0?'opacity:0.7;':''}" onmouseover="this.classList.add('shadow')" onmouseout="this.classList.remove('shadow')">
                <div class="card-body text-center p-3 d-flex flex-column">
                    <div class="mb-3 mt-2">
                        <div class="d-inline-flex align-items-center justify-content-center bg-light rounded-circle" style="width: 60px; height: 60px;">
                            <i class="fas fa-file-invoice-dollar fa-lg text-primary"></i>
                        </div>
                    </div>
                    <h6 class="fw-bold mb-1 text-dark text-truncate" style="font-size: 1rem;">${p.Product}</h6>
                    <small class="text-muted d-block mb-3" style="font-size: 0.8rem;">${p.ProductCategory || 'Uncategorized'}</small>
                    <div class="mt-auto">
                        <div class="fw-bold text-success mb-2" style="font-size: 1.25rem;">₦${sp.toLocaleString()}</div>
                        <div class="mb-3">${badge}</div>
                        <button class="btn ${qty>0?'btn-success':'btn-secondary'} w-100 py-2 fw-bold shadow-sm laymen-add-btn" onclick="event.stopPropagation(); addToNypCart('${p.id}')" ${dis}>
                            <i class="fas fa-cart-plus me-2"></i> Add Credit Item
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

function populateNypSelectors() {
    const sel = document.getElementById('nypCustomerSelect');
    if(!sel) return;
    const eligible = customers.filter(c => Number(c.creditLimit) > 0);
    const curr = sel.value;
    sel.innerHTML = '<option value="" disabled selected>Choose active NYP customer...</option>';
    eligible.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    sel.value = curr;
}

window.onNypSalesCustomerSelect = function() {
    // This function used to handle old layout elements, just forwarding to calculate here.
    window.calculateNypTotals();
}

// Ensure the NYP screen gets populated correctly on load or data update
document.addEventListener("DOMContentLoaded", () => {
    const nypSearchInput = document.getElementById('nypSearchInput');
    const nypCatFilter = document.getElementById('nypCategoryFilter');
    
    if(nypSearchInput) {
        nypSearchInput.addEventListener('input', window.renderNypCatalog);
        nypSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = nypSearchInput.value.toLowerCase().trim();
                let filtered = products.filter(p => (p.barcode || '').toLowerCase() === q);
                if (filtered.length === 1 && Number(filtered[0].StockQuantity) > 0) {
                    window.addToNypCart(filtered[0].id);
                    nypSearchInput.value = '';
                    window.renderNypCatalog();
                }
            }
        });
    }
    if(nypCatFilter) nypCatFilter.addEventListener('change', window.renderNypCatalog);
});

window.addToNypCart = function(id) {
    isNypMode = true;
    const prod = products.find(p => p.id === id);
    if(!prod) return;
    
    currentModalProduct = prod;
    document.getElementById('modalProductId').value = id;
    document.getElementById('modalProductName').innerText = `Add ${prod.Product} (NYP)`;
    document.getElementById('modalUnitType').value = 'unit';
    document.getElementById('modalQty').value = 1;
    document.getElementById('modalDiscount').value = 0;
    updateModalPrice();
    
    const modalEl = document.getElementById('addToCartModal');
    if(modalEl) {
        new bootstrap.Modal(modalEl).show();
    }
}

window.changeNypCartQty = function(i, d) {
    const item = nypCart[i];
    const nq = item.qty + d;
    if(nq <= 0) { nypCart.splice(i, 1); }
    else { item.qty = nq; }
    renderNypCart();
}

window.removeFromNypCart = function(i) {
    nypCart.splice(i, 1);
    renderNypCart();
}

window.renderNypCart = function() {
    const list = document.getElementById('nypCartItemsList');
    const emptyMsg = document.getElementById('nypEmptyCartMsg');
    const badge = document.getElementById('nypCartCountBadge');
    
    if(!list) return;
    
    if(nypCart.length === 0) {
        list.innerHTML = "";
        if(emptyMsg) emptyMsg.classList.remove('d-none');
        if(badge) badge.innerText = "0 Items";
        window.calculateNypTotals();
        return;
    }
    
    if(emptyMsg) emptyMsg.classList.add('d-none');
    
    let html = "";
    let itemCount = 0;
    
    nypCart.forEach((c, i) => {
        itemCount += c.qty;
        const tot = (c.price * c.qty);
        const disc = tot * (c.discountPercent / 100);
        const finalTot = tot - disc;
        
        html += `
        <div class="p-3 bg-white border border-light shadow-sm rounded mb-2" style="transition: all 0.2s ease;">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="mb-0 fw-bold text-dark text-truncate pe-2" style="max-width: 80%; font-size: 1.1rem;">${c.name} <span class="badge bg-light text-dark ms-1" style="font-size:0.75rem;">${c.unitType}</span></h6>
                <button class="btn btn-link text-danger p-0 m-0 laymen-trash-btn" onclick="removeFromNypCart(${i})" title="Remove Item"><i class="fas fa-trash-alt fa-lg"></i></button>
            </div>
            ${c.discountPercent > 0 ? `<div class="text-danger small fw-bold mb-2"><i class="fas fa-tag"></i> ${c.discountPercent}% OFF</div>` : ''}
            <div class="d-flex justify-content-between align-items-end mt-3">
                <div class="text-primary fw-bold fs-5">₦${finalTot.toLocaleString(undefined, {minimumFractionDigits:2})} <small class="text-muted fs-6 fw-normal d-block" style="margin-top:-2px;">@ ₦${(c.price - (c.price * (c.discountPercent/100))).toLocaleString()} / ea</small></div>
                <div class="input-group" style="width: 140px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <button class="btn btn-light border px-3" onclick="changeNypCartQty(${i}, -1)" style="font-size:1.1rem;">
                        <i class="fas fa-minus text-muted"></i>
                    </button>
                    <input type="text" class="form-control border text-center fw-bold bg-white" style="font-size:1.2rem; min-width: 40px;" value="${c.qty}" readonly>
                    <button class="btn btn-light border px-3" onclick="changeNypCartQty(${i}, 1)" style="font-size:1.1rem;">
                        <i class="fas fa-plus text-success"></i>
                    </button>
                </div>
            </div>
        </div>`;
    });
    
    list.innerHTML = html;
    if(badge) badge.innerText = `${itemCount} Item${itemCount > 1 ? 's' : ''}`;
    window.calculateNypTotals();
}

window.calculateNypTotals = function() {
    const totEl = document.getElementById('nypCartTotal');
    const btn = document.getElementById('processNypSaleBtn');
    const cid = document.getElementById('nypCustomerSelect')?.value;
    
    let total = 0;
    nypCart.forEach(c => {
        total += (c.price * c.qty) * (1 - c.discountPercent / 100);
    });
    
    if(totEl) totEl.innerText = `₦${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    const cObj = customers.find(x => x.id === cid);
    const limitWarning = document.getElementById('nypCustomerLimitWarning');
    
    let isValid = false;

    if(cObj && total > 0) {
        const avail = (Number(cObj.creditLimit) || 0) - (Number(cObj.balanceOwed) || 0);
        if(total <= avail) {
            isValid = true;
            if(limitWarning) limitWarning.classList.add('d-none');
        } else {
            isValid = false;
            if(limitWarning) limitWarning.classList.remove('d-none');
        }
    } else {
        if(limitWarning) limitWarning.classList.add('d-none');
    }
    
    if(btn) btn.disabled = !isValid;
}

document.getElementById('clearNypCartBtn')?.addEventListener('click', () => { 
    if(confirm("Clear NYP Cart?")) {
        nypCart = []; 
        renderNypCart(); 
    }
});

window.processNypSale = async function() {
    const btn = document.getElementById('processNypSaleBtn');
    const cid = document.getElementById('nypCustomerSelect')?.value;
    const cObj = customers.find(x => x.id === cid);
    
    if(!cObj || nypCart.length === 0) return;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
    btn.disabled = true;

    let sub = 0;
    let total = 0;
    nypCart.forEach(c => {
        const t = c.price * c.qty;
        sub += t;
        total += t * (1 - c.discountPercent / 100);
    });

    const finalRefId = document.getElementById('nypRefNoDisplay')?.value || sellerRefId;

    const txnPayload = {
        refNo: finalRefId,
        sellerName: currentUser.name,
        cashierName: currentUser.name + " (NYP Checkout)",
        customerId: cObj.id,
        customerName: cObj.name,
        items: nypCart,
        subtotal: sub,
        discountPercent: 0,
        totalAmount: total,
        paymentMethod: "Credit Account",
        date: new Date().toISOString()
    };

    try {
        await push(ref(db, 'transactionsRef'), txnPayload);

        for (let item of nypCart) {
            const stockRefStr = `stockRef/${item.id}`;
            const sSnap = await get(ref(db, stockRefStr));
            if (sSnap.exists()) {
                const pData = sSnap.val();
                let actualQty = item.qty;
                if(item.unitType === 'carton') actualQty = item.qty * (Number(pData.cartonSize) || 1);
                else if(item.unitType === 'dozen') actualQty = item.qty * 12;
                else if(item.unitType === 'half') actualQty = item.qty * 6;
                else if(item.unitType === 'quarter') actualQty = item.qty * 3;
                
                const cartonSize = Number(pData.cartonSize) || 0;
                let currentTotalUnits = Number(pData.StockQuantity) || 0;
                
                // If cartonSize is zero, it's just basic stock deduction.
                if (cartonSize === 0) {
                    const newTotal = Math.max(0, currentTotalUnits - actualQty);
                    await update(ref(db, stockRefStr), { 
                        StockQuantity: newTotal,
                        unitQuantity: newTotal
                    });
                } else {
                    // True deduction recalculating full cartons and remainder units
                    const newTotalUnits = Math.max(0, currentTotalUnits - actualQty);
                    const newCartonQty = Math.floor(newTotalUnits / cartonSize);
                    const newUnitQty = newTotalUnits % cartonSize;
                    
                    await update(ref(db, stockRefStr), { 
                        StockQuantity: newTotalUnits,
                        cartonQuantity: newCartonQty,
                        unitQuantity: newUnitQty
                    });
                }
            }
        }

        const bal = Number(cObj.balanceOwed) || 0;
        await update(ref(db, `customersRef/${cObj.id}`), { balanceOwed: bal + total });
        await push(ref(db, `customersRef/${cObj.id}/transactions`), {
            date: txnPayload.date,
            type: "Purchase",
            amount: total,
            ref: finalRefId
        });

        showAlert("Success", "Credit Sale recorded successfully!", "success");
        nypCart = [];
        document.getElementById('nypCustomerSelect').value = "";
        generateRefNo();
        renderNypCart();
        
    } catch (err) {
        console.error(err);
        showAlert("Error", "Transaction failed to record.", "danger");
    } finally {
        btn.innerHTML = '<i class="fas fa-check-double me-2"></i> Complete NYP Sale';
        btn.disabled = false;
    }
}


// --- NYP Payment (Credit Payment Collection) logic ---
window.renderDebtorsReport = function() {
    const tbody = document.getElementById('debtorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const debtors = customers.filter(c => (Number(c.balanceOwed) || 0) > 0);

    if (debtors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-muted">No outstanding debtors.</td></tr>';
        return;
    }

    debtors.sort((a, b) => (Number(b.balanceOwed) || 0) - (Number(a.balanceOwed) || 0));

    const nypSel = document.getElementById('nypCustomer');
    if (nypSel) {
        nypSel.innerHTML = '<option value="" disabled selected>Select Customer...</option>';
        debtors.forEach(c => {
            nypSel.innerHTML += `<option value="${c.id}">${c.name} (Debt: ₦${(Number(c.balanceOwed)).toLocaleString()})</option>`;
        });
    }

    debtors.forEach(d => {
        let lastDate = "Unknown";
        if (d.transactions) {
            const txns = Object.values(d.transactions);
            const pays = txns.filter(t => t.type === 'Payment').sort((a, b) => new Date(b.date) - new Date(a.date));
            if (pays.length > 0) lastDate = new Date(pays[0].date).toLocaleDateString();
        }

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-start"><i class="fas fa-user-circle text-muted me-2"></i>${d.name}</td>
                <td>${d.phone || d.email || 'N/A'}</td>
                <td class="fw-bold text-danger">₦${(Number(d.balanceOwed) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="text-muted">${lastDate}</td>
                <td><button class="btn btn-sm btn-outline-info" onclick="openNypPaymentModal()"><i class="fas fa-handshake"></i> Collect</button></td>
            </tr>
        `;
    });
}

window.openNypPaymentModal = function () {
    document.getElementById('nypCustomer').value = "";
    document.getElementById('nypDebtBalance').value = "₦0.00";
    document.getElementById('nypAmountPaid').value = "";
    new bootstrap.Modal(document.getElementById('nypModal')).show();
}

window.nypCustomerChanged = function () {
    const cId = document.getElementById('nypCustomer').value;
    const cObj = customers.find(c => c.id === cId);
    if (cObj) {
        document.getElementById('nypDebtBalance').value = `₦${(Number(cObj.balanceOwed) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
}

document.getElementById('nypForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnProcessNyp');
    btn.innerHTML = "Processing...";
    btn.disabled = true;

    const cId = document.getElementById('nypCustomer').value;
    const amt = Number(document.getElementById('nypAmountPaid').value) || 0;
    const cObj = customers.find(c => c.id === cId);

    try {
        if (cObj) {
            const newBal = Math.max(0, (Number(cObj.balanceOwed) || 0) - amt);
            await update(ref(db, `customersRef/${cId}`), { balanceOwed: newBal });

            await push(ref(db, `customersRef/${cId}/transactions`), {
                date: new Date().toISOString(),
                type: "Payment",
                amount: amt,
                ref: 'NYP-' + Date.now().toString().slice(-6)
            });

            await push(ref(db, 'transactionsRef'), {
                refNo: 'NYP-' + Date.now().toString().slice(-6),
                cashierName: currentUser.name + " (Seller)",
                customerId: cId,
                customerName: cObj.name,
                totalAmount: amt,
                paymentMethod: "NYP Debt Payment",
                date: new Date().toISOString()
            });

            showAlert("Success", "NYP Payment processed!", "success");
            const mdl = bootstrap.Modal.getOrCreateInstance(document.getElementById('nypModal'));
            if(mdl) mdl.hide();
        }
    } catch (err) {
        console.error(err);
        showAlert("Error", "Failed to process payment.", "danger");
    } finally {
        btn.innerHTML = "Process NYP Payment";
        btn.disabled = false;
    }
});

