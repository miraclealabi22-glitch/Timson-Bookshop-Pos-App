import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

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

const urlParams = new URLSearchParams(window.location.search);
const customerId = urlParams.get('id');

let currentCustomer = null;
let transactions = [];
let allGlobalTransactions = [];

document.addEventListener("DOMContentLoaded", function () {
    if (!customerId) {
        alert("No customer ID provided!");
        window.location.href = 'customer-credit.html';
        return;
    }

    // Load Global Transactions once for receipt lookup speed
    onValue(ref(db, 'transactionsRef'), snapshot => {
        const data = snapshot.val() || {};
        allGlobalTransactions = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
    });

    // Load Customer Data
    onValue(ref(db, `customersRef/${customerId}`), snapshot => {
        const data = snapshot.val();
        if (!data) {
            alert("Customer not found!");
            window.location.href = 'customer-credit.html';
            return;
        }
        currentCustomer = { id: customerId, ...data };
        renderHeader();
        
        const txnData = data.transactions || {};
        transactions = Object.entries(txnData).map(([k, v]) => ({ id: k, ...v }));
        
        // --- Calculate Running Balance (Oldest to Newest) ---
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let runningBal = 0;
        transactions.forEach(t => {
            runningBal += (Number(t.amount) || 0);
            t.calculatedBalance = runningBal;
        });
        
        // --- Reverse for Newest-First Display ---
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        renderTransactionsTable();
        updateSummaryCards();
    });
});

function renderHeader() {
    const avatar = document.getElementById('customer-avatar');
    const nameHeader = document.getElementById('customer-name-header');
    
    if (avatar) {
        const initials = currentCustomer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatar.textContent = initials;
    }
    if (nameHeader) {
        nameHeader.textContent = `Account: ${currentCustomer.name}`;
    }
}

function updateSummaryCards() {
    const limitEl = document.getElementById('globalCreditLimit');
    const balEl = document.getElementById('globalOutstandingBalance');
    const availEl = document.getElementById('globalAvailableCredit');

    const limit = Number(currentCustomer.creditLimit) || 0;
    const balance = Number(currentCustomer.balanceOwed) || 0;
    const available = Math.max(0, limit - balance);

    if (limitEl) limitEl.textContent = `₦${limit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if (balEl) balEl.textContent = `₦${balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if (availEl) availEl.textContent = `₦${available.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

function renderTransactionsTable() {
    const tbody = document.querySelector('#transactionTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No transactions found for this account.</td></tr>';
        return;
    }

    transactions.forEach((t, i) => {
        const date = new Date(t.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const amount = Number(t.amount) || 0;
        const isNegative = amount < 0;
        const absAmount = Math.abs(amount);
        
        let badgeClass = 'bg-warning-light text-warning border-warning';
        if (t.type.toLowerCase().includes('payment')) badgeClass = 'bg-success-light text-success border-success';
        if (t.type.toLowerCase().includes('return')) badgeClass = 'bg-info-light text-info border-info';

        tbody.innerHTML += `
            <tr class="${amount > 0 ? 'transaction-purchase' : 'transaction-payment'}">
                <td class="ps-4 fw-bold text-dark">${i + 1}</td>
                <td class="text-muted">
                    ${dateStr} <small class="d-block text-muted">${timeStr}</small>
                </td>
                <td class="fw-medium text-dark">#${t.ref || t.id.substring(t.id.length-6).toUpperCase()}</td>
                <td class="text-muted"><i class="fas fa-user-circle me-1"></i> ${t.staff || 'N/A'}</td>
                <td><span class="badge ${badgeClass} px-2 py-1 border">${t.type}</span></td>
                <td class="fw-bold ${isNegative ? 'text-success' : 'text-danger'}">
                    ${isNegative ? '-' : '+'}₦${absAmount.toLocaleString(undefined, {minimumFractionDigits:2})}
                </td>
                <td class="fw-bold text-dark">₦${(Number(t.calculatedBalance) || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border shadow-none" 
                        onclick="window.showReceipt('${t.id}')">
                        <i class="fas fa-receipt me-1"></i> Receipt
                    </button>
                </td>
            </tr>
        `;
    });
}

window.showReceipt = function(historyId) {
    const entry = transactions.find(tx => tx.id === historyId);
    if (!entry) return;

    const modalBody = document.getElementById('receiptModalBody');
    modalBody.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Building premium receipt...</p>
        </div>
    `;

    // Try to find detailed global transaction
    const globalTx = allGlobalTransactions.find(gt => gt.refNo === entry.ref);
    const dateObj = new Date(entry.date);
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let itemsHtml = '';
    if (globalTx && globalTx.items) {
        itemsHtml = globalTx.items.map(item => `
            <tr>
                <td>
                    <div class="fw-bold text-dark">${item.name}</div>
                    <div class="receipt-label" style="font-size: 0.6rem;">@ ₦${Number(item.price).toLocaleString()}</div>
                </td>
                <td class="text-center fw-semibold">${item.qty} ${item.unitType || 'PCS'}</td>
                <td class="text-end fw-bold">₦${(item.qty * (Number(item.price) || 0)).toLocaleString()}</td>
            </tr>
        `).join('');
    } else {
        // Fallback for payments or manual entries
        itemsHtml = `
            <tr>
                <td><div class="fw-bold text-dark">${entry.type}</div></td>
                <td class="text-center text-muted">---</td>
                <td class="text-end fw-bold">₦${Math.abs(entry.amount).toLocaleString()}</td>
            </tr>
        `;
    }

    const absAmount = Math.abs(entry.amount);
    const prevBal = (Number(entry.calculatedBalance) || 0) - (Number(entry.amount) || 0);

    const receiptHtml = `
        <div class="receipt-paper mx-auto mt-4 mb-4">
            <div class="text-center mb-4">
                <img src="../logo.png" alt="Logo" style="max-height: 70px; margin-bottom: 10px;">
                <div class="receipt-header-title">TIMSON BOOKSHOP</div>
                <div class="receipt-label">And Stationery Stores</div>
                <div class="mt-2 small text-muted" style="font-size: 0.7rem; line-height: 1.2;">
                    Timson Building, Takie Roundabout, Ogbomoso.<br>
                    <strong>Ph:</strong> 08034155216, 08030470763
                </div>
            </div>

            <div class="premium-separator"></div>

            <div class="row g-2 mb-3 px-2">
                <div class="col-6">
                    <div class="receipt-label">Ref Number</div>
                    <div class="receipt-value">#${entry.ref || entry.id.slice(-6).toUpperCase()}</div>
                </div>
                <div class="col-6 text-end">
                    <div class="receipt-label">Date</div>
                    <div class="receipt-value">${dateStr}</div>
                </div>
                <div class="col-12 mt-1">
                    <div class="receipt-label">Customer Name</div>
                    <div class="receipt-value text-uppercase">${currentCustomer.name}</div>
                </div>
            </div>

            <div class="premium-separator mb-0"></div>

            <table class="table receipt-table mb-2">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-center">Qty</th>
                        <th class="text-end">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="receipt-total-banner d-flex justify-content-between align-items-center mb-3">
                <span class="fw-bold text-muted small">TOTAL TRANSACTION</span>
                <span class="fw-bold fs-5 text-dark">₦${absAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
            </div>

            <div class="px-2 border-top pt-3 text-start">
                <div class="d-flex justify-content-between mb-1">
                    <span class="receipt-label">Old Debt Balance</span>
                    <span class="receipt-value">₦${prevBal.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                </div>
                <div class="d-flex justify-content-between mb-1">
                    <span class="receipt-label">${entry.amount > 0 ? 'Added Debt' : 'Amount Paid'}</span>
                    <span class="receipt-value ${entry.amount > 0 ? 'text-danger' : 'text-success'}">
                        ${entry.amount > 0 ? '+' : '-'}₦${absAmount.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                </div>
                <div class="d-flex justify-content-between mt-2 pt-2 border-top">
                    <span class="fw-bold text-dark h6 mb-0">CURRENT DEBT</span>
                    <span class="fw-bold text-danger h6 mb-0">₦${(Number(entry.calculatedBalance) || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                </div>
            </div>

            <div class="text-center mt-4">
                <div class="receipt-footer-brand">*** CUSTOMER ACCOUNT COPY ***</div>
                <div class="small text-muted mt-1" style="font-size: 0.6rem;">${timeStr} | Processed by ${entry.staff || 'System'}</div>
            </div>
        </div>
    `;

    modalBody.innerHTML = receiptHtml;
    document.getElementById('print-section').innerHTML = receiptHtml;

    const receiptModalEl = document.getElementById('receiptModal');
    const receiptModal = bootstrap.Modal.getOrCreateInstance(receiptModalEl);
    receiptModal.show();
};

window.printReceipt = function() {
    window.print();
}
