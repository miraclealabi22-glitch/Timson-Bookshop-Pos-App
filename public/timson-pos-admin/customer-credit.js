import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

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

let customers = [];

document.addEventListener("DOMContentLoaded", function () {
    // Sync Customers
    onValue(ref(db, 'customersRef'), snapshot => {
        const data = snapshot.val() || {};
        customers = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        renderCustomersTable();
        updateStats();
    });

    // Add credit customer
    const saveCustomerBtn = document.getElementById('saveCustomerBtn');
    if (saveCustomerBtn) {
        saveCustomerBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            const form = document.getElementById('addCustomerForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const name = document.getElementById('custName').value.trim();
            const phone = document.getElementById('custPhone').value.trim();
            const email = document.getElementById('custEmail').value.trim();
            const limit = Number(document.getElementById('custCreditLimit').value) || 0;

            const payload = {
                name: name,
                phone: phone,
                email: email,
                creditLimit: limit,
                balanceOwed: 0,
                createdAt: new Date().toISOString()
            };

            const btn = e.currentTarget;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            try {
                await push(ref(db, 'customersRef'), payload);
                alert("Credit Customer successfully created!");
                const modalEl = document.getElementById('addCustomerModal');
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                form.reset();
            } catch(err) {
                console.error(err);
                alert("Failed to save customer");
            } finally {
                btn.innerHTML = 'Save Customer';
                btn.disabled = false;
            }
        });
    }
});

function renderCustomersTable() {
    const tbody = document.querySelector('.table tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    if(customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No credit customers found. Add your first customer!</td></tr>';
        return;
    }

    customers.forEach(c => {
        const bal = Number(c.balanceOwed) || 0;
        const limit = Number(c.creditLimit) || 0;
        const usage = limit > 0 ? ((bal / limit) * 100).toFixed(0) : 0;
        
        let barClass = 'bg-success';
        if(usage > 75) barClass = 'bg-danger';
        else if(usage > 50) barClass = 'bg-warning';

        const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NA';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 text-muted fw-medium">#${c.id.substring(c.id.length-6).toUpperCase()}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-primary-light rounded-circle text-primary fw-bold d-flex align-items-center justify-content-center me-3"
                            style="width: 36px; height: 36px;">${initials}</div>
                        <span class="fw-bold text-dark">${c.name}</span>
                    </div>
                </td>
                <td class="text-muted">${c.phone || c.email || 'N/A'}</td>
                <td class="text-dark fw-medium">₦${limit.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td><span class="fw-bold ${bal > 0 ? 'text-danger' : 'text-success'}">₦${bal.toLocaleString(undefined, {minimumFractionDigits:2})}</span></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress flex-grow-1" style="height: 6px;">
                            <div class="progress-bar ${barClass}" role="progressbar" style="width: ${Math.min(usage, 100)}%;"></div>
                        </div>
                        <small class="text-muted">${usage}%</small>
                    </div>
                </td>
                <td class="text-end pe-4 action-btns">
                    <button class="btn btn-outline-danger fw-medium px-3 me-2" onclick="deleteCustomer('${c.id}')">
                        <i class="fas fa-trash me-1"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

function updateStats() {
    let totalDebt = 0;
    let activeCust = 0;

    customers.forEach(c => {
        const bal = Number(c.balanceOwed) || 0;
        totalDebt += bal;
        if(Number(c.creditLimit) > 0) activeCust++;
    });

    const statDebt = document.querySelector('.card.stat-card .text-danger.fw-bold');
    const statActive = document.querySelector('.card.stat-card .text-primary.fw-bold');
    
    if(statDebt) statDebt.innerText = '₦' + totalDebt.toLocaleString(undefined, {minimumFractionDigits:2});
    if(statActive) statActive.innerText = activeCust;
}

window.deleteCustomer = async function(id) {
    if(!confirm("Are you sure you want to delete this customer? This will remove all their debt records!")) return;
    
    try {
        await remove(ref(db, `customersRef/${id}`));
        alert("Customer deleted.");
    } catch(e) {
        console.error(e);
        alert("Failed to delete customer.");
    }
}

// --- Modals Interactivity (For customer-details.html) ---
document.addEventListener("DOMContentLoaded", function () {
    const CURRENT_BALANCE = 320.50;

    // Purchase Simulation
    const purchaseAmountInput = document.getElementById('purchaseAmount');
    const simulatedPurchaseBalance = document.getElementById('simulatedPurchaseBalance');
    if (purchaseAmountInput && simulatedPurchaseBalance) {
        purchaseAmountInput.addEventListener('input', function () {
            const added = parseFloat(this.value) || 0;
            const newBal = CURRENT_BALANCE + added;
            simulatedPurchaseBalance.textContent = '₦' + newBal.toFixed(2);
        });

        const confirmPurchaseBtn = document.getElementById('confirmPurchaseBtn');
        if (confirmPurchaseBtn) {
            confirmPurchaseBtn.addEventListener('click', function (e) {
                e.preventDefault();
                const form = document.getElementById('purchaseForm');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                alert("Credit Purchase successfully recorded!");
                const modalEl = document.getElementById('recordPurchaseModal');
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                if(modal) modal.hide();
                form.reset();
                simulatedPurchaseBalance.textContent = '₦' + CURRENT_BALANCE.toFixed(2);
            });
        }
    }

    // Payment Simulation
    const paymentAmountInput = document.getElementById('paymentAmount');
    const simulatedPaymentBalance = document.getElementById('simulatedPaymentBalance');
    if (paymentAmountInput && simulatedPaymentBalance) {
        paymentAmountInput.addEventListener('input', function () {
            const paid = parseFloat(this.value) || 0;
            const newBal = CURRENT_BALANCE - paid;
            const displayBal = newBal >= 0 ? newBal : 0;
            simulatedPaymentBalance.textContent = '₦' + displayBal.toFixed(2);
        });

        const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
        if (confirmPaymentBtn) {
            confirmPaymentBtn.addEventListener('click', function (e) {
                e.preventDefault();
                const form = document.getElementById('paymentForm');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                alert("Payment successfully recorded!");
                const modalEl = document.getElementById('recordPaymentModal');
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                if(modal) modal.hide();
                form.reset();
                simulatedPaymentBalance.textContent = '₦' + CURRENT_BALANCE.toFixed(2);
            });
        }
    }
});

// --- Dynamic Receipt Generation ---
window.generateReceipt = function (type, ref, amount, prevBal, newBal, dateString) {
    const typeEl = document.getElementById('rcptType');
    if(!typeEl) return;
    
    typeEl.textContent = type === 'Purchase' ? 'Credit Purchase' : 'Payment Received';
    document.getElementById('rcptRef').textContent = ref;
    document.getElementById('rcptDate').textContent = dateString;

    document.getElementById('rcptPrevBal').textContent = '₦' + prevBal.toFixed(2);
    document.getElementById('rcptAmount').textContent = '₦' + amount.toFixed(2);
    document.getElementById('rcptNewBal').textContent = '₦' + newBal.toFixed(2);

    const actionText = document.getElementById('rcptActionText');
    const newBalEl = document.getElementById('rcptNewBal');

    if (type === 'Purchase') {
        actionText.textContent = 'Amount Purchased:';
        newBalEl.classList.remove('text-success');
        newBalEl.classList.add('text-danger');
    } else {
        actionText.textContent = 'Amount Paid:';
        newBalEl.classList.remove('text-danger');
        newBalEl.classList.add('text-success'); 
    }

    const receiptModalEl = document.getElementById('receiptModal');
    if(receiptModalEl) {
        const receiptModal = new bootstrap.Modal(receiptModalEl);
        receiptModal.show();
    }
};

