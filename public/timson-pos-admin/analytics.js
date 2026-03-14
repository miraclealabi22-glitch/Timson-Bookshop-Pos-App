document.addEventListener("DOMContentLoaded", function () {

    // Global Chart.js configuration
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b'; // Tailwind slate-500

    // --- Chart 1: Revenue Overview Trend (Line Chart) ---
    const renderTrendChart = (type) => {
        const ctx = document.getElementById('mainSalesTrendChart');
        if (!ctx) return;

        let labels, dataCurrent, dataPrevious;

        // Mock data logic based on selection "daily", "weekly", "monthly"
        if (type === 'daily') {
            labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
            dataCurrent = [120, 80, 450, 1200, 1500, 800, 300];
            dataPrevious = [90, 60, 380, 1050, 1300, 750, 280];
        } else if (type === 'weekly') {
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            dataCurrent = [2400, 2100, 2800, 3200, 3900, 4500, 4100];
            dataPrevious = [2200, 1900, 2600, 2900, 3400, 4200, 3800];
        } else {
            // monthly default
            labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
            dataCurrent = [12500, 15300, 14200, 18900, 11400]; // 5th week partial
            dataPrevious = [11200, 14500, 13800, 17200, 16800];
        }

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
                                return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
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
                                if (value >= 1000) return '$' + (value / 1000) + 'k';
                                return '$' + value;
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

    // Initialize with default
    renderTrendChart('monthly');

    // Filter Listener
    const trendChartFilter = document.getElementById('trendChartFilter');
    if (trendChartFilter) {
        trendChartFilter.addEventListener('change', (e) => {
            renderTrendChart(e.target.value);
        });
    }

    // --- Chart 2: Top Selling Products (Doughnut) ---
    const doughnutCtx = document.getElementById('topProductsDoughnut');
    if (doughnutCtx) {
        new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: ['Atomic Habits', 'The Great Gatsby', 'Moleskine Notebook', 'Dune (Sci-Fi)'],
                datasets: [{
                    data: [38, 25, 22, 15],
                    backgroundColor: [
                        '#4361ee', // Primary
                        '#6366f1', // Indigo
                        '#10b981', // Success
                        '#f59e0b', // Warning
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Thin ring
                plugins: {
                    legend: {
                        display: false // Using custom HTML legend below the chart
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 10,
                        callbacks: {
                            label: function (context) {
                                return ' ' + context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }

});
