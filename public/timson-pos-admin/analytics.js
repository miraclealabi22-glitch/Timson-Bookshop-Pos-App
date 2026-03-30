
document.addEventListener("DOMContentLoaded", function () {

    // Global Chart.js configuration
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b'; // Tailwind slate-500

    window.refreshAnalytics = function() {
        const transactions = window.adminTransactions || [];
        if (transactions.length === 0) return;

        const filter = document.getElementById('trendChartFilter')?.value || 'monthly';
        renderTrendChart(filter);
        renderTopProductsDoughnut();
        updateKPICards();
        renderBestProductsTable();
        renderTopCategoriesTable();
        updateCustomerMetricCards();
    };

    // --- Chart 1: Revenue Overview Trend (Line Chart) ---
    const renderTrendChart = (type) => {
        const ctx = document.getElementById('mainSalesTrendChart');
        if (!ctx) return;

        const transactions = window.adminTransactions || [];
        const { labels, dataCurrent, dataPrevious } = aggregateTrendData(transactions, type);

        // Destroy old chart instance if applying filter
        if (window.trendChartInstance) {
            window.trendChartInstance.destroy();
        }

        window.trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Current Period',
                        data: dataCurrent,
                        borderColor: '#4361ee', // Primary
                        backgroundColor: 'rgba(67, 97, 238, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#4361ee',
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4 // Smooth curves
                    },
                    {
                        label: 'Previous Period',
                        data: dataPrevious,
                        borderColor: '#cbd5e1', // Slate-300
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        titleFont: { size: 13, weight: '500' },
                        bodyFont: { size: 14, weight: 'bold' },
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': ₦' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            borderDash: [4, 4],
                            color: '#e2e8f0',
                            drawBorder: false
                        },
                        ticks: {
                            padding: 10,
                            callback: function (value) {
                                if (value >= 1000) return '₦' + (value / 1000) + 'k';
                                return '₦' + value;
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: { padding: 10 }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    };

    function aggregateTrendData(transactions, type) {
        const now = new Date();
        let labels = [];
        let dataCurrent = [];
        let dataPrevious = [];

        if (type === 'daily') {
            // Hours of today vs yesterday
            for (let i = 0; i < 24; i += 4) {
                const label = `${String(i).padStart(2, '0')}:00`;
                labels.push(label);
                
                const today = new Date(now).setHours(0,0,0,0);
                const yesterday = new Date(now).setDate(now.getDate() - 1);
                const yesterdayStart = new Date(yesterday).setHours(0,0,0,0);

                const getHourTotal = (baseDate, startHour) => {
                    return transactions.filter(t => {
                        const d = new Date(t.date || t.timestamp);
                        const base = new Date(baseDate);
                        return d.getDate() === base.getDate() && 
                               d.getMonth() === base.getMonth() &&
                               d.getFullYear() === base.getFullYear() &&
                               d.getHours() >= startHour && d.getHours() < startHour + 4 &&
                               t.paymentMethod !== "NYP Debt Payment";
                    }).reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
                };

                dataCurrent.push(getHourTotal(today, i));
                dataPrevious.push(getHourTotal(yesterdayStart, i));
            }
        } else if (type === 'weekly') {
            // Last 7 days vs Previous 7 days
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString([], { weekday: 'short' }));
                
                const currentTotal = transactions.filter(t => {
                    const td = new Date(t.date || t.timestamp);
                    return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() && t.paymentMethod !== "NYP Debt Payment";
                }).reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
                
                const prevD = new Date(d);
                prevD.setDate(prevD.getDate() - 7);
                const previousTotal = transactions.filter(t => {
                    const td = new Date(t.date || t.timestamp);
                    return td.getDate() === prevD.getDate() && td.getMonth() === prevD.getMonth() && td.getFullYear() === prevD.getFullYear() && t.paymentMethod !== "NYP Debt Payment";
                }).reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);

                dataCurrent.push(currentTotal);
                dataPrevious.push(previousTotal);
            }
        } else {
            // Last 4-5 weeks vs Previous 4-5 weeks
            for (let i = 4; i >= 0; i--) {
                labels.push(`Week ${5-i}`);
                const startC = new Date(now); startC.setDate(now.getDate() - ((i+1)*7));
                const endC = new Date(now); endC.setDate(now.getDate() - (i*7));
                const startP = new Date(startC); startP.setDate(startP.getDate() - 28);
                const endP = new Date(endC); endP.setDate(endP.getDate() - 28);

                const getPeriodTotal = (s, e) => transactions.filter(t => {
                    const d = new Date(t.date || t.timestamp);
                    return d >= s && d < e && t.paymentMethod !== "NYP Debt Payment";
                }).reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);

                dataCurrent.push(getPeriodTotal(startC, endC));
                dataPrevious.push(getPeriodTotal(startP, endP));
            }
        }
        return { labels, dataCurrent, dataPrevious };
    }

    // --- Chart 2: Top Selling Products (Doughnut) ---
    let doughnutChart;
    const renderTopProductsDoughnut = () => {
        const doughnutCtx = document.getElementById('topProductsDoughnut');
        if (!doughnutCtx) return;

        const transactions = window.adminTransactions || [];
        const productStats = {};
        
        transactions.forEach(t => {
            (t.items || []).forEach(item => {
                const name = item.name || 'Unknown';
                productStats[name] = (productStats[name] || 0) + (Number(item.qty) || 0);
            });
        });

        const sorted = Object.entries(productStats).sort((a,b) => b[1] - a[1]).slice(0, 4);
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);
        const totalUnits = data.reduce((a,b) => a+b, 0);
        const percentages = data.map(v => totalUnits > 0 ? Math.round((v / totalUnits) * 100) : 0);

        if (doughnutChart) doughnutChart.destroy();

        doughnutChart = new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: percentages,
                    backgroundColor: ['#4361ee', '#6366f1', '#10b981', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 10,
                        callbacks: {
                            label: (context) => ` ${context.label}: ${context.parsed}%`
                        }
                    }
                }
            }
        });

        // Update Center Text
        const centerHeading = doughnutCtx.nextElementSibling.querySelector('h4');
        if (centerHeading) centerHeading.innerText = totalUnits >= 1000 ? (totalUnits/1000).toFixed(1) + 'k' : totalUnits;

        // Update Legend
        const legendContainer = doughnutCtx.closest('.card-body').querySelector('.border-top');
        if (legendContainer) {
            legendContainer.innerHTML = sorted.map((s, i) => {
                const colors = ['text-primary', 'text-indigo', 'text-success', 'text-warning'];
                const hex = ['#4361ee', '#6366f1', '#10b981', '#f59e0b'];
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fs-sm fw-medium text-dark"><i class="fas fa-circle me-2" style="color: ${hex[i]}"></i>${s[0]}</span>
                        <span class="fs-sm text-muted">${percentages[i]}%</span>
                    </div>
                `;
            }).join('');
        }
    };

    const updateKPICards = () => {
        const transactions = window.adminTransactions || [];
        const grossRev = transactions.filter(t => t.paymentMethod !== "NYP Debt Payment").reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
        const totalOrders = transactions.length;
        const avgOrder = totalOrders > 0 ? (grossRev / totalOrders) : 0;

        const revEl = document.querySelector('.col-lg-3:nth-child(1) h3');
        if (revEl) revEl.innerText = `₦${grossRev.toLocaleString()}`;

        const ordersEl = document.querySelector('.col-lg-3:nth-child(2) h3');
        if (ordersEl) ordersEl.innerText = totalOrders.toLocaleString();

        const avgEl = document.querySelector('.col-lg-3:nth-child(3) h3');
        if (avgEl) avgEl.innerText = `₦${avgOrder.toLocaleString(undefined, {maximumFractionDigits:2})}`;
    };

    const renderBestProductsTable = () => {
        const tbody = document.querySelector('.table-hover tbody');
        if (!tbody) return;

        const transactions = window.adminTransactions || [];
        const stats = {};
        transactions.forEach(t => {
            (t.items || []).forEach(item => {
                if(!stats[item.name]) stats[item.name] = { qty: 0, rev: 0 };
                stats[item.name].qty += (Number(item.qty) || 0);
                stats[item.name].rev += (Number(item.qty) || 0) * (Number(item.price) || 0);
            });
        });

        const sorted = Object.entries(stats).sort((a,b) => b[1].rev - a[1].rev).slice(0, 5);
        tbody.innerHTML = sorted.map(([name, data]) => `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary-light text-primary rounded d-flex align-items-center justify-content-center me-3 table-avatar-img">
                            <i class="fas fa-book"></i></div>
                        <div>
                            <span class="fw-bold text-dark d-block">${name}</span>
                        </div>
                    </div>
                </td>
                <td class="fw-medium text-dark">${data.qty.toLocaleString()}</td>
                <td class="fw-bold text-dark">₦${data.rev.toLocaleString()}</td>
                <td class="pe-4"><span class="trend-up fw-bold"><i class="fas fa-caret-up me-1"></i>--</span></td>
            </tr>
        `).join('');
    };

    const renderTopCategoriesTable = () => {
        const table = document.querySelector('.col-md-6.col-xl-3:nth-child(2) tbody');
        if (!table) return;

        const transactions = window.adminTransactions || [];
        const catStats = {};
        transactions.forEach(t => {
            (t.items || []).forEach(item => {
                const prod = (window.adminProducts || []).find(p => p.Product === item.name);
                const cat = prod?.ProductCategory || 'Other';
                catStats[cat] = (catStats[cat] || 0) + (Number(item.qty) || 0) * (Number(item.price) || 0);
            });
        });

        const sorted = Object.entries(catStats).sort((a,b) => b[1] - a[1]).slice(0, 4);
        table.innerHTML = sorted.map(([cat, rev], i) => `
            <tr>
                <td class="ps-4 fw-medium text-dark">${i+1}. ${cat}</td>
                <td class="pe-4 text-end fw-bold text-dark">₦${rev.toLocaleString()}</td>
            </tr>
        `).join('') || '<tr><td colspan="2" class="text-center py-3 text-muted">No data available</td></tr>';
    };

    const updateCustomerMetricCards = () => {
        const table = document.querySelector('.col-md-6.col-xl-3:nth-child(3) tbody');
        if (!table) return;

        const transactions = window.adminTransactions || [];
        const uniqueCustomers = new Set(transactions.map(t => t.customerId).filter(Boolean));
        const returningRate = transactions.length > 0 ? Math.round((uniqueCustomers.size / transactions.length) * 100) : 0;
        
        let avgItems = 0;
        transactions.forEach(t => avgItems += (t.items?.length || 0));
        avgItems = transactions.length > 0 ? (avgItems / transactions.length).toFixed(1) : 0;

        table.innerHTML = `
            <tr><td class="ps-4 text-muted">Active Customers</td><td class="pe-4 text-end fw-bold text-primary">${uniqueCustomers.size}</td></tr>
            <tr><td class="ps-4 text-muted">Avg. Items/Order</td><td class="pe-4 text-end fw-bold text-dark">${avgItems}</td></tr>
            <tr><td class="ps-4 text-muted">Busiest Day</td><td class="pe-4 text-end fw-bold text-dark">Today</td></tr>
            <tr><td class="ps-4 text-muted">Busiest Time</td><td class="pe-4 text-end fw-bold text-dark">1:00 PM</td></tr>
        `;
    };

    // Filter Listeners
    const trendFilter = document.getElementById('trendChartFilter');
    if (trendFilter) trendFilter.addEventListener('change', (e) => renderTrendChart(e.target.value));

    // Initial check (in case data is already there)
    window.refreshAnalytics();
});
