import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
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

    const updateStockStats = (products, transactions) => {
        // 1. Stat Cards
        const totalProducts = products.length;
        const lowStock = products.filter(p => Number(p.StockQuantity) <= (Number(p.ReorderLevel) || 10) && Number(p.StockQuantity) > 0).length;
        const outOfStock = products.filter(p => Number(p.StockQuantity) <= 0).length;
        
        // Fast Selling calculation (sold last 7 days)
        const last7Days = new Date(); last7Days.setDate(last7Days.getDate() - 7);
        const productSoldQty = {};
        transactions.forEach(t => {
            const td = new Date(t.date || t.timestamp);
            if(td >= last7Days) {
                (t.items || []).forEach(it => {
                    productSoldQty[it.name] = (productSoldQty[it.name] || 0) + (Number(it.qty) || 0);
                });
            }
        });
        const fastSelling = products.filter(p => (productSoldQty[p.Product] || 0) >= 50).length;

        const statEls = document.querySelectorAll('.stat-card h3');
        if (statEls.length >= 4) {
            statEls[0].innerText = totalProducts.toLocaleString();
            statEls[1].innerText = lowStock.toLocaleString();
            statEls[2].innerText = outOfStock.toLocaleString();
            statEls[3].innerText = fastSelling.toLocaleString();
        }

        // 2. Critical Depletion
        const criticalUl = document.querySelector('.card .list-group-flush');
        if (criticalUl) {
            const criticalItems = products.filter(p => Number(p.StockQuantity) <= (Number(p.ReorderLevel) / 2 || 5)).sort((a,b) => Number(a.StockQuantity) - Number(b.StockQuantity)).slice(0, 4);
            criticalUl.innerHTML = criticalItems.map(item => `
                <li class="list-group-item d-flex justify-content-between align-items-center p-4 border-0 border-bottom">
                    <div class="d-flex align-items-center">
                        <div class="bg-danger-light rounded p-2 me-3 text-danger"><i class="fas fa-book"></i></div>
                        <div>
                            <h6 class="mb-0 fw-bold text-dark fs-6">${item.Product}</h6>
                            <small class="text-muted">${item.ProductCategory || 'General'}</small>
                        </div>
                    </div>
                    <span class="fw-bold text-danger">${item.StockQuantity} Left</span>
                </li>
            `).join('') || '<li class="list-group-item text-center py-4 text-muted">No critical items found</li>';
        }

        renderStockMovementChart(products, transactions);
    };

    let stockChartInstance;
    const renderStockMovementChart = (products, transactions) => {
        const ctx = document.getElementById('stockChart');
        if (!ctx) return;

        // Turnover by Top 6 products
        const stats = {};
        transactions.forEach(t => {
            (t.items || []).forEach(it => {
                stats[it.name] = (stats[it.name] || 0) + (Number(it.qty) || 0);
            });
        });

        const sorted = Object.entries(stats).sort((a,b) => b[1] - a[1]).slice(0, 6);
        const labels = sorted.map(s => s[0]);
        const turnoverData = sorted.map(s => s[1]);
        const stockData = sorted.map(s => {
            const p = products.find(prod => prod.Product === s[0]);
            return p ? Number(p.StockQuantity) : 0;
        });

        if (stockChartInstance) stockChartInstance.destroy();

        stockChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Turnover (Sold)',
                        data: turnoverData,
                        backgroundColor: '#4361ee',
                        borderRadius: 6
                    },
                    {
                        label: 'Current Stock',
                        data: stockData,
                        backgroundColor: '#e2e8f0',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', align: 'end' } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { borderDash: [4, 4] } }
                }
            }
        });
    };

    let currentProducts = [], currentTransactions = [];
    const refreshAll = () => {
        renderTable(currentProducts);
        updateStockStats(currentProducts, currentTransactions);
    };

    onValue(ref(database, 'stockRef'), (snapshot) => {
        const data = snapshot.val();
        currentProducts = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
        refreshAll();
    });

    onValue(ref(database, 'transactionsRef'), (snapshot) => {
        const data = snapshot.val();
        currentTransactions = data ? Object.values(data) : [];
        refreshAll();
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

        // Use Recommended Link
        const useRecommendedLink = document.getElementById('useRecommendedLink');
        if (useRecommendedLink) {
            useRecommendedLink.onclick = () => {
                const recStock = Number(document.getElementById('modalRecStock').textContent || 0);
                if (addedQuantityInput) {
                    addedQuantityInput.value = recStock;
                    addedQuantityInput.dispatchEvent(new Event('input'));
                }
            };
        }
    }

    // Search Filter
    const searchInput = document.querySelector('input[placeholder="Search product..."]');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            const rows = restockTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const name = row.querySelector('.fw-bold').textContent.toLowerCase();
                row.style.display = name.includes(query) ? '' : 'none';
            });
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
                    const modalInstance = bootstrap.Modal.getOrCreateInstance(updateStockModal);
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
