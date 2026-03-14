document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('salesReportsChart');
    if (!ctx) return;

    const generateData = (days) => {
        const labels = [];
        const data = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(Math.floor(Math.random() * 5000) + 1000); // mock sales
        }
        return {labels, data};
    };

    let reportsChart;
    const renderChart = (range) => {
        const days = range === '7days' ? 7 : range === '30days' ? 30 : range === '90days' ? 90 : 365;
        const {labels, data} = generateData(days);
        if (reportsChart) reportsChart.destroy();
        reportsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Sales',
                    data,
                    backgroundColor: '#4361ee'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    };

    const rangeSelect = document.getElementById('reportRange');
    rangeSelect.addEventListener('change', (e) => {
        renderChart(e.target.value);
    });

    renderChart(rangeSelect.value);

    // table placeholder
    const tableContainer = document.getElementById('reportTableContainer');
    const buildTable = () => {
        const tbl = document.createElement('table');
        tbl.className = 'table table-striped';
        tbl.innerHTML = `
            <thead><tr><th>Date</th><th>Total Sales</th><th>Orders</th></tr></thead>
            <tbody></tbody>`;
        const tbody = tbl.querySelector('tbody');
        const days = rangeSelect.value === '7days' ? 7 : rangeSelect.value === '30days' ? 30 : rangeSelect.value === '90days' ? 90 : 365;
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${d.toLocaleDateString()}</td><td>$${(Math.random()*5000+1000).toFixed(2)}</td><td>${Math.floor(Math.random()*200+20)}</td>`;
            tbody.appendChild(row);
        }
        tableContainer.innerHTML = '';
        tableContainer.appendChild(tbl);
    };

    // rerender table when range changes
    rangeSelect.addEventListener('change', buildTable);
    buildTable();
});