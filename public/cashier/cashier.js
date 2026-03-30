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
let currentReceiptTxn = null; // Store for printing from modal

// Helper to ensure Title Case
function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

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
    let prefix = "CSH";
    if(currentUser && currentUser.name) {
        const cleanName = currentUser.name.replace(/[^a-zA-Z]/g, '');
        prefix = (cleanName.length > 0 ? cleanName.padEnd(3, 'X') : "CSH").substring(0, 3).toUpperCase();
    }
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    cashierRefId = prefix + randDigits;
    
    const dipRef = document.getElementById('displayRefNo');
    if (dipRef) dipRef.innerText = cashierRefId;
}

function showAlert(title, message, type='info') {
    const container = document.getElementById('alertsContainer');
    if (!container) {
        alert(`${title}: ${message}`);
        return;
    }
    const el = document.createElement('div');
    el.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
    el.innerHTML = `<strong>${title}</strong><br>${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    container.appendChild(el);
    setTimeout(() => { if(el.parentNode) el.remove(); }, 6000);
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
        if (pic) pic.innerHTML = currentUser.name.charAt(0).toUpperCase();

        generateRefNo(); // Update prefix once cashier loads
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

    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        customers = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        populateCustomerList();
        renderDebtorsReport();
        populateCreditCustomersCheckout();
    });

    // 3. Transactions & Accounting (for reports)
    onValue(ref(db, 'transactionsRef'), snapshot => {
        const data = snapshot.val() || {};
        transactionsData = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        console.log("Transactions loaded:", transactionsData.length);
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

    // 4. Admin Cancellation Listener
    onValue(ref(db, 'systemLogs/cancellations'), snapshot => {
        const data = snapshot.val() || {};
        const entries = Object.values(data).sort((a,b) => b.timestamp - a.timestamp);
        if (entries.length > 0) {
            const latest = entries[0];
            // If it happened in the last 10 seconds
            if (Date.now() - latest.timestamp < 10000) {
                showAlert('Admin Order Cancellation', `Ref #${latest.orderRef} was cancelled by Admin (${latest.adminName}).`, 'danger');
                if (selectedOrder && selectedOrder.id === latest.orderId) {
                    selectedOrder = null;
                    renderSelectedOrder(); // Refresh UI to clear the cancelled order from processing
                }
            }
        }
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
function calculateSplitCheckout() {
    const splitCash = document.getElementById('splitCash');
    const splitPos = document.getElementById('splitPos');
    const splitTransfer = document.getElementById('splitTransfer');
    
    if(!splitCash || !splitPos || !splitTransfer) return;

    const cash = Number(splitCash.value) || 0;
    const pos = Number(splitPos.value) || 0;
    const transfer = Number(splitTransfer.value) || 0;
    const totDue = Number(selectedOrder ? selectedOrder.totalDue : 0) || 0;

    const totalTendered = cash + pos + transfer;
    const realChange = totalTendered > totDue ? (totalTendered - totDue) : 0;

    document.getElementById('splitTotalTendered').innerText = `₦${totalTendered.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('splitChangeDue').innerText = `₦${realChange.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    const btn = document.getElementById('confirmCheckoutBtn');

    if(btn) btn.disabled = (totalTendered < totDue || totDue === 0); 
}
window.calculateSplitCheckout = calculateSplitCheckout;

function openCheckoutModal() {
    if (!selectedOrder) {
        alert("Please select an order first.");
        return;
    }

    const checkoutTotalDue = document.getElementById('checkoutTotalDue');
    const splitTotalDueDisplay = document.getElementById('splitTotalDueDisplay');
    
    if(checkoutTotalDue) checkoutTotalDue.innerText = `Amount Due: ₦${Number(selectedOrder.totalDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if(splitTotalDueDisplay) splitTotalDueDisplay.innerText = `₦${Number(selectedOrder.totalDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Reset inputs
    ["splitCash", "splitPos", "splitTransfer"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });

    calculateSplitCheckout();
    
    const modalEl = document.getElementById('checkoutModal');
    if(modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}
window.openCheckoutModal = openCheckoutModal;



async function finalizeCheckout() {
    const btn = document.getElementById('confirmCheckoutBtn');
    if(!btn) return;
    
    btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Processing...`;
    btn.disabled = true;

    const cashInput = document.getElementById('splitCash');
    const posInput = document.getElementById('splitPos');
    const transferInput = document.getElementById('splitTransfer');

    const cash = Number(cashInput ? cashInput.value : 0) || 0;
    const pos = Number(posInput ? posInput.value : 0) || 0;
    const transfer = Number(transferInput ? transferInput.value : 0) || 0;
    
    const tot = Number(selectedOrder.totalDue);
    const totalTendered = cash + pos + transfer;
    const change = Math.max(0, totalTendered - tot);

    let finalCId = selectedOrder.customerId || null;
    let finalCName = selectedOrder.customerName || 'Walk-in';

    const txnPayload = {
        refNo: cashierRefId,
        sellerName: selectedOrder.sellerName,
        cashierName: currentUser.name,
        customerId: finalCId,
        customerName: finalCName,
        items: selectedOrder.items,
        subtotal: selectedOrder.subtotal,
        discountPercent: selectedOrder.discountPercent,
        totalAmount: tot,
        paymentMethod: "Split/Multi-Mode",
        splitPayments: {
            cash: cash,
            pos: pos,
            transfer: transfer
        },
        changeProvided: change,
        date: new Date().toISOString()
    };

    try {
        // 1. Save definitive Transaction
        await push(ref(db, 'transactionsRef'), txnPayload);

        // 2. Reduce Stock
        for (let item of selectedOrder.items || []) {
            const stockRefStr = `stockRef/${item.id}`; 
            const sSnap = await get(ref(db, stockRefStr));
            if (sSnap.exists()) {
                const pData = sSnap.val();
                let actualQty = item.qty;
                const cSize = Number(pData.cartonSize) || 0;
                const pSize = Number(pData.packSize) || 0;

                if(item.unitType === 'carton') actualQty = item.qty * cSize;
                else if(item.unitType === 'dozen') actualQty = item.qty * 12;
                else if(item.unitType === 'half') actualQty = item.qty * (Math.floor(cSize / 2));
                else if(item.unitType === 'quarter') actualQty = item.qty * (Math.floor(cSize / 4));
                else if(item.unitType === 'pack') actualQty = item.qty * pSize;
                
                const newTotalUnits = Math.max(0, (Number(pData.StockQuantity) || 0) - actualQty);
                // Simplify: Just update StockQuantity, others are derived
                await update(ref(db, stockRefStr), { StockQuantity: newTotalUnits });
            }
        }

        // 4. Remove from Pending limit
        await remove(ref(db, `pendingOrdersRef/${selectedOrder.id}`));

        bootstrap.Modal.getOrCreateInstance(document.getElementById('checkoutModal')).hide();
        
        // IMPORTANT: Capture the current ref BEFORE generateRefNo() changes it!
        const finalReceiptRef = cashierRefId;
        setTimeout(() => window.showReceipt(finalReceiptRef, true), 1000);

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
window.finalizeCheckout = finalizeCheckout;
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
            bootstrap.Modal.getOrCreateInstance(document.getElementById('nypModal')).hide();
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

document.getElementById('accForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('accType').value;
    const amt = Number(document.getElementById('accAmount').value) || 0;
    const note = document.getElementById('accNote').value;

    let targetRef = "cashFlowRef/unknown";
    if (type === 'Expense') targetRef = "cashFlowRef/expenses";
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
        bootstrap.Modal.getOrCreateInstance(document.getElementById('accountingModal')).hide();
    } catch (err) {
        console.error(err);
        alert("Failed to record entry.");
    }
});

// --- Reports ---
document.getElementById('dailyReportDate')?.addEventListener('change', renderDailyReport);

function renderDailyReport() {
    const rContainer = document.getElementById('dailyReportContainer');
    const tbody = document.getElementById('dailyTransactionsTableBody');
    const tfooter = document.getElementById('dailyReportFooter');
    if (!rContainer || !tbody || !tfooter) return;

    let targetDate = document.getElementById('dailyReportDate').value;
    if (!targetDate) {
        targetDate = new Date().toISOString().split('T')[0];
        document.getElementById('dailyReportDate').value = targetDate;
    }

    let tSales = 0, tExpenses = 0, tNypCol = 0, tBank = 0, tExcess = 0;
    // Ground Totals breakdown
    let gtCash = 0, gtPos = 0, gtTransfer = 0, gtCredit = 0, gtTotal = 0;

    const dayTransactions = [];

    transactionsData.forEach(t => {
        const d = (t.date || t.timestamp || '');
        if (d.split('T')[0] === targetDate) {
            dayTransactions.push(t);
            
            console.log("Transaction matched date:", t.refNo, t.paymentMethod, t.totalAmount);
            if (t.paymentMethod === "NYP Debt Payment") {
                tNypCol += (Number(t.totalAmount) || 0);
            } else {
                if (t.splitPayments) {
                    gtCash += (Number(t.splitPayments.cash) || 0);
                    gtPos += (Number(t.splitPayments.pos) || 0);
                    gtTransfer += (Number(t.splitPayments.transfer) || 0);
                    gtCredit += (Number(t.splitPayments.credit) || 0);
                    // Deduct change from cash if any
                    gtCash -= (Number(t.changeProvided) || 0);
                } else {
                    // Legacy or single-mode
                    const pm = (t.paymentMethod || '').toLowerCase();
                    const amt = Number(t.totalAmount) || 0;
                    if (pm === 'cash') gtCash += amt;
                    else if (pm === 'pos') gtPos += amt;
                    else if (pm === 'bank transfer' || pm === 'transfer') gtTransfer += amt;
                    else if (pm === 'credit account' || pm === 'credit') gtCredit += amt;
                    else {
                        // Fallback: if no splitPayments and unknown method, assume Cash
                        gtCash += amt;
                    }
                }
                gtTotal += (Number(t.totalAmount) || 0);
            }
        }
    });

    console.log("Daily Report Totals:", { gtCash, gtPos, gtTransfer, gtTotal, tNypCol });

    accountingData.forEach(a => {
        if ((a.date || '').split('T')[0] === targetDate) {
            if (a.type === 'Expense') tExpenses += (Number(a.amount) || 0);
            if (a.type === 'BankLodgement') tBank += (Number(a.amount) || 0);
            if (a.type === 'ExcessCash') tExcess += (Number(a.amount) || 0);
        }
    });

    // Total Payment Amount = Cash + POS + Transfer
    const totalPaymentAmt = gtCash + gtPos + gtTransfer + tNypCol;
    // gtCash already includes cash sales. tNypCol is debt payment. 
    // Expenses and Bank Lodgement are deductions.
    const cashAvailable = (gtCash + tNypCol + tExcess) - (tExpenses + tBank);
    const totalSalesBalance = gtTotal;

    rContainer.innerHTML = `
        <div class="row g-4">
            <div class="col-md-4">
                <div class="card shadow-sm border-0 border-start border-primary border-4 rounded-3">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Daily Revenue</h6>
                        <h3 class="fw-bold mb-0">₦${gtTotal.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card shadow-sm border-0 border-start border-info border-4 rounded-3">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">NYP Collected</h6>
                        <h3 class="fw-bold mb-0">₦${tNypCol.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card shadow-sm border-0 border-start border-success border-4 rounded-3">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Excess Cash</h6>
                        <h3 class="fw-bold mb-0">₦${tExcess.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow-sm border-0 border-start border-danger border-4 rounded-3">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Expenses</h6>
                        <h3 class="fw-bold mb-0 text-danger">-₦${tExpenses.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow-sm border-0 border-start border-secondary border-4 rounded-3">
                    <div class="card-body">
                        <h6 class="text-muted fw-bold">Bank Lodgement</h6>
                        <h3 class="fw-bold mb-0 text-danger">-₦${tBank.toLocaleString()}</h3>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Final Summary Cards at the bottom of the table
    if(document.getElementById('totalPaymentAmount')) document.getElementById('totalPaymentAmount').innerText = `₦${totalPaymentAmt.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(document.getElementById('totalSalesBalance')) document.getElementById('totalSalesBalance').innerText = `₦${totalSalesBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(document.getElementById('totalCashAvailable')) document.getElementById('totalCashAvailable').innerText = `₦${cashAvailable.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    // New Breakdown cards
    if(document.getElementById('totalCashCalculated')) document.getElementById('totalCashCalculated').innerText = `₦${(gtCash + tNypCol).toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(document.getElementById('totalPosCalculated')) document.getElementById('totalPosCalculated').innerText = `₦${gtPos.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(document.getElementById('totalTransferCalculated')) document.getElementById('totalTransferCalculated').innerText = `₦${gtTransfer.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    // Populate transactions table
    tbody.innerHTML = '';
    if (dayTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No transactions for this date.</td></tr>';
        tfooter.innerHTML = '';
    } else {
        dayTransactions.forEach(t => {
            let c = 0, p = 0, tr = 0, cr = 0;
            if(t.splitPayments) {
                c = (Number(t.splitPayments.cash) || 0) - (Number(t.changeProvided) || 0);
                p = (Number(t.splitPayments.pos) || 0);
                tr = (Number(t.splitPayments.transfer) || 0);
                cr = (Number(t.splitPayments.credit) || 0);
            } else {
                if(t.paymentMethod === 'Cash') c = t.totalAmount;
                else if(t.paymentMethod === 'POS') p = t.totalAmount;
                else if(t.paymentMethod === 'Bank Transfer') tr = t.totalAmount;
                else if(t.paymentMethod === 'Credit Account') cr = t.totalAmount;
                else if(t.paymentMethod === 'NYP Debt Payment') c = t.totalAmount;
            }

            let time = "---";
            try {
                const dateObj = new Date(t.date || t.timestamp);
                if (!isNaN(dateObj.getTime())) {
                    time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                }
            } catch(e) { console.warn("Invalid date for txn:", t.refNo); }

            tbody.innerHTML += `
                <tr>
                    <td><a href="#" class="text-primary fw-bold" onclick="showReceipt('${t.refNo}')">${t.refNo}</a></td>
                    <td>${t.customerName || 'Walk-in'}</td>
                    <td class="text-end">₦${c.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td class="text-end">₦${p.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td class="text-end">₦${tr.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td class="text-end">₦${cr.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td class="text-end fw-bold">₦${(Number(t.totalAmount)||0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td><small>${time}</small></td>
                </tr>
            `;
        });

        // Inject Ground Totals into Footer
        tfooter.innerHTML = `
            <tr class="table-secondary">
                <td colspan="2" class="text-center fw-bold">Grand Total:</td>
                <td class="text-end fw-bold">₦${gtCash.toLocaleString()}</td>
                <td class="text-end fw-bold">₦${gtPos.toLocaleString()}</td>
                <td class="text-end fw-bold">₦${gtTransfer.toLocaleString()}</td>
                <td class="text-end fw-bold">₦${gtCredit.toLocaleString()}</td>
                <td class="text-end fw-extrabold text-primary">₦${gtTotal.toLocaleString()}</td>
                <td></td>
            </tr>
        `;
    }
}

window.showReceipt = function(refNo, autoPrint = false) {
    const transaction = transactionsData.find(t => t.refNo === refNo);
    if (!transaction) {
        alert('Transaction not found!');
        return;
    }
    currentReceiptTxn = transaction;

    const receiptContent = document.getElementById('receiptContent');
    const date = new Date(transaction.date).toLocaleString();

    let itemsHtml = '';
    if (transaction.items && transaction.items.length > 0) {
        itemsHtml = transaction.items.map(item => `
            <tr>
                <td>${item.name}</td>
                <td class="text-center">${item.qty} ${item.unitType || 'unit'}</td>
                <td class="text-end">₦${Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="text-end">₦${(item.qty * (item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');
    }

    receiptContent.innerHTML = `
        <div class="receipt-paper mx-auto">
            <div class="text-center mb-4">
                <img src="../logo.png" alt="Logo" style="max-height: 70px; margin-bottom: 15px;">
                <div class="receipt-header-title mb-1">Timson Bookshop</div>
                <div class="small fw-semibold text-muted" style="font-size: 0.75rem; letter-spacing: 1px;">And Stationery Stores</div>
                <div class="mt-3 small" style="line-height: 1.4; font-size: 0.75rem; color: #555;">
                    Timson Building, Opposite Takie Roundabout,<br>
                    Ogbomoso, Oyo State. Nigeria<br>
                    <strong>Ph:</strong> 08034155216, 08030470763
                </div>
            </div>

            <div class="premium-separator"></div>

            <div class="row g-2 mb-3">
                <div class="col-6">
                    <div class="receipt-label">Reference Number</div>
                    <div class="receipt-value">#${transaction.refNo}</div>
                </div>
                <div class="col-6 text-end">
                    <div class="receipt-label">Date</div>
                    <div class="receipt-value">${date.split(',')[0]}</div>
                </div>
                <div class="col-6">
                    <div class="receipt-label">Cashier</div>
                    <div class="receipt-value">${transaction.cashierName || 'Staff'}</div>
                </div>
                <div class="col-6 text-end">
                    <div class="receipt-label">Customer</div>
                    <div class="receipt-value">${toTitleCase(transaction.customerName || 'Walk-in')}</div>
                </div>
            </div>

            <table class="table receipt-table mt-4 mb-2">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-center">Qty</th>
                        <th class="text-end">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${(transaction.items || []).map(item => `
                        <tr>
                            <td>
                                <div class="fw-bold text-dark">${toTitleCase(item.name)}</div>
                                <div class="receipt-label" style="font-size: 0.6rem;">@ ₦${Number(item.price).toLocaleString()}</div>
                            </td>
                            <td class="text-center fw-semibold">${item.qty} ${item.unitType || 'PCS'}</td>
                            <td class="text-end fw-bold">₦${(item.qty * (item.price || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    ${!(transaction.items && transaction.items.length > 0) ? `
                        <tr><td colspan="3" class="text-center py-3 text-muted" style="font-size:0.8rem;"><em>Payment only - No item details</em></td></tr>
                    ` : ''}
                </tbody>
            </table>

            <div class="receipt-total-banner text-center">
                <div class="receipt-label mb-1">Total Amount Due</div>
                <div class="h3 fw-bold mb-0" style="color: #1a1a1a; font-weight: 800;">₦${Number(transaction.totalAmount).toLocaleString()}</div>
            </div>

            <div class="px-2 mb-4" style="font-size: 0.75rem; color: #666;">
                <div class="d-flex justify-content-between mb-1">
                    <span>Payment Mode:</span>
                    <span class="fw-bold text-dark">${Object.entries(transaction.splitPayments || {}).filter(([_,v]) => v > 0).map(([k]) => k.toUpperCase()).join(', ')}</span>
                </div>
                ${transaction.changeProvided > 0 ? `
                    <div class="d-flex justify-content-between text-danger fw-bold">
                        <span>Change:</span>
                        <span>₦${Number(transaction.changeProvided).toLocaleString()}</span>
                    </div>
                ` : ''}
            </div>

            <div class="text-center mt-4">
                <div class="small fw-bold text-dark mb-1">Thank You For Your Patronage</div>
                <div class="receipt-label italic" style="font-style: italic; text-transform: none;">
                    Oja Ti Eralo Ni Daada Ekogbodo Gbepada Wa.
                </div>
            </div>

            <div class="mt-5 text-center">
                <div class="receipt-footer-brand">Powered By Bath Technologies</div>
                <div style="font-size: 0.55rem; color: #bbb;">+234-803-419-2786 • © 2024</div>
            </div>
        </div>
    `;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('receiptModal')).show();
    if (autoPrint) {
        setTimeout(() => window.print(), 1000);
    }
}

window.searchGlobalTxn = function() {
    const input = document.getElementById('globalTxnSearchInput');
    if (!input || !input.value.trim()) return;
    const q = input.value.trim().toLowerCase();
    
    // Allow partial exact match
    const matched = transactionsData.find(t => (t.refNo || '').toLowerCase() === q || (t.refNo || '').toLowerCase().includes(q));
    
    if (matched) {
        window.showReceipt(matched.refNo);
        input.value = ''; 
    } else {
        alert('Transaction not found! Please check the Reference Number.');
    }
}

window.printReceiptModal = function() {
    window.print();
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
window.populateCreditCustomersCheckout = function() {
    const sel = document.getElementById('creditCustomerCheckoutSelect');
    if(!sel) return;
    // Only customers with a credit limit mapped can do NYP
    const eligible = customers.filter(c => Number(c.creditLimit) > 0);
    sel.innerHTML = '<option value="" disabled selected>Choose active NYP customer...</option>';
    eligible.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
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
    const tot = Number(selectedOrder.totalDue) || 0;
    
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

// Printing legacy code removed


// printReceiptModal is already defined above
