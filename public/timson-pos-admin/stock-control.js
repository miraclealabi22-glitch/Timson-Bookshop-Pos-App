// import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", function () {
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
    const database = getDatabase(app);
    const restockTable = document.getElementById('restockTable');
    const updateStockModal = document.getElementById('updateStockModal');
    const addedQuantityInput = document.getElementById('addedQuantity');
    const newTotalStockSpan = document.getElementById('newTotalStock');
    let currentBaseStock = 0;
    let currentEditId = null;

    const payAttentionToLowStock = (current, reorder) => {
        if (current <= reorder) return 'bg-danger text-white';
        if (current <= reorder * 1.5) return 'bg-warning text-dark';
        return 'bg-success text-white';
    };

    const getStockBalanceDisplay = (item) => {
        const cartonQty = Number(item.cartonQuantity || 0);
        const cartonSize = Number(item.cartonSize || 0);
        const unitQty = Number(item.unitQuantity || 0);

        if (cartonSize > 0) {
            const totalUnits = cartonQty * cartonSize + unitQty;
            const fullCartons = Math.floor(totalUnits / cartonSize);
            const remainder = totalUnits % cartonSize;
            let result = `${fullCartons} ctn${fullCartons === 1 ? '' : 's'}`;
            if (remainder > 0) result += ` ${remainder} pcs`;
            return result;
        }

        const currentStock = Number(item.StockQuantity || 0);
        return `${currentStock} pcs`;
    };

    const computeRecommendedRestock = (currentStock, reorderLevel) => {
        const target = Number(reorderLevel || 0);
        const current = Number(currentStock || 0);
        return Math.max(0, target - current);
    };

    const renderTable = (items = []) => {
        if (!restockTable) return;
        const body = restockTable.querySelector('tbody');
        body.innerHTML = '';

        items.forEach(item => {
            const currentStock = Number(item.StockQuantity || 0);
            const reorderLevel = Number(item.ReorderLevel || 0);
            const recRestock = computeRecommendedRestock(currentStock, reorderLevel);
            const lowStockClass = payAttentionToLowStock(currentStock, reorderLevel);

            const row = document.createElement('tr');
            row.dataset.productId = item.id;
            row.dataset.current = currentStock;
            row.dataset.rec = recRestock;

            row.innerHTML = `
                <td class="ps-4">
                    <span class="fw-bold text-dark d-block">${item.Product || 'Unknown'}</span>
                    <small class="text-muted">${item.barcode || ''}</small>
                </td>
                <td><span class="badge bg-light text-dark border">${item.ProductCategory || 'Unspecified'}</span></td>
                <td><span class="badge ${lowStockClass} rounded-pill px-3 py-1 current-stock">${currentStock}</span></td>
                <td><span class="badge bg-info text-dark rounded-pill px-3 py-1 stock-balance">${getStockBalanceDisplay(item)}</span></td>
                <td class="text-muted fw-medium reorder-level">${reorderLevel}</td>
                <td class="fw-bold text-primary restock-count">+${recRestock}</td>
                <td class="text-end pe-4 action-btns">
                    <button class="btn btn-outline-primary fw-medium px-3" data-bs-toggle="modal" data-bs-target="#updateStockModal"
                        data-product-id="${item.id}" data-product-name="${item.Product || ''}" data-current-stock="${currentStock}" data-rec="${recRestock}">
                        <i class="fas fa-plus me-1"></i> Update Stock
                    </button>
                </td>
            `;

            body.appendChild(row);
        });
    };

    const stockRef = ref(database, 'stockRef');
    onValue(stockRef, (snapshot) => {
        const data = snapshot.val();
        const products = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
        renderTable(products);
    });

    if (updateStockModal) {
        updateStockModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const product = button.getAttribute('data-product-name');
            const productId = button.getAttribute('data-product-id');
            const currentStock = Number(button.getAttribute('data-current-stock') || 0);
            const recStock = Number(button.getAttribute('data-rec') || 0);

            currentBaseStock = currentStock;
            currentEditId = productId;

            document.getElementById('modalProductName').textContent = product;
            document.getElementById('modalCurrentStock').textContent = currentStock;
            document.getElementById('modalRecStock').textContent = recStock;
            if (addedQuantityInput) addedQuantityInput.value = '';
            if (newTotalStockSpan) newTotalStockSpan.textContent = currentStock;
        });
    }

    if (addedQuantityInput) {
        addedQuantityInput.addEventListener('input', function () {
            const addedVal = parseInt(this.value, 10) || 0;
            if (newTotalStockSpan) newTotalStockSpan.textContent = currentBaseStock + addedVal;
        });
    }

    const confirmStockUpdateBtn = document.getElementById('confirmStockUpdateBtn');
    if (confirmStockUpdateBtn) {
        confirmStockUpdateBtn.addEventListener('click', function () {
            const form = document.getElementById('updateStockForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const addedAmount = parseInt(addedQuantityInput.value, 10) || 0;
            const finalAmount = currentBaseStock + addedAmount;

            if (!currentEditId) {
                alert('No product selected for update.');
                return;
            }

            const productRef = ref(database, `stockRef/${currentEditId}`);
            update(productRef, { StockQuantity: finalAmount })
                .then(() => {
                    const modalInstance = bootstrap.Modal.getInstance(updateStockModal);
                    if (modalInstance) modalInstance.hide();
                    alert(`Successfully restocked ${addedAmount} units! New total: ${finalAmount}`);
                })
                .catch((error) => {
                    console.error('Stock update failed', error);
                    alert('Stock update failed: ' + (error.message || error));
                });
        });
    }
});
