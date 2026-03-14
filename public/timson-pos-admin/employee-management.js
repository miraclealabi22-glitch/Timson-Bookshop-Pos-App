document.addEventListener('DOMContentLoaded', () => {
    const employees = [
        {id: 'E001', name: 'Jane Doe', role: 'Cashier', status: 'Active'},
        {id: 'E002', name: 'John Smith', role: 'Seller', status: 'Active'}
    ];

    const tableBody = document.querySelector('#employeeTable tbody');
    const renderTable = () => {
        tableBody.innerHTML = '';
        employees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td>${emp.role}</td>
                <td>${emp.status}</td>
                <td><button class="btn btn-sm btn-outline-danger btn-delete" data-id="${emp.id}">Delete</button></td>
            `;
            tableBody.appendChild(tr);
        });
    };

    renderTable();

    document.getElementById('addEmployeeBtn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
        modal.show();
    });

    document.getElementById('employeeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('empName').value.trim();
        const role = document.getElementById('empRole').value.trim();
        const status = document.getElementById('empStatus').value;
        const newEmp = {
            id: 'E' + String(employees.length + 1).padStart(3, '0'),
            name,
            role,
            status
        };
        employees.push(newEmp);
        renderTable();
        bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
        e.target.reset();
    });

    tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const id = e.target.getAttribute('data-id');
            const idx = employees.findIndex(emp => emp.id === id);
            if (idx !== -1) {
                employees.splice(idx, 1);
                renderTable();
            }
        }
    });
});