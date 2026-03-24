import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, update, push, remove, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

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
let currentUser = { name: "Cashier", id: null };
let customers = [];
let pendingOrders = [];
let selectedOrder = null;
let cashierRefId = "";

// Report Data
let transactionsData = [];
let accountingData = [];

// --- Lifecycle ---
document.addEventListener("DOMContentLoaded", () => {
    startClock();
    setupAuthListeners();
    generateRefNo();
});

// --- UI / Util Setup ---
function startClock() {
    setInterval(() => {
        const n = new Date();
        const clockEl = document.getElementById('clock');
        const dateEl = document.getElementById('date');
        if (clockEl) clockEl.innerText = n.toLocaleTimeString();
        if (dateEl) dateEl.innerText = n.toLocaleDateString();
    }, 1000);
}

function generateRefNo() {
    cashierRefId = 'CASH-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    const dipRef = document.getElementById('displayRefNo');
    if (dipRef) dipRef.innerText = cashierRefId;
}

function setupAuthListeners() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            console.warn("No firebase user found. Using test user.");
            currentUser.name = "Test Cashier";
            currentUser.id = "test-cashier-id";
        } else {
            currentUser.name = user.displayName || user.email || 'Cashier';
            currentUser.id = user.uid;
        }

        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) userNameDisplay.textContent = currentUser.name;

        const pic = document.getElementById('profilePics');
        if (pic) pic.innerHTML = currentUser.name.charAt(0);

        loadDataSubscriptions();
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => window.location.href = '../timson-pos-login/index.html');
        });
    }
}

function loadDataSubscriptions() {
    // 1. Pending Orders
    onValue(ref(db, 'pendingOrdersRef'), snapshot => {
        const data = snapshot.val() || {};
        pendingOrders = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        // Sort by timestamp newest first
        pendingOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderPendingOrders();
    });

    // 2. Customers
    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        customers = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        populateCustomerList();
        renderDebtorsReport();
    });

    // 3. Transactions & Accounting (for reports)
    onValue(ref(db, 'transactionsRef'), snapshot => {
        const data = snapshot.val() || {};
        transactionsData = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        renderDailyReport();
    });

    onValue(ref(db, 'cashFlowRef'), snapshot => {
        const data = snapshot.val() || {};
        const expenses = data.expenses || {};
        const bank = data.bank || {};
        const excess = data.excess || {};

        accountingData = [];
        Object.entries(expenses).forEach(([k, v]) => accountingData.push({ id: k, type: 'Expense', ...v }));
        Object.entries(bank).forEach(([k, v]) => accountingData.push({ id: k, type: 'BankLodgement', ...v }));
        Object.entries(excess).forEach(([k, v]) => accountingData.push({ id: k, type: 'ExcessCash', ...v }));
        renderDailyReport();
    });
}

function populateCustomerList() {
    const nypSel = document.getElementById('nypCustomer');
    if (nypSel) {
        nypSel.innerHTML = '<option value="" disabled selected>Select Customer...</option>';
        customers.forEach(c => {
            if ((Number(c.balanceOwed) || 0) > 0) {
                nypSel.innerHTML += `<option value="${c.id}">${c.name} (Debt: ₦${(Number(c.balanceOwed)).toLocaleString()})</option>`;
            }
        });
    }
}

// --- Pending Orders Workflow (Cashier processing) ---
function renderPendingOrders() {
    const list = document.getElementById('pendingOrdersList');
    const badge = document.getElementById('pendingCountBadge');

    if (!list) return;
    badge.innerText = pendingOrders.length;

    if (pendingOrders.length === 0) {
        list.innerHTML = `
            <div class="text-center py-5 text-muted border rounded bg-light">
                <i class="fas fa-box-open fa-2x mb-2"></i>
                <p class="mb-0">No pending orders available.</p>
            </div>
        `;
        // If the selected order was deleted externally, clear right view
        if (selectedOrder && !pendingOrders.find(o => o.id === selectedOrder.id)) {
            clearSelectedOrder();
        }
        return;
    }

    list.innerHTML = '';
    pendingOrders.forEach(o => {
        const activeClass = selectedOrder && selectedOrder.id === o.id ? 'active' : '';
        const t = new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const btn = document.createElement('button');
        btn.className = `list-group-item list-group-item-action d-flex justify-content-between align-items-center ${activeClass}`;
        btn.onclick = () => window.selectOrder(o.id);

        btn.innerHTML = `
            <div>
                <h6 class="mb-0 fw-bold">${o.customerName || 'Walk-in'}</h6>
                <small class="text-muted"><i class="fas fa-user-tag me-1"></i>${o.sellerName || 'Unknown Seller'}</small>
            </div>
            <div class="text-end">
                <span class="fw-bold text-primary d-block">₦${Number(o.totalDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <small class="text-muted" style="font-size: 0.75rem;">${t}</small>
            </div>
        `;
        list.appendChild(btn);
    });
}

window.selectOrder = function (orderId) {
    selectedOrder = pendingOrders.find(o => o.id === orderId);
    renderPendingOrders(); // visually update active state
    renderSelectedOrderDetails();
}

function clearSelectedOrder() {
    selectedOrder = null;
    renderSelectedOrderDetails();
}

function renderSelectedOrderDetails() {
    const tbody = document.getElementById('selectedOrderItemsBody');
    const custSpan = document.getElementById('selectedOrderCustomer');
    const selSpan = document.getElementById('selectedOrderSeller');
    const tSpan = document.getElementById('selectedOrderTime');

    const subTot = document.getElementById('selectedOrderSubtotal');
    const disc = document.getElementById('selectedOrderDiscount');
    const gTot = document.getElementById('selectedOrderTotalDue');
    const btn = document.getElementById('processOrderBtn');

    if (!selectedOrder) {
        custSpan.innerText = 'Customer: ---';
        selSpan.innerText = 'Seller: ---';
        tSpan.innerText = '--:--';
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted py-5 text-center">Select an order from the list <-</td></tr>';
        subTot.innerText = '₦0.00';
        disc.innerText = '0%';
        gTot.innerText = '₦0.00';
        btn.disabled = true;
        return;
    }

    custSpan.innerText = `Customer: ${selectedOrder.customerName || 'Walk-in'}`;
    selSpan.innerText = `Seller: ${selectedOrder.sellerName || 'Unknown'}`;
    tSpan.innerText = new Date(selectedOrder.timestamp).toLocaleTimeString();

    tbody.innerHTML = '';
    (selectedOrder.items || []).forEach(item => {
        const itemTotal = Number(item.price || 0) * Number(item.qty || 0);
        tbody.innerHTML += `
            <tr>
                <td class="text-start fw-bold text-muted">${item.name}</td>
                <td>${item.qty} ${item.unitType || 'unit'}</td>
                <td class="text-end">₦${Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="text-end fw-bold">₦${itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    subTot.innerText = `₦${Number(selectedOrder.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    disc.innerText = `${selectedOrder.discountPercent || 0}%`;
    gTot.innerText = `₦${Number(selectedOrder.totalDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    btn.disabled = false;
}

// --- Checkout Modal & Flow ---
window.openCheckoutModal = function () {
    if (!selectedOrder) return;

    document.getElementById('checkoutTotalDue').innerText = `Amount Due: ₦${Number(selectedOrder.totalDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Reset inputs
    const pMethod = document.getElementById('paymentMethod');
    pMethod.value = "";
    document.getElementById('cashReceivedCheckout').value = "";
    document.getElementById('changeDueCheckout').value = "";
    document.getElementById('refNumberCheckout').value = "";

    // Disable Credit if walkin
    const crOpt = document.getElementById('optCreditAcc');
    const crWarn = document.getElementById('creditWarnCheckout');
    if (!selectedOrder.customerId) {
        crOpt.disabled = true;
        crWarn.classList.remove('d-none');
    } else {
        crOpt.disabled = false;
        crWarn.classList.add('d-none');
    }

    toggleCheckoutFields();
    new bootstrap.Modal(document.getElementById('checkoutModal')).show();
}

window.toggleCheckoutFields = function () {
    const m = document.getElementById('paymentMethod').value;
    const cFields = document.getElementById('cashFieldsCheckout');
    const rFields = document.getElementById('refFieldsCheckout');
    const btn = document.getElementById('confirmCheckoutBtn');

    cFields.classList.add('d-none');
    rFields.classList.add('d-none');
    btn.disabled = true;

    if (m === 'Cash') {
        cFields.classList.remove('d-none');
        calculateChangeCheckout(); // re-eval button
    } else if (m === 'POS' || m === 'Bank Transfer') {
        rFields.classList.remove('d-none');
        document.getElementById('refLabelCheckout').innerText = m === 'POS' ? 'POS Slip Number' : 'Bank Reference Number';
        btn.disabled = false;
    } else if (m === 'Credit Account') {
        if (selectedOrder.customerId) btn.disabled = false;
    }
}

window.calculateChangeCheckout = function () {
    const rcvd = Number(document.getElementById('cashReceivedCheckout').value) || 0;
    const chgEl = document.getElementById('changeDueCheckout');
    const btn = document.getElementById('confirmCheckoutBtn');
    const tot = Number(selectedOrder.totalDue);

    if (rcvd >= tot) {
        chgEl.value = `₦${(rcvd - tot).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        chgEl.className = "form-control form-control-lg bg-white text-success fw-bold";
        btn.disabled = false;
    } else {
        chgEl.value = `Short ₦${(tot - rcvd).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        chgEl.className = "form-control form-control-lg bg-white text-danger fw-bold";
        btn.disabled = true;
    }
}

window.finalizeCheckout = async function () {
    const btn = document.getElementById('confirmCheckoutBtn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Processing...`;
    btn.disabled = true;

    const method = document.getElementById('paymentMethod').value;
    const cRcvd = Number(document.getElementById('cashReceivedCheckout').value) || 0;
    const refNum = document.getElementById('refNumberCheckout').value;
    const tot = Number(selectedOrder.totalDue);

    const txnPayload = {
        refNo: cashierRefId,
        sellerName: selectedOrder.sellerName, // Keep original seller credit
        cashierName: currentUser.name,        // Log who processed it
        customerId: selectedOrder.customerId || null,
        customerName: selectedOrder.customerName || 'Walk-in',
        items: selectedOrder.items,
        subtotal: selectedOrder.subtotal,
        discountPercent: selectedOrder.discountPercent,
        totalAmount: tot,
        paymentMethod: method,
        cashReceived: method === 'Cash' ? cRcvd : null,
        changeProvided: method === 'Cash' ? Math.max(0, cRcvd - tot) : 0,
        referenceNumber: (method === 'Bank Transfer' || method === 'POS') ? refNum : null,
        date: new Date().toISOString()
    };

    try {
        // 1. Save definitive Transaction
        await push(ref(db, 'transactionsRef'), txnPayload);

        // 2. Reduce Stock (Assuming Seller didn't reduce immediately for pending)
        for (let item of selectedOrder.items || []) {
            const stockRefStr = `stockRef/${item.id}`; // seller logic maps product id to item.id
            const sSnap = await get(ref(db, stockRefStr));
            if (sSnap.exists()) {
                const currentStock = Number(sSnap.val().StockQuantity) || 0;
                // Since this might not have standard equivalent units built internally yet, default to direct qty deduction based on base units
                await update(ref(db, stockRefStr), {
                    StockQuantity: Math.max(0, currentStock - item.qty)
                });
            }
        }

        // 3. Customer Credit logic
        if (method === 'Credit Account' && selectedOrder.customerId) {
            const custRef = `customersRef/${selectedOrder.customerId}`;
            const cSnap = await get(ref(db, custRef));
            if (cSnap.exists()) {
                const bal = Number(cSnap.val().balanceOwed) || 0;
                await update(ref(db, custRef), { balanceOwed: bal + tot });
                await push(ref(db, `${custRef}/transactions`), {
                    date: txnPayload.date,
                    type: "Purchase",
                    amount: tot,
                    ref: cashierRefId
                });
            }
        }

        // 4. Remove from Pending limit
        await remove(ref(db, `pendingOrdersRef/${selectedOrder.id}`));

        bootstrap.Modal.getInstance(document.getElementById('checkoutModal')).hide();
        printReceipt(txnPayload);

        // Reset 
        clearSelectedOrder();
        generateRefNo();

    } catch (err) {
        console.error(err);
        alert("Transaction failed! Check console.");
    } finally {
        btn.innerHTML = `<i class="fas fa-check me-2"></i>Confirm`;
        btn.disabled = false;
    }
}

// ... Rest of the modals (NYP, Daily Report, etc. remains the same)
// --- NYP Payment (Credit Payment Collection) ---
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

document.getElementById('nypForm').addEventListener('submit', async (e) => {
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

            // Log as NYP Payment transaction to master transactions
            await push(ref(db, 'transactionsRef'), {
                refNo: 'NYP-' + Date.now().toString().slice(-6),
                cashierName: currentUser.name,
                customerId: cId,
                customerName: cObj.name,
                totalAmount: amt,
                paymentMethod: "NYP Debt Payment",
                date: new Date().toISOString()
            });

            alert("NYP Payment processed successfully!");
            bootstrap.Modal.getInstance(document.getElementById('nypModal')).hide();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to process payment.");
    } finally {
        btn.innerHTML = "Process NYP Payment";
        btn.disabled = false;
    }
});


// --- General Accounting (Expenses, Lodgement, Excess Cash) ---
let currentAccType = "";
window.openAccountingModal = function (type) {
    currentAccType = type;
    document.getElementById('accType').value = type;
    document.getElementById('accAmount').value = "";
    document.getElementById('accNote').value = "";

    let title = "Log Entry";
    if (type === 'Expense') title = "Register Business Expense";
    else if (type === 'BankLodgement') title = "Register Bank Lodgement";
    else if (type === 'ExcessCash') title = "Register Excess Cash";

    document.getElementById('accModalTitle').innerText = title;
    new bootstrap.Modal(document.getElementById('accountingModal')).show();
}

document.getElementById('accForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('accType').value;
    const amt = Number(document.getElementById('accAmount').value) || 0;
    const note = document.getElementById('accNote').value;

    let targetRef = "cashFlowRef/unknown";
    if (type === 'Expense') targetRef = "expensesRef";
    else if (type === 'BankLodgement') targetRef = "cashFlowRef/bank";
    else if (type === 'ExcessCash') targetRef = "cashFlowRef/excess";

    try {
        await push(ref(db, targetRef), {
            amount: amt,
            reason: note,
            cashierName: currentUser.name,
            date: new Date().toISOString(),
            type: type
        });
        alert("Entry successfully recorded!");
        bootstrap.Modal.getInstance(document.getElementById('accountingModal')).hide();
    } catch (err) {
        console.error(err);
        alert("Failed to record entry.");
    }
});

// --- Reports ---
document.getElementById('dailyReportDate').addEventListener('change', renderDailyReport);

function renderDailyReport() {
    const rContainer = document.getElementById('dailyReportContainer');
    if (!rContainer) return;

    let targetDate = document.getElementById('dailyReportDate').value;
    if (!targetDate) {
        targetDate = new Date().toISOString().split('T')[0];
        document.getElementById('dailyReportDate').value = targetDate;
    }

    let tSales = 0, tExpenses = 0, tNypCol = 0, tBank = 0, tExcess = 0;

    transactionsData.forEach(t => {
        if ((t.date || t.timestamp || '').split('T')[0] === targetDate) {
            if (t.paymentMethod === "NYP Debt Payment") tNypCol += (Number(t.totalAmount) || 0);
            else if (t.paymentMethod !== "Credit Account") tSales += (Number(t.totalAmount) || 0);
        }
    });

    accountingData.forEach(a => {
        if ((a.date || '').split('T')[0] === targetDate) {
            if (a.type === 'Expense') tExpenses += (Number(a.amount) || 0);
            if (a.type === 'BankLodgement') tBank += (Number(a.amount) || 0);
            if (a.type === 'ExcessCash') tExcess += (Number(a.amount) || 0);
        }
    });

    const finalBal = (tSales + tNypCol + tExcess) - (tExpenses + tBank);

    rContainer.innerHTML = `
        <div class="row g-4">
            <div class="col-md-4">
                <div class="card shadow-sm border-0 border-start border-primary border-4">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Total Sales Paid</h6>
                        <h3 class="fw-bold mb-0">₦${tSales.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card shadow-sm border-0 border-start border-info border-4">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Credit (NYP) Collected</h6>
                        <h3 class="fw-bold mb-0">₦${tNypCol.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card shadow-sm border-0 border-start border-success border-4">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Excess Cash In</h6>
                        <h3 class="fw-bold mb-0">₦${tExcess.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow-sm border-0 border-start border-danger border-4">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Expenses</h6>
                        <h3 class="fw-bold mb-0 text-danger">-₦${tExpenses.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow-sm border-0 border-start border-secondary border-4">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Bank Lodgement</h6>
                        <h3 class="fw-bold mb-0 text-danger">-₦${tBank.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-12 mt-4">
                <div class="card shadow border-0 bg-primary text-white">
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <h4 class="fw-bold mb-0">Final Till Balance</h4>
                        <h2 class="fw-bold mb-0">₦${finalBal.toLocaleString()}</h2>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDebtorsReport() {
    const tbody = document.getElementById('debtorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const debtors = customers.filter(c => (Number(c.balanceOwed) || 0) > 0);

    if (debtors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-muted">No outstanding debtors.</td></tr>';
        return;
    }

    debtors.sort((a, b) => (Number(b.balanceOwed) || 0) - (Number(a.balanceOwed) || 0));

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

// --- Receipt Generation ---
function printReceipt(txn) {
    const w = window.open('', '_blank', 'width=350,height=800');
    if (!w) return;

    let itemsHtml = '';

    (txn.items || []).forEach(i => {
        itemsHtml += `
            <tr class="item-row">
                <td colspan="4" style="text-align: left; padding-top: 5px;"><strong>${i.name} (${i.unitType || 'unit'})</strong></td>
            </tr>
            <tr class="item-row">
                <td>${i.qty}</td>
                <td style="text-align: right;">₦${Number(i.price || i.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right;"><strong>₦${((Number(i.price || i.unitPrice || 0)) * (Number(i.qty || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
            </tr>
        `;
    });

    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt - TimsonBookshop</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 20px 10px; color: #000; font-size: 13px; }
                .receipt-container { width: 100%; max-width: 300px; margin: 0 auto; text-align: center; }
                .header h2 { margin: 0 0 5px 0; font-size: 20px; font-weight: bold; }
                .header p { margin: 0; font-size: 12px; line-height: 1.4; }
                .meta { text-align: left; font-size: 11px; margin-top: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .meta-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th { text-align: right; padding-bottom: 5px; border-bottom: 1px solid #000; font-weight: bold; }
                th:first-child { text-align: left; }
                .item-row td { padding: 3px 0; vertical-align: top; }
                .totals { margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px; text-align: left; font-size: 12px; }
                .totals-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .grand-total { font-weight: bold; font-size: 15px; margin-top: 8px; border-top: 1px solid #000; padding-top: 8px; }
                .divider { border-top: 1px dashed #000; margin: 15px 0; }
                .footer { text-align: center; font-size: 11px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="header">
                    <h2>TIMSON BOOKSHOP</h2>
                    <p>CASHIER MODULE COPY</p>
                    <p>Tel: +234 800 123 4567</p>
                </div>
                
                <div class="meta">
                    <div class="meta-row"><span>Date:</span> <span>${new Date(txn.date).toLocaleString()}</span></div>
                    <div class="meta-row"><span>Receipt #:</span> <span>${txn.refNo}</span></div>
                    <div class="meta-row"><span>Cashier:</span> <span>${txn.cashierName}</span></div>
                    <div class="meta-row"><span>Seller:</span> <span>${txn.sellerName}</span></div>
                    <div class="meta-row"><span>Customer:</span> <span>${txn.customerName}</span></div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Qty</th>
                            <th>Unit P.</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="totals-row"><span>Subtotal:</span> <span>₦${Number(txn.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    ${Number(txn.discountPercent || 0) > 0 ? `<div class="totals-row"><span>Discount:</span> <span>${txn.discountPercent}%</span></div>` : ''}
                    <div class="totals-row grand-total"><span>TOTAL DUE:</span> <span>₦${Number(txn.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    
                    <div class="divider"></div>
                    <div class="totals-row"><span>Payment Method:</span> <span>${txn.paymentMethod}</span></div>
                    ${txn.paymentMethod === 'Cash' ? `
                        <div class="totals-row"><span>Amount Tendered:</span> <span>₦${Number(txn.cashReceived).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        <div class="totals-row"><span>Change:</span> <span>₦${Number(txn.changeProvided).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    ` : txn.paymentMethod !== 'Credit Account' ? `
                        <div class="totals-row"><span>Reference:</span> <span>${txn.referenceNumber || 'N/A'}</span></div>
                    ` : `<div class="totals-row" style="color:red; font-weight:bold;"><span>*ACCOUNT CHARGED TO DEBT*</span></div>`}
                </div>
                
                <div class="footer">
                    <p>Powered by Timson POS</p>
                    <p style="margin-top:5px; font-weight:bold;">Thank you for your patronage!</p>
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
            </script>
        </body>
        </html>
    `);
    w.document.close();
}
