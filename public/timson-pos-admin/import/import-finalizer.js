import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

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
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = '../../timson-pos-login/index.html';
        } else {
            const adminName = user.displayName || user.email.split('@')[0];
            const profilePics = document.getElementById('profilePics');
            if(profilePics) profilePics.innerHTML = `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(adminName)}&background=4361ee&color=fff" class="rounded-circle" width="36" height="36">`;
            document.getElementById('navAdminName').textContent = toTitleCase(adminName);
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../../timson-pos-login/index.html');
    });

    document.getElementById('sidebarCollapse')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('content').classList.toggle('active');
    });

    // Initialize with one row
    addProductRow();
});

function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

window.addProductRow = function() {
    const tbody = document.getElementById('productRows');
    const rowId = Date.now();
    const tr = document.createElement('tr');
    tr.id = `row-${rowId}`;
    tr.innerHTML = `
        <td>
            <input type="text" class="form-control form-control-sm mb-1 prod-name" placeholder="Product Name" oninput="calculateImportCost()">
            <input type="text" class="form-control form-control-sm small prod-model" placeholder="Model (Optional)" oninput="calculateImportCost()">
        </td>
        <td><input type="number" class="form-control form-control-sm prod-usd" value="0" step="0.01" oninput="calculateImportCost()"></td>
        <td><input type="number" class="form-control form-control-sm prod-size" value="1" oninput="calculateImportCost()"></td>
        <td><input type="number" class="form-control form-control-sm prod-qty" value="0" oninput="calculateImportCost()"></td>
        <td>
            <div class="d-flex flex-wrap gap-1">
                <input type="number" class="form-control form-control-sm prod-sell-ctn" placeholder="CTN Price" style="width: 70px;" oninput="calculateImportCost()">
                <input type="number" class="form-control form-control-sm prod-sell-dzn" placeholder="DZN Price" style="width: 70px;" oninput="calculateImportCost()">
                <input type="number" class="form-control form-control-sm prod-sell-half" placeholder="1/2 Price" style="width: 70px;" oninput="calculateImportCost()">
                <input type="number" class="form-control form-control-sm prod-sell" placeholder="PC Price" style="width: 70px;" oninput="calculateImportCost()">
            </div>
        </td>
        <td>
            <div class="row-profit profit-badge bg-light text-muted">Calculating...</div>
        </td>
        <td>
            <button class="btn btn-link text-danger p-0 btn-remove" onclick="removeRow('${rowId}')">
                <i class="fas fa-times-circle"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    calculateImportCost();
}

window.removeRow = function(id) {
    const row = document.getElementById(`row-${id}`);
    if (row) row.remove();
    calculateImportCost();
}

window.calculateImportCost = function() {
    const rate = Number(document.getElementById('exchangeRate').value) || 0;
    const shipping = Number(document.getElementById('expShipping').value) || 0;
    const clearing = Number(document.getElementById('expClearing').value) || 0;
    const transport = Number(document.getElementById('expTransport').value) || 0;
    const other = 0; // Keeping it simple

    const totalExpenses = shipping + clearing + transport + other;
    document.getElementById('dispTotalExpenses').textContent = `₦${totalExpenses.toLocaleString()}`;

    const rows = document.querySelectorAll('#productRows tr');
    let totalAllPieces = 0;
    let totalGoodsCostAll = 0;

    const data = [];

    rows.forEach(row => {
        const name = row.querySelector('.prod-name').value;
        const usd = Number(row.querySelector('.prod-usd').value) || 0;
        const size = Number(row.querySelector('.prod-size').value) || 0;
        const qty = Number(row.querySelector('.prod-qty').value) || 0;
        const selling = Number(row.querySelector('.prod-sell').value) || 0;

        const pieces = qty * size;
        const baseCostPerPiece = usd * rate;
        const rowGoodsCost = baseCostPerPiece * pieces;

        totalAllPieces += pieces;
        totalGoodsCostAll += rowGoodsCost;

        data.push({ row, name, usd, size, qty, selling, pieces, baseCostPerPiece, rowGoodsCost });
    });

    const expensePerPiece = totalAllPieces > 0 ? totalExpenses / totalAllPieces : 0;
    document.getElementById('dispExpPerPiece').textContent = `₦${expensePerPiece.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    let analysisHtml = "";
    data.forEach(item => {
        const sellPiece = Number(item.row.querySelector('.prod-sell').value) || 0;
        const sellCtn = Number(item.row.querySelector('.prod-sell-ctn').value) || 0;
        const sellDzn = Number(item.row.querySelector('.prod-sell-dzn').value) || 0;
        const sellHalf = Number(item.row.querySelector('.prod-sell-half').value) || 0;

        const realCostPerPiece = item.baseCostPerPiece + expensePerPiece;
        const suggested = realCostPerPiece * 1.3;
        const profit = sellPiece > 0 ? sellPiece - realCostPerPiece : 0;
        const indicator = item.row.querySelector('.row-profit');

        if (sellPiece > 0) {
            if (profit >= 0) {
                indicator.textContent = `+₦${profit.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                indicator.className = "row-profit profit-badge bg-success-light";
            } else {
                indicator.textContent = `-₦${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                indicator.className = "row-profit profit-badge bg-danger-light";
            }
        } else {
            indicator.textContent = "Set Piece Price";
            indicator.className = "row-profit profit-badge bg-light text-muted";
        }

        analysisHtml += `
            <tr>
                <td class="fw-bold text-dark">
                    ${toTitleCase(item.name)}
                    <div class="small text-muted fw-normal no-print">CTN: ₦${sellCtn.toLocaleString()} | DZN: ₦${sellDzn.toLocaleString()} | 1/2: ₦${sellHalf.toLocaleString()}</div>
                </td>
                <td class="text-center">${item.pieces.toLocaleString()}</td>
                <td class="text-end">₦${item.baseCostPerPiece.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-end fw-bold text-primary">₦${realCostPerPiece.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-end text-muted small">₦${suggested.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-end fw-bold text-success">₦${sellPiece.toLocaleString()}</td>
                <td class="text-center">
                    <span class="profit-badge ${profit >= 0 ? 'bg-success-light' : 'bg-danger-light'}">
                        ${profit >= 0 ? '+' : '-'}${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </td>
            </tr>
        `;
    });

    document.getElementById('analysisRows').innerHTML = analysisHtml;
    
    // Update Summaries
    document.getElementById('grandTotalPieces').textContent = totalAllPieces.toLocaleString();
    document.getElementById('grandGoodsCost').textContent = `₦${totalGoodsCostAll.toLocaleString()}`;
    document.getElementById('grandExpenses').textContent = `₦${totalExpenses.toLocaleString()}`;
    document.getElementById('grandFinalCost').textContent = `₦${(totalGoodsCostAll + totalExpenses).toLocaleString()}`;
}

window.printReport = function() {
    document.getElementById('printBatchDate').textContent = `Report Generated: ${new Date().toLocaleString()}`;
    window.print();
}
