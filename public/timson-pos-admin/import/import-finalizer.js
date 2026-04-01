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
            <input type="text" class="form-control form-control-sm small prod-model" placeholder="Model" oninput="calculateImportCost()">
        </td>
        <td><input type="number" class="form-control form-control-sm prod-ctns" value="0" min="0" oninput="calculateImportCost()"></td>
        <td>
            <input type="number" class="form-control form-control-sm prod-pcs-ctn" value="1" min="1" oninput="calculateImportCost()" title="PCS per Carton">
            <input type="number" class="form-control form-control-sm prod-pcs-pk mt-1 small" value="1" min="1" oninput="calculateImportCost()" placeholder="PCS/PK" title="PCS per Pack">
        </td>
        <td><input type="number" class="form-control form-control-sm prod-usd-pc" value="0" step="0.01" min="0" oninput="calculateImportCost()"></td>
        <td class="text-muted small fw-bold"><span class="disp-usd-ctn">0.00</span></td>
        <td class="text-primary fw-bold"><span class="disp-tot-pcs">0</span></td>
        <td class="text-dark fw-bold"><span class="disp-tot-usd">0.00</span></td>
        <td class="bg-light fw-bold text-center"><span class="disp-landed-pc">₦0.00</span></td>
        <td>
            <div class="d-flex flex-wrap gap-1">
                <div class="unit-price-box">
                    <input type="number" class="form-control form-control-sm prod-sell-ctn" placeholder="CTN ₦" style="width: 80px;" oninput="calculateImportCost()">
                    <span class="sug-label sug-ctn text-muted">Sug: ₦0</span>
                    <span class="cost-label cost-ctn text-danger small" style="font-size: 0.55rem; display: block;">Cost: ₦0</span>
                </div>
                <div class="unit-price-box">
                    <input type="number" class="form-control form-control-sm prod-sell-half" placeholder="1/2 ₦" style="width: 80px;" oninput="calculateImportCost()">
                    <span class="sug-label sug-half text-muted">Sug: ₦0</span>
                    <span class="cost-label cost-half text-danger small" style="font-size: 0.55rem; display: block;">Cost: ₦0</span>
                </div>
                <div class="unit-price-box">
                    <input type="number" class="form-control form-control-sm prod-sell-dzn" placeholder="DZN ₦" style="width: 80px;" oninput="calculateImportCost()">
                    <span class="sug-label sug-dzn text-muted">Sug: ₦0</span>
                    <span class="cost-label cost-dzn text-danger small" style="font-size: 0.55rem; display: block;">Cost: ₦0</span>
                </div>
                <div class="unit-price-box">
                    <input type="number" class="form-control form-control-sm prod-sell-pc" placeholder="PC ₦" style="width: 80px;" oninput="calculateImportCost()">
                    <span class="sug-label sug-pc text-muted">Sug: ₦0</span>
                    <span class="cost-label cost-pc text-danger small" style="font-size: 0.55rem; display: block;">Cost: ₦0</span>
                </div>
            </div>
            <div class="pricing-insight mt-2 p-2 rounded bg-light border small">
                <div class="d-flex justify-content-between align-items-center">
                    <span>Expected Profit / CTN: <strong class="text-success disp-profit-ctn">₦0</strong></span>
                    <span class="badge border bg-white text-dark disp-margin-badge">0% Margin</span>
                </div>
                <div class="low-profit-warning text-danger fw-bold mt-1 d-none"><i class="fas fa-exclamation-triangle"></i> Margin below target!</div>
            </div>
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
    const totalExpenses = Number(document.getElementById('totalExpenses').value) || 0;
    const targetMargin = Number(document.getElementById('profitMargin').value) || 0;

    const rows = document.querySelectorAll('#productRows tr');
    let grandTotalPieces = 0;
    let grandTotalUSD = 0;
    let grandExpectedProfit = 0;

    // First pass: Calculate row basics and sums
    const rowData = [];
    rows.forEach(row => {
        const ctns = Number(row.querySelector('.prod-ctns').value) || 0;
        const pcsCtn = Number(row.querySelector('.prod-pcs-ctn').value) || 0;
        const pcsPk = Number(row.querySelector('.prod-pcs-pk').value) || 1;
        const usdPc = Number(row.querySelector('.prod-usd-pc').value) || 0;
        
        const totPieces = ctns * pcsCtn;
        const totUSD = totPieces * usdPc;
        const usdCtn = usdPc * pcsCtn;

        grandTotalPieces += totPieces;
        grandTotalUSD += totUSD;

        // Update basic row displays
        row.querySelector('.disp-usd-ctn').textContent = usdCtn.toLocaleString(undefined, {minimumFractionDigits: 2});
        row.querySelector('.disp-tot-pcs').textContent = totPieces.toLocaleString();
        row.querySelector('.disp-tot-usd').textContent = totUSD.toLocaleString(undefined, {minimumFractionDigits: 2});

        rowData.push({ row, ctns, pcsCtn, pcsPk, usdPc, totPieces, totUSD, usdCtn });
    });

    const expensePerPiece = grandTotalPieces > 0 ? totalExpenses / grandTotalPieces : 0;
    document.getElementById('dispExpPerPiece').textContent = `₦${expensePerPiece.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    const grandGoodsCostNaira = grandTotalUSD * rate;
    const grandFinalCost = grandGoodsCostNaira + totalExpenses;

    // Update Summaries
    if (document.getElementById('grandTotalUSD')) document.getElementById('grandTotalUSD').textContent = `$${grandTotalUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if (document.getElementById('grandGoodsCost')) document.getElementById('grandGoodsCost').textContent = `₦${grandGoodsCostNaira.toLocaleString()}`;
    if (document.getElementById('grandExpenses')) document.getElementById('grandExpenses').textContent = `₦${totalExpenses.toLocaleString()}`;
    if (document.getElementById('grandFinalCost')) document.getElementById('grandFinalCost').textContent = `₦${grandFinalCost.toLocaleString()}`;
    if (document.getElementById('grandTotalPieces')) document.getElementById('grandTotalPieces').textContent = grandTotalPieces.toLocaleString();
    if (document.getElementById('dispExRateSummary')) document.getElementById('dispExRateSummary').textContent = `Rate: @ ${rate.toLocaleString()}`;

    // Second pass: Calculate Landed Cost and Profit
    let analysisHtml = "";
    rowData.forEach(item => {
        const costPcInNaira = item.usdPc * rate;
        const realLandedPc = costPcInNaira + expensePerPiece;
        
        item.row.querySelector('.disp-landed-pc').textContent = `₦${realLandedPc.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // Suggested & Cost Prices Logic
        const sugPc = Math.ceil((realLandedPc * (1 + targetMargin / 100)) / 10) * 10;
        const realCtnCost = realLandedPc * item.pcsCtn;
        const realHalfCost = realCtnCost / 2;
        const realDznCost = realLandedPc * 12;

        const sugCtn = sugPc * item.pcsCtn;
        const sugHalf = sugCtn / 2;
        const sugDzn = sugPc * 12;

        // Update Labels
        item.row.querySelector('.sug-pc').textContent = `Sug: ₦${sugPc.toLocaleString()}`;
        item.row.querySelector('.sug-ctn').textContent = `Sug: ₦${sugCtn.toLocaleString()}`;
        item.row.querySelector('.sug-half').textContent = `Sug: ₦${sugHalf.toLocaleString()}`;
        item.row.querySelector('.sug-dzn').textContent = `Sug: ₦${sugDzn.toLocaleString()}`;

        item.row.querySelector('.cost-pc').textContent = `Cost: ₦${realLandedPc.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
        item.row.querySelector('.cost-ctn').textContent = `Cost: ₦${realCtnCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
        item.row.querySelector('.cost-half').textContent = `Cost: ₦${realHalfCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
        item.row.querySelector('.cost-dzn').textContent = `Cost: ₦${realDznCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`;

        // Get actual values
        const sellPc = Number(item.row.querySelector('.prod-sell-pc').value) || 0;
        const sellCtn = Number(item.row.querySelector('.prod-sell-ctn').value) || 0;
        const sellHalf = Number(item.row.querySelector('.prod-sell-half').value) || 0;
        const sellDzn = Number(item.row.querySelector('.prod-sell-dzn').value) || 0;

        const profitPc = sellPc > 0 ? sellPc - realLandedPc : 0;
        const actualMargin = realLandedPc > 0 ? (profitPc / realLandedPc) * 100 : 0;
        const totProfit = profitPc * item.totPieces;
        grandExpectedProfit += totProfit;

        // Update Pricing Insight UI
        item.row.querySelector('.disp-profit-ctn').textContent = `₦${(profitPc * item.pcsCtn).toLocaleString()}`;
        item.row.querySelector('.disp-margin-badge').textContent = `${Math.round(actualMargin)}% Margin`;
        
        // Color coding inputs based on targets
        let hasLoss = false;
        ['pc', 'ctn', 'dzn', 'half'].forEach(u => {
            const input = item.row.querySelector(`.prod-sell-${u}`);
            const val = Number(input.value) || 0;
            if (val === 0) return;
            
            const sug = (u === 'pc') ? sugPc : (u === 'ctn' ? sugCtn : (u === 'half' ? sugHalf : sugDzn));
            const cost = (u === 'pc') ? realLandedPc : (u === 'ctn' ? realCtnCost : (u === 'half' ? realHalfCost : realDznCost));

            if (val < cost - 1) { // 1 naira grace for rounding
                input.style.border = "2px solid #ef4444";
                input.style.color = "#ef4444";
                input.style.backgroundColor = "#fff1f2";
                hasLoss = true;
            } else if (val < sug) {
                input.style.border = "1px solid #f59e0b";
                input.style.color = "#d97706";
                input.style.backgroundColor = "#fffbeb";
            } else {
                input.style.border = "1px solid #10b981";
                input.style.color = "#059669";
                input.style.backgroundColor = "#f0fdf4";
            }
        });

        const warning = item.row.querySelector('.low-profit-warning');
        if (hasLoss) {
            warning.classList.remove('d-none');
            warning.innerHTML = `<i class="fas fa-exclamation-circle"></i> CRITICAL: Selling below cost!`;
            warning.className = "low-profit-warning text-danger fw-bold mt-1";
        } else if (sellPc > 0 && actualMargin < targetMargin) {
            warning.classList.remove('d-none');
            warning.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Margin below target!`;
            warning.className = "low-profit-warning text-warning fw-bold mt-1";
        } else {
            warning.classList.add('d-none');
        }

        // Analysis Table Rows
        const name = item.row.querySelector('.prod-name').value || "Unnamed Product";
        const model = item.row.querySelector('.prod-model').value;
        
        analysisHtml += `
            <tr>
                <td>
                    <div class="fw-bold text-dark">${toTitleCase(name)}</div>
                    ${model ? `<div class="small text-muted">${model}</div>` : ''}
                    <div class="small text-muted no-print">
                        CTN: ₦${sellCtn.toLocaleString()} | 1/2: ₦${sellHalf.toLocaleString()} | DZN: ₦${sellDzn.toLocaleString()}
                    </div>
                </td>
                <td class="text-center">
                    <span class="fw-bold">${item.totPieces.toLocaleString()}</span>
                    <div class="small text-muted">${item.ctns} CTNS x ${item.pcsCtn}</div>
                </td>
                <td class="text-end">$${item.usdPc.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-end fw-bold">$${item.totUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-end bg-light fw-bold text-primary">₦${realLandedPc.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-end fw-bold text-success">₦${sellPc.toLocaleString()}</td>
                <td class="text-center">
                    <span class="profit-badge ${profitPc >= 0 ? 'bg-success-light' : 'bg-danger-light'}">
                        ${profitPc >= 0 ? 'PROFIT' : 'LOSS'} (₦${Math.abs(profitPc).toLocaleString()})
                    </span>
                    <div class="small text-muted mt-1">Total: ₦${totProfit.toLocaleString()}</div>
                </td>
            </tr>
        `;
    });

    if (document.getElementById('analysisRows')) document.getElementById('analysisRows').innerHTML = analysisHtml;
    
    // Add expected profit to summary if possible
    const summaryRow = document.querySelector('.row.g-4.mt-2');
    if (summaryRow && !document.getElementById('grandExpectedProfit')) {
        const col = document.createElement('div');
        col.className = "col-md-2";
        col.innerHTML = `
            <div class="card border-0 shadow-sm p-4 h-100 text-center bg-success text-white" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;">
                <h6 class="text-white-50 small fw-bold text-uppercase mb-2">Expected Profit</h6>
                <h3 class="fw-bold mb-0 text-white" id="grandExpectedProfit">₦0.00</h3>
                <small class="text-white-50">Total Batch Margin</small>
            </div>
        `;
        // Insert before result info
        const totalItemsCol = document.getElementById('grandTotalPieces').parentElement.parentElement;
        summaryRow.insertBefore(col, totalItemsCol);
    }
    
    if (document.getElementById('grandExpectedProfit')) {
        document.getElementById('grandExpectedProfit').textContent = `₦${grandExpectedProfit.toLocaleString()}`;
    }
}

window.printReport = function() {
    document.getElementById('printBatchDate').textContent = `Generated: ${new Date().toLocaleString()}`;
    window.print();
}
