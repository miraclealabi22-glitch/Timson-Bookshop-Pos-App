import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, onValue, push, update, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app);

// --- Global State ---
let currentUser = { name: "Admin", id: "" };
let allTransactions = [];
let allStock = {};
let allCustomers = [];
let selectedCustomer = null;
let selectedTxn = null;
let returnCart = [];
let purchaseHistory = {}; // Product ID -> { name, qtyPurchased, qtyReturned, lastPrice, cartonSize }

function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// --- Lifecycle ---
document.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    loadData();
    generateReturnRef();
    
    // UI Event Listeners
    const searchInput = document.getElementById('nypTransactionSearch');
    if(searchInput) {
        searchInput.addEventListener('input', handleTransactionSearch);
    }
    
    document.getElementById('catalogSearch').addEventListener('input', renderPurchasedCatalog);
    document.getElementById('saveReturnBtn').onclick = processReturn;
    document.getElementById('confirmAddBtn').onclick = confirmReturnAdd;
});

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : 'danger'} shadow-lg border-0 mb-2 animate__animated animate__fadeInRight`;
    toast.style.borderRadius = '12px';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            <strong>${message}</strong>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function setupAuth() {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser.name = user.displayName || user.email.split('@')[0];
            currentUser.id = user.uid;
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../timson-pos-login/index.html');
    });
}

function generateReturnRef() {
    const refId = 'RET-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    const el = document.getElementById('returnRefNoDisplay');
    if(el) el.textContent = refId;
}

function loadData() {
    // 1. Load Transactions for history calculation
    onValue(ref(db, 'transactionsRef'), snapshot => {
        const data = snapshot.val() || {};
        allTransactions = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        populateSearchDatalist();
        if(selectedTxn) calculateReturnableItems();
    });

    // 2. Load Stock for rendering
    onValue(ref(db, 'stockRef'), snapshot => {
        allStock = snapshot.val() || {};
    });

    // 3. Load Customers
    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        allCustomers = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    });
}

function populateSearchDatalist() {
    const datalist = document.getElementById('nypTxnDataList');
    if(!datalist) return;
    
    datalist.innerHTML = '';
    
    // Filter transactions that are NYP/Credit
    const nypTxns = allTransactions.filter(t => {
        const pm = (t.paymentMethod || '').toLowerCase();
        return pm.includes('credit') || t.paymentMethod === 'NYP' || (t.splitPayments && Number(t.splitPayments.credit) > 0);
    }).sort((a,b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp));
    
    nypTxns.forEach(t => {
        const option = document.createElement('option');
        const refNo = t.refNo || 'TXN';
        const customer = toTitleCase(t.customerName || 'Walk-in');
        const amount = (Number(t.totalAmount) || 0).toLocaleString();
        option.value = `${refNo} - ${customer}`;
        option.innerHTML = `Value: ₦${amount}`;
        datalist.appendChild(option);
    });
}

// --- Search Logic ---

function handleTransactionSearch(e) {
    const val = e.target.value.split(' - ')[0]; // Extract RefNo
    if(!val) return;
    
    const txn = allTransactions.find(t => t.refNo === val);
    if(!txn) return;
    
    selectedTxn = txn;
    selectedCustomer = allCustomers.find(c => c.id === txn.customerId || c.name === txn.customerName);
    
    // Update Balance Display
    if(selectedCustomer) {
        document.getElementById('displayBalance').textContent = `₦${(Number(selectedCustomer.balanceOwed) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    } else {
        document.getElementById('displayBalance').textContent = `₦0.00`;
    }
    
    calculateReturnableItems();
    returnCart = [];
    renderReturnCart();
}

function calculateReturnableItems() {
    if(!selectedTxn) return;
    
    purchaseHistory = {};
    
    // 1. Get items from THIS transaction
    (selectedTxn.items || []).forEach(item => {
        if(!purchaseHistory[item.id]) {
            purchaseHistory[item.id] = {
                id: item.id,
                name: item.name,
                purchased: 0,
                returned: 0,
                lastPrice: Number(item.price) || 0,
                cartonSize: Number(allStock[item.id]?.cartonSize || 1)
            };
        }
        
        let qtyInUnits = Number(item.qty) || 0;
        if(item.unitType === 'carton') qtyInUnits *= purchaseHistory[item.id].cartonSize;
        purchaseHistory[item.id].purchased += qtyInUnits;
    });
    
    // 2. Subtract already returned items for THIS transaction
    allTransactions.forEach(t => {
        if(t.paymentMethod === 'Stock Return' && t.originalRef === selectedTxn.refNo) {
            (t.items || []).forEach(item => {
                if(purchaseHistory[item.id]) {
                    let qtyInUnits = Number(item.returnQty || item.qty) || 0;
                    if(item.rateType === 'carton' || item.unitType === 'carton') qtyInUnits *= purchaseHistory[item.id].cartonSize;
                    purchaseHistory[item.id].returned += qtyInUnits;
                }
            });
        }
    });
    
    renderPurchasedCatalog();
}

function renderPurchasedCatalog() {
    const grid = document.getElementById('purchasedCatalogGrid');
    const searchTerm = document.getElementById('catalogSearch').value.toLowerCase();
    
    if(!selectedTxn) return;
    
    grid.innerHTML = '';
    
    const items = Object.values(purchaseHistory).filter(item => {
        const netQty = item.purchased - item.returned;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm);
        return netQty > 0 && matchesSearch;
    });
    
    if(items.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><h5>No returnable items in this transaction.</h5><p class="small">Either the transaction has no items or all have been returned.</p></div>';
        return;
    }
    
    items.forEach(item => {
        const netQty = item.purchased - item.returned;
        const col = document.createElement('div');
        col.className = 'col-md-6 col-xl-4';
        col.innerHTML = `
            <div class="card h-100 shadow-sm border-0 product-card animate__animated animate__fadeInUp" 
                 onclick="openReturnModal('${item.id}')" style="cursor: pointer; border-radius: 15px; overflow: hidden; transition: transform 0.2s;">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 35px; height: 35px;">
                            <i class="fas fa-history"></i>
                        </div>
                        <span class="badge bg-success bg-opacity-10 text-success border border-success rounded-pill">${netQty} Units Left</span>
                    </div>
                    <h6 class="fw-bold mb-1 text-dark text-truncate">${toTitleCase(item.name)}</h6>
                    <small class="text-muted d-block mb-3">Ref: ${selectedTxn.refNo}</small>
                    <div class="d-flex justify-content-between align-items-center mt-auto">
                        <div class="fw-bold text-primary">₦${item.lastPrice.toLocaleString()}</div>
                        <button class="btn btn-sm btn-outline-primary rounded-pill px-3">Return Item</button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

// --- Cart Management ---

window.openReturnModal = function(itemId) {
    const item = purchaseHistory[itemId];
    if(!item) return;
    
    document.getElementById('modalItemId').value = itemId;
    document.getElementById('modalItemName').textContent = `Return: ${toTitleCase(item.name)}`;
    
    const netQty = item.purchased - item.returned;
    document.getElementById('modalMaxQty').textContent = netQty;
    document.getElementById('modalQty').value = 1;
    document.getElementById('modalQty').max = netQty;
    
    const modalEl = document.getElementById('returnQtyModal');
    new bootstrap.Modal(modalEl).show();
}

function confirmReturnAdd() {
    const id = document.getElementById('modalItemId').value;
    const uType = document.getElementById('modalUnitType').value;
    const qty = Number(document.getElementById('modalQty').value);
    
    const item = purchaseHistory[id];
    const netQty = item.purchased - item.returned;
    
    let requestedUnits = qty;
    if(uType === 'carton') requestedUnits *= item.cartonSize;
    
    if(requestedUnits > netQty) {
        alert("You cannot return more than what was purchased in this transaction!");
        return;
    }
    
    // Check if already in cart
    const existing = returnCart.find(c => c.id === id && c.unitType === uType);
    if(existing) {
        if((existing.qty + qty) * (uType === 'carton' ? item.cartonSize : 1) > netQty) {
            alert("Cart total exceeds purchased quantity for this transaction!");
            return;
        }
        existing.qty += qty;
    } else {
        returnCart.push({
            id: id,
            name: item.name,
            qty: qty,
            unitType: uType,
            price: item.lastPrice,
            cartonSize: item.cartonSize,
            maxUnits: netQty
        });
    }
    
    const modalEl = document.getElementById('returnQtyModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    
    renderReturnCart();
}

function renderReturnCart() {
    const list = document.getElementById('cartList');
    const emptyMsg = document.getElementById('emptyCartMsg');
    const badge = document.getElementById('cartCountBadge');
    const totalEl = document.getElementById('totalReturnAmount');
    const saveBtn = document.getElementById('saveReturnBtn');
    
    list.innerHTML = '';
    
    if(returnCart.length === 0) {
        emptyMsg.classList.remove('d-none');
        badge.textContent = '0 Items';
        totalEl.textContent = '₦0.00';
        saveBtn.disabled = true;
        return;
    }
    
    emptyMsg.classList.add('d-none');
    saveBtn.disabled = false;
    
    let totalValue = 0;
    
    returnCart.forEach((item, index) => {
        const unitPrice = item.price;
        const rowTotal = item.qty * (item.unitType === 'carton' ? unitPrice * item.cartonSize : unitPrice);
        totalValue += rowTotal;
        
        const row = document.createElement('div');
        row.className = 'p-3 bg-white border border-light shadow-sm rounded-3 animate__animated animate__fadeInRight';
        row.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0 fw-bold">${toTitleCase(item.name)}</h6>
                    <small class="text-muted">${item.qty} ${item.unitType}(s) @ ₦${unitPrice.toLocaleString()}</small>
                </div>
                <div class="text-end">
                    <div class="fw-bold text-primary">₦${rowTotal.toLocaleString()}</div>
                    <button class="btn btn-sm text-danger p-0 mt-1" onclick="removeFromReturnCart(${index})">
                        <i class="fas fa-times-circle"></i> Remove
                    </button>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
    
    badge.textContent = `${returnCart.length} Item(s)`;
    totalEl.textContent = `₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

window.removeFromReturnCart = function(index) {
    returnCart.splice(index, 1);
    renderReturnCart();
}

async function processReturn() {
    if(!selectedTxn || returnCart.length === 0) return;
    if(!selectedCustomer) {
        // Fallback or alert
        alert("Linked customer account not found. Please verify the transaction details.");
        return;
    }
    
    const totalReturnVal = returnCart.reduce((sum, item) => {
        const unitPrice = item.price;
        return sum + (item.qty * (item.unitType === 'carton' ? unitPrice * item.cartonSize : unitPrice));
    }, 0);
    
    const confirmed = confirm(
        `--- CONFIRM RECONCILIATION ---\n\n` +
        `Ref No: ${selectedTxn.refNo}\n` +
        `Customer: ${selectedCustomer.name}\n` +
        `Total Return Value: ₦${totalReturnVal.toLocaleString()}\n\n` +
        `Finalize return? This will reduce the customer's debt.`
    );
    
    if(!confirmed) return;
    
    const btn = document.getElementById('saveReturnBtn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-2"></i> Processing...';
    btn.disabled = true;
    
    try {
        const returnRef = document.getElementById('returnRefNoDisplay').textContent;
        const timestamp = new Date().toISOString();
        
        // 1. Update Stock
        const logItems = [];
        for (const item of returnCart) {
            const stockItem = allStock[item.id];
            if (stockItem) {
                const increaseUnits = item.unitType === 'carton' ? (item.qty * item.cartonSize) : item.qty;
                const newQty = (Number(stockItem.StockQuantity) || 0) + increaseUnits;
                await update(ref(db, `stockRef/${item.id}`), { StockQuantity: newQty });
            }
            logItems.push({
                id: item.id,
                name: item.name,
                qty: item.qty,
                unitType: item.unitType,
                price: item.price,
                total: item.qty * (item.unitType === 'carton' ? item.price * item.cartonSize : item.price)
            });
        }
        
        // 2. Update Customer Balance
        const newBal = Math.max(0, (Number(selectedCustomer.balanceOwed) || 0) - totalReturnVal);
        await update(ref(db, `customersRef/${selectedCustomer.id}`), { balanceOwed: newBal });
        
        // 3. Log to Customer History
        await push(ref(db, `customersRef/${selectedCustomer.id}/transactions`), {
            date: timestamp,
            type: "Stock Return",
            amount: totalReturnVal,
            ref: returnRef,
            details: `Returned items from transaction ${selectedTxn.refNo}`
        });
        
        // 4. Record Global Transaction
        await push(ref(db, 'transactionsRef'), {
            refNo: returnRef,
            originalRef: selectedTxn.refNo,
            date: timestamp,
            cashierName: currentUser.name,
            customerName: selectedCustomer.name,
            customerId: selectedCustomer.id,
            totalAmount: -totalReturnVal,
            paymentMethod: "Stock Return",
            items: logItems
        });
        
        showToast("Reconciliation Successful!");
        setTimeout(() => location.reload(), 2000);
        
    } catch (err) {
        console.error(err);
        showToast("Error processing reconciliation.", "error");
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
