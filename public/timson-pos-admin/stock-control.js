document.addEventListener("DOMContentLoaded", function () {

    // --- Chart.js: Stock Movement Analytics ---
    const ctx = document.getElementById('stockChart');
    if (ctx) {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b'; // Tailwind slate-500

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [
                    {
                        label: 'Units Sold',
                        data: [420, 380, 550, 480],
                        backgroundColor: '#4361ee', // Primary
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Units Restocked',
                        data: [150, 600, 100, 800],
                        backgroundColor: '#10b981', // Success
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
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
                            padding: 20,
                            font: { weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        titleFont: { size: 13, weight: '500' },
                        bodyFont: { size: 14, weight: 'bold' },
                        cornerRadius: 8
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
                        ticks: { padding: 10 }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            padding: 10,
                            font: { weight: '500' }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    }


    // --- Update Stock Modal Logic ---
    const updateStockModal = document.getElementById('updateStockModal');
    const addedQuantityInput = document.getElementById('addedQuantity');
    const newTotalStockSpan = document.getElementById('newTotalStock');

    let currentBaseStock = 0;

    if (updateStockModal) {
        // Modal Event: When modal is about to be shown
        updateStockModal.addEventListener('show.bs.modal', function (event) {
            // Button that triggered the modal
            const button = event.relatedTarget;

            // Extract info from data-* attributes
            const productName = button.getAttribute('data-product');
            const currentStock = parseInt(button.getAttribute('data-current'), 10);
            const recStock = parseInt(button.getAttribute('data-rec'), 10);

            // Set base stock state
            currentBaseStock = currentStock;

            // Update modal UI elements
            document.getElementById('modalProductName').textContent = productName;
            document.getElementById('modalCurrentStock').textContent = currentStock;
            document.getElementById('modalRecStock').textContent = recStock;

            // Reset inputs
            addedQuantityInput.value = '';
            newTotalStockSpan.textContent = currentStock;
        });

        // Event: Use recommended link clicked
        const useRecommendedLink = document.getElementById('useRecommendedLink');
        if (useRecommendedLink) {
            useRecommendedLink.addEventListener('click', function () {
                const recStock = document.getElementById('modalRecStock').textContent;
                addedQuantityInput.value = recStock;
                // Dispatch input event to recalculate total
                addedQuantityInput.dispatchEvent(new Event('input'));
            });
        }

        // Event: Real-time calculation of new total quantity
        if (addedQuantityInput) {
            addedQuantityInput.addEventListener('input', function () {
                const addedVal = parseInt(this.value, 10) || 0;
                newTotalStockSpan.textContent = currentBaseStock + addedVal;
            });
        }

        // Event: Confirm Update
        const confirmStockUpdateBtn = document.getElementById('confirmStockUpdateBtn');
        if (confirmStockUpdateBtn) {
            confirmStockUpdateBtn.addEventListener('click', function () {
                const form = document.getElementById('updateStockForm');

                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }

                // Gather data for mock backend update
                const addedAmount = parseInt(addedQuantityInput.value, 10);
                const finalAmount = currentBaseStock + addedAmount;
                const product = document.getElementById('modalProductName').textContent;

                // Mock Firebase/Backend call snippet
                /*
                db.collection("products").doc(productId).update({
                    stockQuantity: finalAmount,
                    lastRestockedAt: new Date().toISOString()
                }).then(() => {
                    close modal and refresh UI
                });
                */

                console.log(`Updated "${product}": Added ${addedAmount}. New Total: ${finalAmount}`);

                // Hide modal and show success (mocked)
                const modalInstance = bootstrap.Modal.getInstance(updateStockModal);
                modalInstance.hide();

                alert(`Successfully restocked ${addedAmount} units of ${product}!`);
            });
        }
    }
});
