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
let nypCart = [];
let nypSelectedCustomer = null;

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
    
    if(searchInput) searchInput.addEventListener('input', renderCatalog);
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

// --- NYP Sales Screen Specific Logic (Table-Based Entry) ---
function populateNypSelectors() {
    const sel = document.getElementById('nypSelectorMain');
    if(!sel) return;
    const eligible = customers.filter(c => Number(c.creditLimit) > 0);
    const curr = sel.value;
    sel.innerHTML = '<option value="" disabled selected>Choose customer for credit sale...</option>';
    eligible.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    sel.value = curr;
}

window.onNypSalesCustomerSelect = function() {
    const cId = document.getElementById('nypSelectorMain').value;
    const banner = document.getElementById('nypCreditBanner');
    const availEl = document.getElementById('nypAvailDisplay');
    const staffEl = document.getElementById('nypStaffDisplay');
    
    const cObj = customers.find(c => c.id === cId);
    if(cObj) {
        nypSelectedCustomer = cObj;
        const lim = Number(cObj.creditLimit) || 0;
        const bal = Number(cObj.balanceOwed) || 0;
        const avail = lim - bal;
        window.currentNypAvailable = avail;
        
        availEl.innerText = `₦${avail.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        banner.classList.remove('d-none');
        staffEl.value = currentUser.name;
        
        const now = new Date();
        document.getElementById('nypRefNoDisplay').value = sellerRefId;
        document.getElementById('nypYearDisplay').innerText = now.getFullYear();
        document.getElementById('nypMonthDisplay').innerText = now.toLocaleString('default', { month: 'long' });
        document.getElementById('nypDateDisplay').innerText = now.toISOString().split('T')[0];
    }
}

window.addNypRow = function() {
    const tbody = document.getElementById('nypEntryBody');
    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', rowCount);
    tr.innerHTML = `
        <td><span class="text-muted fw-bold">${rowCount}</span></td>
        <td><input type="text" class="form-control form-control-sm text-center bg-transparent border-0 fw-bold nyp-stock-bal" readonly value="-"></td>
        <td class="text-start">
            <select class="form-select form-select-sm nyp-input-minimal nyp-product-input" onchange="onNypProductChange(this)">
                ${productOptionsHTML}
            </select>
        </td>
        <td><input type="number" class="form-control nyp-input-minimal text-center nyp-qty" value="1" min="1" oninput="calculateNypRow(this)"></td>
        <td><span class="nyp-status-pill nyp-status-stock nyp-ctn-size">-</span></td>
        <td><input type="text" class="form-control form-control-sm text-center bg-white border-0 fw-bold nyp-price-rate" readonly value="0"></td>
        <td><input type="text" class="form-control form-control-sm text-center bg-white border-0 fw-bold text-primary nyp-total-sum" readonly value="0"></td>
        <td><input type="number" class="form-control nyp-input-minimal text-center nyp-discount" value="0" min="0" max="100" oninput="calculateNypRow(this)"></td>
        <td><button class="btn btn-link text-danger p-0" onclick="removeNypRow(this)"><i class="fas fa-times-circle fs-5"></i></button></td>
    `;
    tbody.appendChild(tr);
}

window.removeNypRow = function(btn) {
    const row = btn.closest('tr');
    row.remove();
    // Re-index
    const rows = document.querySelectorAll('#nypEntryBody tr');
    rows.forEach((r, idx) => {
        r.querySelector('td:first-child').innerText = idx + 1;
    });
    updateNypTotals();
}

window.onNypProductChange = function(select) {
    const row = select.closest('tr');
    const pId = select.value;
    const prod = products.find(p => p.id === pId);
    
    if(!prod) {
        row.querySelector('.nyp-stock-bal').value = "";
        row.querySelector('.nyp-price-rate').value = "";
        row.querySelector('.nyp-ctn-size').innerText = "-";
        return;
    }

    row.setAttribute('data-prod-id', prod.id);
    row.querySelector('.nyp-stock-bal').value = `${prod.StockQuantity} pcs`;
    row.querySelector('.nyp-price-rate').value = Number(prod.SellingPrice || 0);
    row.querySelector('.nyp-ctn-size').innerText = prod.cartonSize || "-";
    
    window.calculateNypRow(input);
}

window.calculateNypRow = function(input) {
    const row = input.closest('tr');
    const qty = Number(row.querySelector('.nyp-qty').value) || 0;
    const rate = Number(row.querySelector('.nyp-price-rate').value) || 0;
    const disc = Number(row.querySelector('.nyp-discount').value) || 0;
    
    const rowTot = qty * rate;
    const discAmt = rowTot * (disc / 100);
    const finalTot = rowTot - discAmt;
    
    row.querySelector('.nyp-total-sum').value = finalTot.toFixed(2);
    updateNypTotals();
}

function updateNypTotals() {
    const sums = document.querySelectorAll('.nyp-total-sum');
    let total = 0;
    sums.forEach(s => total += Number(s.value) || 0);
    
    const totalEl = document.getElementById('nypAllTotalSum');
    const btn = document.getElementById('nypSubmitBtn');
    
    totalEl.value = `₦${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    const availLimit = window.currentNypAvailable || 0;
    if(total > 0 && total <= availLimit) {
        btn.disabled = false;
        totalEl.classList.remove('text-danger');
        totalEl.classList.add('text-success');
    } else {
        btn.disabled = true;
        totalEl.classList.remove('text-success');
        if(total > availLimit) totalEl.classList.add('text-danger');
    }
}

window.clearNypScreen = function() {
    if(!confirm("Reset entire NYP screen?")) return;
    document.getElementById('nypSelectorMain').value = "";
    document.getElementById('nypCreditBanner').classList.add('d-none');
    document.getElementById('nypEntryBody').innerHTML = `
        <tr data-row-id="1">
            <td><span class="text-muted fw-bold">1</span></td>
            <td><input type="text" class="form-control form-control-sm text-center bg-transparent border-0 fw-bold nyp-stock-bal" readonly value="-"></td>
            <td class="text-start">
                <select class="form-select form-select-sm nyp-input-minimal nyp-product-input" onchange="onNypProductChange(this)">
                    ${productOptionsHTML}
                </select>
            </td>
            <td><input type="number" class="form-control nyp-input-minimal text-center nyp-qty" value="1" min="1" oninput="calculateNypRow(this)"></td>
            <td><span class="nyp-status-pill nyp-status-stock nyp-ctn-size">-</span></td>
            <td><input type="text" class="form-control form-control-sm text-center bg-white border-0 fw-bold nyp-price-rate" readonly value="0"></td>
            <td><input type="text" class="form-control form-control-sm text-center bg-white border-0 fw-bold text-primary nyp-total-sum" readonly value="0"></td>
            <td><input type="number" class="form-control nyp-input-minimal text-center nyp-discount" value="0" min="0" max="100" oninput="calculateNypRow(this)"></td>
            <td><button class="btn btn-link text-danger p-0 d-none" onclick="removeNypRow(this)"><i class="fas fa-times-circle fs-5"></i></button></td>
        </tr>
    `;
    updateNypTotals();
    nypSelectedCustomer = null;
    generateRefNo();
}

window.finalizeNypScreenSale = async function() {
    if(!nypSelectedCustomer) {
        showAlert("Error", "Select customer first", "danger");
        return;
    }
    
    const btn = document.getElementById('nypSubmitBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing Credit Sale...';
    btn.disabled = true;

    const items = [];
    let total = 0;
    let sub = 0;
    
    const rows = document.querySelectorAll('#nypEntryBody tr');
    for(let row of rows) {
        const pid = row.getAttribute('data-prod-id');
        const pName = products.find(p => p.id === pid)?.Product || "Unknown";
        const qty = Number(row.querySelector('.nyp-qty').value) || 0;
        const rate = Number(row.querySelector('.nyp-price-rate').value) || 0;
        const disc = Number(row.querySelector('.nyp-discount').value) || 0;
        const rowSum = Number(row.querySelector('.nyp-total-sum').value) || 0;
        
        if(pid && qty > 0) {
            items.push({
                id: pid,
                name: pName,
                qty: qty,
                price: rate,
                discountPercent: disc,
                unitType: "unit" // Based on table entry
            });
            sub += (qty * rate);
            total += rowSum;
        }
    }

    if(items.length === 0) { btn.disabled = false; btn.innerHTML='Complete Sale'; return; }

    const finalRefId = document.getElementById('nypRefNoDisplay').value || sellerRefId;

    const txnPayload = {
        refNo: finalRefId,
        sellerName: currentUser.name,
        cashierName: currentUser.name + " (NYP Screen)",
        customerId: nypSelectedCustomer.id,
        customerName: nypSelectedCustomer.name,
        items: items,
        subtotal: sub,
        discountPercent: 0,
        totalAmount: total,
        paymentMethod: "Credit Account",
        year: document.getElementById('nypYearDisplay').innerText,
        month: document.getElementById('nypMonthDisplay').innerText,
        date: new Date().toISOString()
    };

    try {
        await push(ref(db, 'transactionsRef'), txnPayload);

        for (let item of items) {
            const stockRefStr = `stockRef/${item.id}`;
            const sSnap = await get(ref(db, stockRefStr));
            if (sSnap.exists()) {
                const currentStock = Number(sSnap.val().StockQuantity) || 0;
                await update(ref(db, stockRefStr), { StockQuantity: Math.max(0, currentStock - item.qty) });
            }
        }

        const bal = Number(nypSelectedCustomer.balanceOwed) || 0;
        await update(ref(db, `customersRef/${nypSelectedCustomer.id}`), { balanceOwed: bal + total });
        await push(ref(db, `customersRef/${nypSelectedCustomer.id}/transactions`), {
            date: txnPayload.date,
            type: "Purchase",
            amount: total,
            ref: finalRefId
        });

        showAlert("Success", "NYP Credit Sale completed!", "success");
        window.clearNypScreen();
        
    } catch (err) {
        console.error(err);
        showAlert("Error", "Transaction failed.", "danger");
    } finally {
        btn.innerHTML = '<i class="fas fa-save me-2"></i> Complete Sale';
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
            const mdl = bootstrap.Modal.getInstance(document.getElementById('nypModal'));
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

// --- Seller Checkout Logic (Credit / NYP) ---

window.openSellerCheckoutModal = function () {
    if(cart.length === 0) return;

    let sub = 0; 
    let finalTotal = 0;
    cart.forEach(c => {
        const t = c.price * c.qty;
        sub += t;
        finalTotal += t - (t * (c.discountPercent / 100));
    });

    window.sellerCheckoutTotal = finalTotal;
    window.sellerCheckoutSubtotal = sub;

    document.getElementById('checkoutTotalDue').innerText = `Amount Due: ₦${Number(finalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const pMethod = document.getElementById('paymentMethod');
    pMethod.value = "";
    document.getElementById('cashReceivedCheckout').value = "";
    document.getElementById('changeDueCheckout').value = "";
    document.getElementById('refNumberCheckout').value = "";
    document.getElementById('creditCustomerCheckoutSelect').value = "";

    window.toggleCheckoutFields();
    new bootstrap.Modal(document.getElementById('sellerCheckoutModal')).show();
}

window.toggleCheckoutFields = function () {
    const m = document.getElementById('paymentMethod').value;
    const cFields = document.getElementById('cashFieldsCheckout');
    const rFields = document.getElementById('refFieldsCheckout');
    const crFields = document.getElementById('creditFieldsCheckout');
    const btn = document.getElementById('confirmCheckoutBtn');

    if(cFields) cFields.classList.add('d-none');
    if(rFields) rFields.classList.add('d-none');
    if(crFields) crFields.classList.add('d-none');
    if(btn) btn.disabled = true;

    if (m === 'Cash') {
        cFields.classList.remove('d-none');
        window.calculateChangeCheckout(); 
    } else if (m === 'POS' || m === 'Bank Transfer') {
        rFields.classList.remove('d-none');
        document.getElementById('refLabelCheckout').innerText = m === 'POS' ? 'POS Slip Number' : 'Bank Reference Number';
        btn.disabled = false;
    } else if (m === 'Credit Account') {
        crFields.classList.remove('d-none');
        window.validateCreditSale();
    }
}

window.calculateChangeCheckout = function () {
    const rcvd = Number(document.getElementById('cashReceivedCheckout').value) || 0;
    const chgEl = document.getElementById('changeDueCheckout');
    const btn = document.getElementById('confirmCheckoutBtn');
    const tot = Number(window.sellerCheckoutTotal || 0);

    if (rcvd === tot && tot > 0) {
        if(chgEl) { chgEl.value = `Exact ₦${rcvd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`; chgEl.className = "form-control form-control-lg bg-white text-success fw-bold"; }
        if(btn) btn.disabled = false;
    } else if (rcvd > tot) {
        if(chgEl) { chgEl.value = `Overpaid ₦${(rcvd - tot).toLocaleString(undefined, { minimumFractionDigits: 2 })} - Exact Required`; chgEl.className = "form-control form-control-lg bg-white text-warning fw-bold"; }
        if(btn) btn.disabled = true;
    } else {
        if(chgEl) { chgEl.value = `Short ₦${(tot - rcvd).toLocaleString(undefined, { minimumFractionDigits: 2 })}`; chgEl.className = "form-control form-control-lg bg-white text-danger fw-bold"; }
        if(btn) btn.disabled = true;
    }
}

window.validateCreditSale = function() {
    const cId = document.getElementById('creditCustomerCheckoutSelect').value;
    const btn = document.getElementById('confirmCheckoutBtn');
    const details = document.getElementById('creditCustomerDetails');
    const errMsg = document.getElementById('creditErrorMsg');
    const sucMsg = document.getElementById('creditSuccessMsg');
    
    details.classList.add('d-none');
    errMsg.classList.add('d-none');
    sucMsg.classList.add('d-none');
    btn.disabled = true;
    
    if(!cId) return;
    
    const cObj = customers.find(c => c.id === cId);
    if(!cObj) return;
    
    const limit = Number(cObj.creditLimit) || 0;
    const bal = Number(cObj.balanceOwed) || 0;
    const avail = limit - bal;
    const tot = Number(window.sellerCheckoutTotal || 0);
    
    document.getElementById('ccName').innerText = cObj.name;
    document.getElementById('ccPhone').innerText = cObj.phone || cObj.email || 'N/A';
    document.getElementById('ccLimit').innerText = `₦${limit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('ccBalance').innerText = `₦${bal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    const availEl = document.getElementById('ccAvailable');
    availEl.innerText = `₦${avail.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    availEl.className = avail >= tot ? "fs-5 fw-bold text-success" : "fs-5 fw-bold text-danger";
    
    details.classList.remove('d-none');
    
    if(tot > avail) {
        document.getElementById('creditErrorText').innerText = `Credit limit exceeded! Available credit is only ₦${avail.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        errMsg.classList.remove('d-none');
        btn.disabled = true;
    } else {
        sucMsg.classList.remove('d-none');
        btn.disabled = false;
    }
}

window.finalizeSellerCheckout = async function () {
    const btn = document.getElementById('confirmCheckoutBtn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Processing...`;
    btn.disabled = true;

    const method = document.getElementById('paymentMethod').value;
    const cRcvd = Number(document.getElementById('cashReceivedCheckout').value) || 0;
    const refNum = document.getElementById('refNumberCheckout').value;
    const tot = window.sellerCheckoutTotal;
    const sub = window.sellerCheckoutSubtotal;
    
    let finalCId = null;
    let finalCName = "Walk-in";
    
    if(method === 'Credit Account') {
        finalCId = document.getElementById('creditCustomerCheckoutSelect').value;
        const cObj = customers.find(c => c.id === finalCId);
        if(cObj) finalCName = cObj.name;
    } else {
        const cInput = document.getElementById('cartCustomerInput').value.trim();
        finalCName = cInput || "Walk-in";
        const cObj = customers.find(x => x.name.toLowerCase() === finalCName.toLowerCase());
        if(cObj) finalCId = cObj.id;
    }

    const txnPayload = {
        refNo: sellerRefId,
        sellerName: currentUser.name,
        cashierName: currentUser.name + " (Direct)", 
        customerId: finalCId,
        customerName: finalCName,
        items: cart,
        subtotal: sub,
        discountPercent: 0,
        totalAmount: tot,
        paymentMethod: method,
        cashReceived: method === 'Cash' ? cRcvd : null,
        changeProvided: 0,
        referenceNumber: (method === 'Bank Transfer' || method === 'POS') ? refNum : null,
        date: new Date().toISOString()
    };

    try {
        await push(ref(db, 'transactionsRef'), txnPayload);

        if (method === 'Credit Account' && finalCId) {
            const custRef = `customersRef/${finalCId}`;
            const cSnap = await get(ref(db, custRef));
            if (cSnap.exists()) {
                const bal = Number(cSnap.val().balanceOwed) || 0;
                await update(ref(db, custRef), { balanceOwed: bal + tot });
                await push(ref(db, `${custRef}/transactions`), {
                    date: txnPayload.date,
                    type: "Purchase",
                    amount: tot,
                    ref: sellerRefId
                });
            }
        }

        bootstrap.Modal.getInstance(document.getElementById('sellerCheckoutModal')).hide();
        showAlert("Success", "Transaction completed successfully!", "success");
        cart = [];
        document.getElementById('cartCustomerInput').value = "";
        generateRefNo();
        renderCart();

    } catch (err) {
        console.error(err);
        showAlert("Error", "Validation/Transaction Failed", "danger");
    } finally {
        btn.innerHTML = `<i class="fas fa-check me-2"></i>Complete Sale`;
        btn.disabled = false;
    }
}
