import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyACgmBzV74SwJLVyUCMdN1xOxZjMI4UgCg",
    authDomain: "posapp-ed05a.firebaseapp.com",
    databaseURL: "https://posapp-ed05a-default-rtdb.firebaseio.com",
    projectId: "posapp-ed05a",
    storageBucket: "posapp-ed05a.firebasestorage.app",
    messagingSenderId: "486175914054",
    appId: "1:486175914054:web:b2f7d71ae98c451f417247"
};

// Main App instance for Database reads/writes (and existing logged-in admin access)
const mainApp = initializeApp(firebaseConfig);
const db = getDatabase(mainApp);

// Secondary App instance solely for creating users without logging the current Admin out!
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let employees = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Fetch live employee logic
    loadData();

    // 2. Setup Modals & Buttons
    document.getElementById('addEmployeeBtn').addEventListener('click', () => {
        document.getElementById('employeeForm').reset();
        document.getElementById('empModalError').classList.add('d-none');
        document.getElementById('empSubmitBtn').innerHTML = '<span>Create Account</span>';
        document.getElementById('empSubmitBtn').disabled = false;
        new bootstrap.Modal(document.getElementById('employeeModal')).show();
    });

    document.getElementById('employeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('empName').value.trim();
        const username = document.getElementById('empUsername').value.trim();
        const email = document.getElementById('empEmail').value.trim();
        const password = document.getElementById('empPassword').value;
        const role = document.getElementById('empRole').value;
        const status = document.getElementById('empStatus').value;
        
        const errorDiv = document.getElementById('empModalError');
        const submitBtn = document.getElementById('empSubmitBtn');
        
        errorDiv.classList.add('d-none');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Creating...';
        
        try {
            // Authenticate with a backend-only email to enable username login
            const authEmail = username.toLowerCase().replace(/\s+/g, '') + '@timson.local';
            
            // Use SECONDARY auth app to create user without overriding the main app session
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
            const uid = userCredential.user.uid;
            
            // Immediately sign out this secondary instance so it can be reused safely later without issues
            await secondaryAuth.signOut();
            
            // Save to DB via Main app
            const empData = {
                id: uid,
                name,
                username,
                email,
                role,
                status,
                createdAt: new Date().toISOString()
            };
            
            await set(ref(db, `usersRef/${uid}`), empData);
            
            bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
            e.target.reset(); // clear form
            
        } catch(err) {
            console.error("Employee Creation Failed:", err);
            errorDiv.textContent = err.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Account</span>';
        }
    });

    document.querySelector('#employeeTable tbody').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const uid = e.target.getAttribute('data-id');
            if(confirm("Are you sure you want to delete this employee's data? Note: This deletes their database record but due to Firebase security, full account deletion might require Cloud Functions.")) {
                try {
                    await remove(ref(db, `usersRef/${uid}`));
                    alert("Employee data removed.");
                } catch(err) {
                    alert("Failed to delete: " + err.message);
                }
            }
        }
    });
});

function loadData() {
    onValue(ref(db, 'usersRef'), snapshot => {
        employees = [];
        const data = snapshot.val() || {};
        Object.entries(data).forEach(([key, val]) => {
            employees.push({ ...val, id: key });
        });
        renderTable();
    });
}

function renderTable() {
    const tableBody = document.querySelector('#employeeTable tbody');
    if(!tableBody) return;
    tableBody.innerHTML = '';
    
    if(employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No employees found.</td></tr>';
        return;
    }

    employees.forEach(emp => {
        // Only show actual users, potentially exclude the master admin if you prefer, but we show all for now
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-muted small">${(emp.id||'').substring(0,8)}...</td>
            <td class="fw-bold">${emp.username || emp.name || emp.email || 'N/A'}</td>
            <td><span class="badge ${getRoleBadgeClass(emp.role)}">${emp.role || 'User'}</span></td>
            <td><span class="badge ${emp.status === 'Active' ? 'bg-success' : 'bg-secondary'}">${emp.status || 'Active'}</span></td>
            <td><button class="btn btn-sm btn-outline-danger btn-delete" data-id="${emp.id}"><i class="fas fa-trash data-id="${emp.id}" pointer-events-none"></i> Delete</button></td>
        `;
        tableBody.appendChild(tr);
    });
}

function getRoleBadgeClass(role) {
    if(!role) return 'bg-secondary';
    const r = role.toLowerCase();
    if(r === 'admin') return 'bg-primary';
    if(r === 'cashier') return 'bg-info text-dark';
    if(r === 'seller') return 'bg-warning text-dark';
    return 'bg-secondary';
}