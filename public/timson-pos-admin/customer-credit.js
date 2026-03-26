document.addEventListener("DOMContentLoaded", function () {

    // --- State Mock ---
    const CURRENT_BALANCE = 320.50;

    // --- Modals Interactivity ---

    // Add credit customer simulation
    const saveCustomerBtn = document.getElementById('saveCustomerBtn');
    if (saveCustomerBtn) {
        saveCustomerBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const form = document.getElementById('addCustomerForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            alert("Credit Customer successfully created! (Mocked for Demo)");
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCustomerModal'));
            modal.hide();
            form.reset();
        });
    }

    // Purchase Simulation
    const purchaseAmountInput = document.getElementById('purchaseAmount');
    const simulatedPurchaseBalance = document.getElementById('simulatedPurchaseBalance');
    if (purchaseAmountInput && simulatedPurchaseBalance) {
        purchaseAmountInput.addEventListener('input', function () {
            const added = parseFloat(this.value) || 0;
            const newBal = CURRENT_BALANCE + added;
            simulatedPurchaseBalance.textContent = '₦' + newBal.toFixed(2);
        });

        document.getElementById('confirmPurchaseBtn').addEventListener('click', function (e) {
            e.preventDefault();
            const form = document.getElementById('purchaseForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            alert("Credit Purchase successfully recorded! (Mocked)");
            bootstrap.Modal.getInstance(document.getElementById('recordPurchaseModal')).hide();
            form.reset();
            simulatedPurchaseBalance.textContent = '₦' + CURRENT_BALANCE.toFixed(2);
        });
    }

    // Payment Simulation
    const paymentAmountInput = document.getElementById('paymentAmount');
    const simulatedPaymentBalance = document.getElementById('simulatedPaymentBalance');
    if (paymentAmountInput && simulatedPaymentBalance) {
        paymentAmountInput.addEventListener('input', function () {
            const paid = parseFloat(this.value) || 0;
            const newBal = CURRENT_BALANCE - paid;
            // Prevent negative logic display in this demo
            const displayBal = newBal >= 0 ? newBal : 0;
            simulatedPaymentBalance.textContent = '₦' + displayBal.toFixed(2);
        });

        document.getElementById('confirmPaymentBtn').addEventListener('click', function (e) {
            e.preventDefault();
            const form = document.getElementById('paymentForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            alert("Payment successfully recorded! (Mocked)");
            bootstrap.Modal.getInstance(document.getElementById('recordPaymentModal')).hide();
            form.reset();
            simulatedPaymentBalance.textContent = '₦' + CURRENT_BALANCE.toFixed(2);
        });
    }

});

// --- Dynamic Receipt Generation ---
// Attached to window to be accessible from inline onclick elements in HTML
window.generateReceipt = function (type, ref, amount, prevBal, newBal, dateString) {
    // DOM Elements
    document.getElementById('rcptType').textContent = type === 'Purchase' ? 'Credit Purchase' : 'Payment Received';
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
        newBalEl.classList.add('text-success'); // Show success color on new balance if payment
    }

    // Open Modal
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
};
