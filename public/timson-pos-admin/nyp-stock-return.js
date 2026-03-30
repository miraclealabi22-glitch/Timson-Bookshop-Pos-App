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

let currentUser = { name: "Admin", id: "" };
let transactions = [];
let stock = {};
let customers = [];
let selectedTxn = null;

function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    loadData();
    generateReturnRef();
    
    const today = new Date();
    document.getElementById('returnDate').value = today.toISOString().split('T')[0];
    updateDateBoxes(today);
    
    document.getElementById('returnDate').addEventListener('change', (e) => {
        updateDateBoxes(new Date(e.target.value));
    });
    document.getElementById('nypIdSelect').addEventListener('change', handleTxnSelection);
    document.getElementById('returnForm').addEventListener('submit', processReturn);
    document.getElementById('sidebarCollapse')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });
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

function updateDateBoxes(date) {
    if (isNaN(date.getTime())) return;
    document.getElementById('yearBox').value = date.getFullYear();
    document.getElementById('monthBox').value = date.toLocaleString('default', { month: 'long' });
}

function setupAuth() {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser.name = user.displayName || user.email.split('@')[0];
            currentUser.id = user.uid;
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userInitials').textContent = currentUser.name.charAt(0).toUpperCase();
            document.getElementById('staffName').value = currentUser.name;
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../timson-pos-login/index.html');
    });
}

function generateReturnRef() {
    const refId = 'CR-' + Math.random().toString(36).substr(2, 4).toLowerCase();
    document.getElementById('returnRefNo').value = refId;
}

function loadData() {
    onValue(ref(db, 'transactionsRef'), snapshot => {
        const data = snapshot.val() || {};
        transactions = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .filter(t => {
                const pm = (t.paymentMethod || '').toLowerCase();
                const hasCredit = pm.includes('credit') || t.paymentMethod === 'NYP' || (t.splitPayments && Number(t.splitPayments.credit) > 0);
                return hasCredit;
            });
        populateTxnDropdown();
    });

    onValue(ref(db, 'stockRef'), snapshot => {
        stock = snapshot.val() || {};
        if (selectedTxn) handleTxnSelection(); // Refresh if open
    });

    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        customers = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    });
}

function populateTxnDropdown() {
    const select = document.getElementById('nypIdSelect');
    const currentVal = select.value;
    select.innerHTML = '<option value="" selected disabled>Select NYP...</option>';
    
    transactions.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = `${t.refNo} - ${toTitleCase(t.customerName)}`;
        select.appendChild(option);
    });
    
    if (currentVal) select.value = currentVal;
}

const getStockBalanceDisplay = (item) => {
    const cartonSize = Number(item.cartonSize || 0);
    const totalUnits = (Number(item.StockQuantity || 0));

    if (cartonSize > 1) {
        const fullCartons = Math.floor(totalUnits / cartonSize);
        const remainder = totalUnits % cartonSize;
        return `${fullCartons} CTN & ${remainder}`;
    }
    return `0 CTN & ${totalUnits}`;
};

function handleTxnSelection() {
    const txnId = document.getElementById('nypIdSelect').value;
    if (!txnId) return;
    
    selectedTxn = transactions.find(t => t.id === txnId);
    if (!selectedTxn) return;

    // Show Customer Pulse
    const customer = customers.find(c => c.id === selectedTxn.customerId);
    const panel = document.getElementById('customerInfoPanel');
    panel.classList.remove('d-none');
    panel.classList.add('d-flex');
    
    document.getElementById('displayCustomer').textContent = toTitleCase(selectedTxn.customerName);
    document.getElementById('displayBalance').textContent = `₦${(Number(customer?.balanceOwed) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Populate Modern Table
    const tbody = document.getElementById('returnTableBody');
    tbody.innerHTML = '';
    
    (selectedTxn.items || []).forEach((item, index) => {
        const stockItem = stock[item.id] || {};
        const cSize = Number(stockItem.cartonSize || 1);
        const row = document.createElement('tr');
        row.style.animation = `fadeInUp 0.4s ease forwards ${index * 0.05}s`;
        row.style.opacity = '0';
        
        row.innerHTML = `
            <td class="row-num">${index + 1}</td>
            <td><span class="stock-balance-chip">${getStockBalanceDisplay(stockItem)}</span></td>
            <td class="fw-600">${toTitleCase(item.name)}</td>
            <td>
                <input type="number" class="form-control form-control-sm form-control-modern return-qty" 
                    min="0" max="${item.qty}" data-index="${index}" value="0">
            </td>
            <td class="text-center font-monospace">${cSize}</td>
            <td>
                <select class="form-select form-select-sm form-control-modern price-rate" data-index="${index}">
                    <option value="unit">Unit (₦${Number(item.price).toLocaleString()})</option>
                    <option value="carton">Ctn (₦${(Number(item.price) * cSize).toLocaleString()})</option>
                </select>
            </td>
            <td><span class="price-chip">₦</span><span class="price-chip item-total">0.00</span></td>
            <td>
                <input type="number" class="form-control form-control-sm form-control-modern row-discount" 
                    data-index="${index}" value="0" min="0">
            </td>
        `;
        tbody.appendChild(row);
    });

    // Listeners
    document.querySelectorAll('.return-qty, .price-rate, .row-discount').forEach(el => {
        el.addEventListener('input', calculateRowTotal);
    });

    document.getElementById('saveReturnBtn').disabled = false;
}

function calculateRowTotal(e) {
    const row = e.target.closest('tr');
    const index = e.target.dataset.index;
    const item = selectedTxn.items[index];
    const stockItem = stock[item.id] || {};
    const cSize = Number(stockItem.cartonSize || 1);
    
    const qtyInput = row.querySelector('.return-qty');
    const qty = Number(qtyInput.value) || 0;
    const rateType = row.querySelector('.price-rate').value;
    const discount = Number(row.querySelector('.row-discount').value) || 0;
    
    const basePrice = Number(item.price) || 0;
    const pricePerSelectedUnit = rateType === 'carton' ? (basePrice * cSize) : basePrice;
    
    const subtotal = Math.max(0, (qty * pricePerSelectedUnit) - discount);
    row.querySelector('.item-total').textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

async function processReturn(e) {
    e.preventDefault();
    if (!selectedTxn) return;
    
    const btn = document.getElementById('saveReturnBtn');
    const originalContent = btn.innerHTML;

    // Calculate total return summary for confirmation
    let confirmItemsSummary = "";
    let confirmTotalReturn = 0;
    const rows = document.querySelectorAll('#returnTableBody tr');
    rows.forEach(row => {
        const qty = Number(row.querySelector('.return-qty')?.value) || 0;
        if (qty > 0) {
            const index = row.querySelector('.return-qty').dataset.index;
            const item = selectedTxn.items[index];
            const stockItem = stock[item.id];
            const rateType = row.querySelector('.price-rate').value;
            const discount = Number(row.querySelector('.row-discount').value) || 0;
            const cSize = Number(stockItem?.cartonSize || 1);
            const unitPrice = Number(item.price);
            const rowTotal = (qty * (rateType === 'carton' ? unitPrice * cSize : unitPrice)) - discount;
            
            confirmTotalReturn += rowTotal;
            confirmItemsSummary += `- ${item.name}: ${qty} ${rateType}(s) [₦${rowTotal.toLocaleString()}]\n`;
        }
    });

    if (confirmTotalReturn === 0) {
        showToast("Please select at least one item to return", "error");
        return;
    }

    const confirmed = confirm(
        "--- CONFIRM RECONCILIATION ---\n\n" +
        `Customer: ${selectedTxn.customerName}\n` +
        `Total Return Value: ₦${confirmTotalReturn.toLocaleString()}\n\n` +
        "Items to be returned to stock:\n" +
        confirmItemsSummary + "\n" +
        "Are you sure you want to process this reconciliation? This will update stock levels and reduce the customer's debt."
    );

    if (!confirmed) return;

    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-2"></i> processing reconciliation...';
    btn.disabled = true;

    try {
        const returnRef = document.getElementById('returnRefNo').value;
        const returnItems = [];
        let totalReturnVal = 0;

        const rows = document.querySelectorAll('#returnTableBody tr');
        for (let row of rows) {
            const qtyInput = row.querySelector('.return-qty');
            if (!qtyInput) continue;
            
            const qty = Number(qtyInput.value) || 0;
            if (qty > 0) {
                const index = qtyInput.dataset.index;
                const item = selectedTxn.items[index];
                const stockItem = stock[item.id];
                const rateType = row.querySelector('.price-rate').value;
                const discount = Number(row.querySelector('.row-discount').value) || 0;
                
                const cSize = Number(stockItem?.cartonSize || 1);
                const unitPrice = Number(item.price);
                const rowTotal = (qty * (rateType === 'carton' ? unitPrice * cSize : unitPrice)) - discount;
                
                totalReturnVal += rowTotal;
                returnItems.push({ ...item, returnQty: qty, rateType, discount, rowTotal });

                if (stockItem) {
                    let actualIncrease = rateType === 'carton' ? (qty * cSize) : qty;
                    const newTotalUnits = (Number(stockItem.StockQuantity) || 0) + actualIncrease;
                    await update(ref(db, `stockRef/${item.id}`), { StockQuantity: newTotalUnits });
                }
            }
        }

        if (returnItems.length === 0) {
            showToast("Please select at least one item to return", "error");
            btn.innerHTML = originalContent;
            btn.disabled = false;
            return;
        }

        // Update Customer Ledger
        const customerRef = ref(db, `customersRef/${selectedTxn.customerId}`);
        const customerSnap = await get(customerRef);
        if (customerSnap.exists()) {
            const currentBal = Number(customerSnap.val().balanceOwed) || 0;
            const newBal = Math.max(0, currentBal - totalReturnVal);
            await update(customerRef, { balanceOwed: newBal });
            
            await push(ref(db, `customersRef/${selectedTxn.customerId}/transactions`), {
                date: new Date().toISOString(),
                type: "Stock Return",
                amount: totalReturnVal,
                ref: returnRef,
                details: `Stock return for transaction ${selectedTxn.refNo}`
            });
        }

        // Log Global Reconciliation
        await push(ref(db, 'transactionsRef'), {
            refNo: returnRef,
            originalRef: selectedTxn.refNo,
            cashierName: currentUser.name,
            customerName: selectedTxn.customerName,
            customerId: selectedTxn.customerId,
            totalAmount: -totalReturnVal,
            paymentMethod: "Stock Return",
            items: returnItems,
            date: new Date().toISOString()
        });

        showToast("Reconciliation Successful! Records Updated.");
        setTimeout(() => location.reload(), 2000);

    } catch (err) {
        console.error(err);
        showToast("System error during reconciliation. Please check connectivity.", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
