document.addEventListener("DOMContentLoaded", function () {
    // Firebase authentication setup for user profile across all admin pages
    (function setupFirebaseAuth(){
        import("https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js").then(({initializeApp})=>{
            import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js").then(({getAuth,onAuthStateChanged})=>{
                const firebaseConfig = {
                    apiKey: "AIzaSyACgmBzV74SwJLVyUCMdN1xOxZjMI4UgCg",
                    authDomain: "posapp-ed05a.firebaseapp.com",
                    projectId: "posapp-ed05a",
                    storageBucket: "posapp-ed05a.firebasestorage.app",
                    messagingSenderId: "486175914054",
                    appId: "1:486175914054:web:b2f7d71ae98c451f417247"
                };
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);

                function toTitleCase(str) {
                    if (!str) return "";
                    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                }
                
                // --- ADMIN LIVE DATA ---
                import("https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js").then(({getDatabase, ref, onValue, remove, push, serverTimestamp}) => {
                    const db = getDatabase(app);
                    window.adminTransactions = [];
                    window.adminAccounting = [];
                    window.adminProducts = [];
                    window.adminCustomers = [];
                    window.adminPendingOrders = [];

                    onAuthStateChanged(auth, user => {
                        if (user) {
                            // ... existing profile code ...
                            const picContainer = document.getElementById('profilePics');
                            let imgSrc = user.photoURL;
                            if (!imgSrc) {
                                const nameForAvatar = encodeURIComponent(user.displayName || user.email || 'User');
                                imgSrc = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=4361ee&color=fff`;
                            }
                            if (picContainer) picContainer.innerHTML = `<img src="${imgSrc}" alt="User Profile" class="rounded-circle" width="36" height="36">`;
                            const nameSpan = document.querySelector('.user-profile span');
                            if (nameSpan) nameSpan.textContent = toTitleCase(user.displayName || user.email || 'Admin');

                            // --- SUBSCRIPTIONS ---
                            onValue(ref(db, 'transactionsRef'), snap => {
                                window.adminTransactions = Object.values(snap.val() || {});
                                updateAdminStats();
                            });
                            onValue(ref(db, 'cashFlowRef'), snap => {
                                const data = snap.val() || {};
                                window.adminAccounting = [];
                                if(data.expenses) Object.values(data.expenses).forEach(v => window.adminAccounting.push({...v, type:'Expense'}));
                                if(data.bank) Object.values(data.bank).forEach(v => window.adminAccounting.push({...v, type:'BankLodgement'}));
                                if(data.excess) Object.values(data.excess).forEach(v => window.adminAccounting.push({...v, type:'ExcessCash'}));
                                updateAdminStats();
                            });
                            onValue(ref(db, 'stockRef'), snap => {
                                window.adminProducts = Object.values(snap.val() || {});
                                updateAdminStats();
                            });
                            onValue(ref(db, 'customersRef'), snap => {
                                window.adminCustomers = Object.values(snap.val() || {});
                                updateAdminStats();
                            });
                            onValue(ref(db, 'pendingOrdersRef'), snap => {
                                const data = snap.val() || {};
                                window.adminPendingOrders = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
                                renderPendingOrdersTable();
                            });
                        } else {
                            window.location.href = '../timson-pos-login/index.html';
                        }
                    });

                    function updateAdminStats() {
                        const today = new Date().toISOString().split('T')[0];
                        const reportDateInput = document.getElementById('adminReportDate');
                        if(reportDateInput && !reportDateInput.value) reportDateInput.value = today;
                        const targetDate = reportDateInput ? reportDateInput.value : today;

                        // 1. Stat Cards
                        let todaySales = 0;
                        window.adminTransactions.forEach(t => {
                            const d = (t.date || t.timestamp || '');
                            if(d.startsWith(today)) todaySales += (Number(t.totalAmount) || 0);
                        });
                        const todaySalesEl = document.getElementById('statTodaySales');
                        if(todaySalesEl) todaySalesEl.innerText = `₦${todaySales.toLocaleString(undefined, {minimumFractionDigits:2})}`;

                        const totalProductsEl = document.getElementById('statTotalProducts');
                        if(totalProductsEl) totalProductsEl.innerText = window.adminProducts.length.toLocaleString();

                        const lowStockCount = window.adminProducts.filter(p => Number(p.StockQuantity) <= (Number(p.ReorderLevel) || 10)).length;
                        const lowStockEl = document.getElementById('statLowStock');
                        if(lowStockEl) lowStockEl.innerText = lowStockCount.toLocaleString();

                        const totalDebt = window.adminCustomers.reduce((sum, c) => sum + (Number(c.balanceOwed) || 0), 0);
                        const totalDebtEl = document.getElementById('statTotalDebt');
                        if(totalDebtEl) totalDebtEl.innerText = `₦${totalDebt.toLocaleString(undefined, {minimumFractionDigits:2})}`;

                        // 2. Daily Account Summary
                        let dRev = 0, dExp = 0, dBank = 0, dNyp = 0, dExcess = 0;
                        let gtCash = 0, gtPos = 0, gtTransfer = 0;

                        window.adminTransactions.forEach(t => {
                            const d = (t.date || t.timestamp || '');
                            if(d.startsWith(targetDate)) {
                                const amt = Number(t.totalAmount) || 0;
                                if (t.paymentMethod === "NYP Debt Payment") {
                                    dNyp += amt;
                                } else {
                                    dRev += amt;
                                    if (t.splitPayments) {
                                        gtCash += (Number(t.splitPayments.cash) || 0) - (Number(t.changeProvided) || 0);
                                        gtPos += (Number(t.splitPayments.pos) || 0);
                                        gtTransfer += (Number(t.splitPayments.transfer) || 0);
                                    } else {
                                        const pm = (t.paymentMethod || '').toLowerCase();
                                        if (pm === 'cash') gtCash += amt;
                                        else if (pm === 'pos') gtPos += amt;
                                        else if (pm === 'bank transfer' || pm === 'transfer') gtTransfer += amt;
                                        else gtCash += amt; // Fallback
                                    }
                                }
                            }
                        });

                        window.adminAccounting.forEach(a => {
                            const d = (a.date || '');
                            if(d.startsWith(targetDate)) {
                                if (a.type === 'Expense') dExp += (Number(a.amount) || 0);
                                else if (a.type === 'BankLodgement') dBank += (Number(a.amount) || 0);
                                else if (a.type === 'ExcessCash') dExcess += (Number(a.amount) || 0);
                            }
                        });

                        if(document.getElementById('admDailyRevenue')) document.getElementById('admDailyRevenue').innerText = `₦${dRev.toLocaleString()}`;
                        if(document.getElementById('admDailyExpenses')) document.getElementById('admDailyExpenses').innerText = `₦${dExp.toLocaleString()}`;
                        if(document.getElementById('admDailyBank')) document.getElementById('admDailyBank').innerText = `₦${dBank.toLocaleString()}`;
                        if(document.getElementById('admDailyCash')) document.getElementById('admDailyCash').innerText = `₦${(gtCash + dNyp + dExcess - dExp - dBank).toLocaleString()}`;
                        
                        // New Breakdown fields
                        if(document.getElementById('admCashTotal')) document.getElementById('admCashTotal').innerText = `₦${(gtCash + dNyp).toLocaleString()}`;
                        if(document.getElementById('admPosTotal')) document.getElementById('admPosTotal').innerText = `₦${gtPos.toLocaleString()}`;
                        if(document.getElementById('admTransferTotal')) document.getElementById('admTransferTotal').innerText = `₦${gtTransfer.toLocaleString()}`;

                        // 3. Recent Transactions Table
                        const txnTable = document.getElementById('adminRecentTxnTable');
                        if(txnTable) {
                            const recent = [...window.adminTransactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
                            txnTable.innerHTML = recent.map(t => {
                                const time = new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                                const dateStr = new Date(t.date).toLocaleDateString();
                                const firstItem = (t.items && t.items[0]) ? t.items[0].name : 'Payment/Debt';
                                const itemCount = (t.items && t.items.length > 1) ? ` +${t.items.length-1} more` : '';
                                
                                return `
                                    <tr>
                                        <td class="ps-4 text-muted fw-medium">#${t.refNo || 'TXN'}</td>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                <div class="bg-light rounded-circle p-2 me-3 product-icon-wrapper">
                                                    <i class="fas fa-shopping-cart text-primary"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-0 fw-bold text-dark fs-6">${firstItem}${itemCount}</h6>
                                                    <small class="text-muted">${toTitleCase(t.customerName || 'Walk-in')}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span class="fw-bold text-dark">₦${(Number(t.totalAmount)||0).toLocaleString()}</span></td>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(t.cashierName||'Staff')}&background=4361ee&color=fff" class="rounded-circle me-2" width="24" height="24">
                                                <span class="small fw-medium text-muted">${toTitleCase(t.cashierName || 'Staff')}</span>
                                            </div>
                                        </td>
                                        <td class="pe-4 text-end"><span class="small text-muted">${dateStr}<br>${time}</span></td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="5" class="text-center py-4">No transactions found</td></tr>';
                        }

                        // 4. Inventory Alerts Table
                        const alertTable = document.getElementById('adminInventoryAlertsTable');
                        const notificationList = document.getElementById('adminNotificationList');
                        const notificationBadge = document.getElementById('notificationBadge');

                        if(alertTable) {
                            const lowStock = window.adminProducts
                                .filter(p => Number(p.StockQuantity) <= (Number(p.ReorderLevel) || 10))
                                .sort((a,b) => Number(a.StockQuantity) - Number(b.StockQuantity))
                                .slice(0, 10);
                            
                            alertTable.innerHTML = lowStock.map(p => {
                                const reorderLevel = Number(p.ReorderLevel) || 10;
                                const isCritical = Number(p.StockQuantity) <= (reorderLevel / 2);
                                const badgeClass = isCritical ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning';
                                const badgeText = isCritical ? 'Critical' : 'Low';
                                return `
                                    <tr>
                                        <td class="ps-4"><span class="fw-medium text-dark">${p.Product || 'Unknown'}</span></td>
                                        <td><span class="fw-bold ${isCritical ? 'text-danger' : 'text-warning'}">${p.StockQuantity}</span></td>
                                        <td class="text-muted">${reorderLevel}</td>
                                        <td class="pe-4"><span class="badge ${badgeClass} rounded-pill px-2 py-1">${badgeText}</span></td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="4" class="text-center py-4">No low stock alerts</td></tr>';

                            // 5. Update Notifications Dropdown
                            if (notificationList) {
                                // Keep the header
                                const headerHtml = `<li><h6 class="dropdown-header">Notifications</h6></li>`;
                                const notificationItems = lowStock.map(p => {
                                    return `<li><a class="dropdown-item py-2" href="stock-control.html">Low stock: ${p.Product} (${p.StockQuantity} left)</a></li>`;
                                }).join('');
                                
                                notificationList.innerHTML = headerHtml + (notificationItems || '<li><a class="dropdown-item py-2 text-muted" href="#">No new alerts</a></li>');
                                
                                if (notificationBadge) {
                                    notificationBadge.innerText = lowStock.length;
                                    notificationBadge.classList.toggle('d-none', lowStock.length === 0);
                                }
                            }
                        }

                        // 6. Update Charts
                        if (typeof window.initAdminDashboardCharts === 'function') {
                            window.initAdminDashboardCharts();
                        }
                        if (typeof window.refreshAnalytics === 'function') {
                            window.refreshAnalytics();
                        }
                    }

                    document.getElementById('adminReportDate')?.addEventListener('change', updateAdminStats);

                    function renderPendingOrdersTable() {
                        const tableBody = document.getElementById('adminPendingOrdersTable');
                        const badge = document.getElementById('pendingOrdersBadge');
                        if (!tableBody) return;

                        if (badge) {
                            const count = window.adminPendingOrders.length;
                            badge.innerHTML = `<span class="status-pulse"></span>${count} Floor Orders`;
                            badge.className = count > 0 ? "badge bg-warning-subtle text-dark border border-warning-subtle rounded-pill px-4 py-2 fw-bold shadow-sm" : "badge bg-light text-muted rounded-pill px-4 py-2";
                        }

                        if (window.adminPendingOrders.length === 0) {
                            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted opacity-50"><i class="fas fa-check-circle fa-2x mb-3 d-block text-success"></i>All queues are clear</td></tr>';
                            return;
                        }

                        tableBody.innerHTML = window.adminPendingOrders.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(o => {
                            const timeStr = new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return `
                                <tr class="pending-row">
                                    <td class="ps-4">
                                        <div class="fw-bold text-dark mb-0">#${o.id.slice(-6).toUpperCase()}</div>
                                        <div class="text-muted" style="font-size: 0.65rem;">UID: ${o.id.slice(0,8)}</div>
                                    </td>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <div class="bg-primary-subtle text-primary rounded-circle p-2 me-2" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center;">
                                                <i class="fas fa-user-tag fs-xs"></i>
                                            </div>
                                            <span class="small fw-bold text-dark">${o.sellerName || 'Staff'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="fw-bold text-dark">${o.customerName || 'Walk-in'}</span>
                                    </td>
                                    <td>
                                        <span class="fw-extrabold text-primary">₦${(Number(o.totalDue) || 0).toLocaleString()}</span>
                                        <div class="text-muted small" style="font-size: 0.7rem;">${(o.items||[]).length} items included</div>
                                    </td>
                                    <td>
                                        <span class="badge bg-light text-muted border px-2 py-1"><i class="fas fa-clock me-1"></i>${timeStr}</span>
                                    </td>
                                    <td class="pe-4 text-end">
                                        <div class="btn-group shadow-sm action-btn-group">
                                            <button class="btn btn-white text-info" onclick="window.viewPendingOrder('${o.id}')" title="Inspect Order"><i class="fas fa-search-plus me-1"></i>View</button>
                                            <button class="btn btn-white text-danger" onclick="window.cancelPendingOrder('${o.id}')" title="Void Order"><i class="fas fa-ban me-1"></i>Void</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }

                    window.viewPendingOrder = function(orderId) {
                        const order = window.adminPendingOrders.find(o => o.id === orderId);
                        if (!order) return;
                        
                        // Use existing showAdminReceipt logic but adapt for pending order
                        const pseudoTxn = {
                            refNo: `PEND-${order.id.slice(-6).toUpperCase()}`,
                            date: order.timestamp,
                            cashierName: 'PENDING',
                            customerName: order.customerName || 'Walk-in',
                            items: order.items,
                            totalAmount: order.totalDue,
                            paymentMethod: 'PENDING CHECKOUT'
                        };
                        window.showAdminReceipt(pseudoTxn);
                    };

                    window.cancelPendingOrder = async function(orderId) {
                        const order = window.adminPendingOrders.find(o => o.id === orderId);
                        if (!order) return;

                        // Modern confirmation prompt via sweetalert would be better but we use native for now with better messaging
                        const confirmed = confirm(
                            "--- ADMINISTRATIVE ACTION REQUIRED ---\n\n" +
                            `Transaction: #${order.id.slice(-6).toUpperCase()}\n` +
                            `Customer: ${order.customerName || 'Walk-in'}\n\n` +
                            "Are you sure you want to VOID this floor order? This action cannot be undone and will be logged to system security."
                        );
                        
                        if (!confirmed) return;

                        try {
                            // 1. Log the cancellation with precise metadata
                            await push(ref(db, 'systemLogs/cancellations'), {
                                orderId: orderId,
                                orderRef: order.id.slice(-6).toUpperCase(),
                                customerName: order.customerName || 'Walk-in',
                                sellerName: order.sellerName || 'Unknown',
                                totalAmount: order.totalDue,
                                adminName: auth.currentUser?.displayName || auth.currentUser?.email || 'System Administrator',
                                timestamp: Date.now(),
                                reason: "Voided by Admin via Queue Control"
                            });

                            // 2. Remove the order
                            await remove(ref(db, `pendingOrdersRef/${orderId}`));
                            
                            // Success indicator
                            console.log(`Order #${orderId} successfully voided.`);
                        } catch (e) {
                            console.error("Cancellation failure:", e);
                            alert("Critical error: Unable to void transaction. Access denied or connection lost.");
                        }
                    };
                });
            });
        });
    })();

    // 1. Sidebar Toggle Logic
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');

    if (sidebarCollapse) {
        sidebarCollapse.addEventListener('click', function () {
            sidebar.classList.toggle('active');
            content.classList.toggle('active');

            // Toggle overlay on mobile
            if (window.innerWidth <= 991.98) {
                document.body.classList.toggle('sidebar-open');
            }
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 991.98 && document.body.classList.contains('sidebar-open')) {
            if (!sidebar.contains(e.target) && !sidebarCollapse.contains(e.target)) {
                sidebar.classList.remove('active');
                content.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function () {
        if (window.innerWidth > 991.98) {
            sidebar.classList.remove('active');
            content.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    });

    // 2. Chart.js Implementation for Sales Chart
    let salesChart;

    window.initAdminDashboardCharts = function() {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;
        
        const filter = document.getElementById('chartFilter');
        const type = filter ? filter.value : 'weekly';
        
        const transactions = window.adminTransactions || [];
        const { labels, data } = aggregateSalesData(transactions, type);

        if (salesChart) {
            salesChart.destroy();
        }

        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gross Sales',
                    data: data,
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    borderColor: '#4361ee', // Primary color
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#4361ee',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4 // Smooth curves
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        titleFont: { size: 13, weight: '500', family: "'Inter', sans-serif" },
                        bodyFont: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
                        displayColors: false,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => '₦' + context.parsed.y.toLocaleString()
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [4, 4], color: '#e2e8f0', drawBorder: false },
                        ticks: {
                            padding: 10,
                            callback: (value) => value >= 1000 ? '₦' + (value / 1000) + 'k' : '₦' + value
                        }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { padding: 10 }
                    }
                }
            }
        });
    };

    function aggregateSalesData(transactions, type) {
        const now = new Date();
        let labels = [];
        let data = [];

        if (type === 'daily') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString([], { weekday: 'short' }));
                
                const dayTotal = transactions
                    .filter(t => (t.date || t.timestamp || '').startsWith(dateStr) && t.paymentMethod !== "NYP Debt Payment")
                    .reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
                data.push(dayTotal);
            }
        } else if (type === 'weekly') {
            for (let i = 3; i >= 0; i--) {
                const start = new Date(now);
                start.setDate(now.getDate() - ((i + 1) * 7));
                const end = new Date(now);
                end.setDate(now.getDate() - (i * 7));
                labels.push(`Week ${4-i}`);
                const weekTotal = transactions
                    .filter(t => {
                        const d = new Date(t.date || t.timestamp);
                        return d >= start && d < end && t.paymentMethod !== "NYP Debt Payment";
                    })
                    .reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
                data.push(weekTotal);
            }
        } else {
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                labels.push(d.toLocaleDateString([], { month: 'short' }));
                const monthTotal = transactions
                    .filter(t => {
                        const td = new Date(t.date || t.timestamp);
                        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() && t.paymentMethod !== "NYP Debt Payment";
                    })
                    .reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
                data.push(monthTotal);
            }
        }
        return { labels, data };
    }

    // Initial load
    window.initAdminDashboardCharts();

    // Handle Filter Change
    document.getElementById('chartFilter')?.addEventListener('change', window.initAdminDashboardCharts);

    // Logout button logic (fires across all admin pages)
    const logoutBtnElem = document.getElementById('logoutBtn');
    if (logoutBtnElem) {
        logoutBtnElem.addEventListener('click', (e) => {
            e.preventDefault();
            import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js").then(({getAuth, signOut}) => {
                const auth = getAuth();
                signOut(auth).then(() => {
                    window.location.href = '../timson-pos-login/index.html';
                });
            });
        });
    }
});

// --- Global Transaction Search for Admin ---
window.searchAdminGlobalTxn = async function() {
    const input = document.getElementById('globalTxnSearchInput');
    if (!input || !input.value.trim()) return;
    const q = input.value.trim().toLowerCase();
    const btn = input.nextElementSibling;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js");
        const { getApp } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js");
        const app = getApp();
        const db = getDatabase(app);
        
        const snap = await get(ref(db, 'transactionsRef'));
        const data = snap.val() || {};
        const transactionsData = Object.entries(data).map(([k,v]) => ({id:k, ...v}));
        
        const matched = transactionsData.find(t => (t.refNo || '').toLowerCase() === q || (t.refNo || '').toLowerCase().includes(q));
        if (matched) {
            window.showAdminReceipt(matched);
            input.value = '';
        } else {
            alert('Transaction not found! Please check the Reference Number.');
        }
    } catch (e) {
        console.error(e);
        alert('Error searching transaction. Make sure Firebase is initialized correctly.');
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

window.showAdminReceipt = function(transaction) {
    const receiptContent = document.getElementById('receiptContent');
    if(!receiptContent) return;
    const date = new Date(transaction.date).toLocaleString();

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
                    <span class="fw-bold text-dark">${transaction.splitPayments ? Object.entries(transaction.splitPayments || {}).filter(([_,v]) => v > 0).map(([k]) => k.toUpperCase()).join(', ') : (transaction.paymentMethod || 'UNKNOWN')}</span>
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
            </div>
            
            <div class="mt-5 text-center">
                <div class="receipt-footer-brand">Powered By Bath Technologies</div>
            </div>
        </div>
    `;

    new bootstrap.Modal(document.getElementById('receiptModal')).show();
};

window.printAdminReceiptModal = function() {
    const printContent = document.getElementById('receiptContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; background: #fff; color: #333; margin: 0; padding: 0; }
                    .receipt-paper { background: #fff; padding: 20px; position: relative; width: 100%; max-width: 400px; margin: 0 auto; }
                    .receipt-header-title { font-weight: 800; letter-spacing: -0.5px; color: #1a1a1a; font-size: 1.25rem; }
                    .receipt-label { font-size: 0.65rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
                    .receipt-value { font-size: 0.85rem; font-weight: 600; color: #1a1a1a; }
                    .premium-separator { border-top: 1px dashed #ccc; margin: 15px 0; }
                    .receipt-table th { font-size: 0.7rem; font-weight: 700; color: #666; text-transform: uppercase; border: none !important; border-bottom: 1px solid #eee !important; }
                    .receipt-table td { font-size: 0.8rem; padding: 12px 5px !important; border: none !important; }
                    .receipt-total-banner { background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #eee; }
                    .receipt-footer-brand { font-size: 0.6rem; letter-spacing: 1px; color: #999; text-transform: uppercase; }
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                ${printContent}
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

