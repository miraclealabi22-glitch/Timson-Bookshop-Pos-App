 // Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyACgmBzV74SwJLVyUCMdN1xOxZjMI4UgCg",
  authDomain: "posapp-ed05a.firebaseapp.com",
  databaseURL: "https://posapp-ed05a-default-rtdb.firebaseio.com",
  projectId: "posapp-ed05a",
  storageBucket: "posapp-ed05a.firebasestorage.app",
  messagingSenderId: "486175914054",
  appId: "1:486175914054:web:b2f7d71ae98c451f417247"
};

// [...] (Firebase Initialization remains the same at the top)

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
window.dataArray = [];

onValue(ref(database, "stockRef"), (snapshot) => {
    const data = snapshot.val();
    window.dataArray = data ? Object.entries(data).map(([key, value]) => ({ id: key, ...value })) : [];
    renderTable(window.dataArray);
});

// Helper: Format stock balance for display
const formatStockBalance = (totalUnits, item) => {
    const unitName = item.baseUnit || 'pcs';
    if (!item.config?.allowCarton || !item.cartonSize) return `${Math.round(totalUnits).toLocaleString()} ${unitName}`;
    
    const cSize = Number(item.cartonSize);
    const cartons = Math.floor(totalUnits / cSize);
    const units = Math.round(totalUnits % cSize);
    
    let text = cartons > 0 ? `${cartons} ctn${cartons > 1 ? 's' : ''}` : '';
    if (units > 0) text += (text ? ' ' : '') + `${units} ${unitName}`;
    return text || `0 ${unitName}`;
};

const renderTable = (items = []) => {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    tableBody.innerHTML = items.map(element => `
        <tr>
            <td class="ps-3 text-muted fw-medium">${element.barcode || "N/A"}</td>
            <td class="fw-bold text-dark">${element.Product || ""}</td>
            <td><span class="badge bg-light text-dark border">${element.ProductCategory || ""}</span></td>
            <td class="text-muted">${formatStockBalance(Number(element.StockQuantity || 0), element)}</td>
            <td class="fw-bold text-primary">₦${(Number(element.SellingPrice) || 0).toLocaleString()}</td>
            <td>
                <span class="status-indicator status-${(element.StockQuantity || 0) > (element.ReorderLevel || 10) ? 'in-stock' : 'low-stock'}"></span>
                ${(element.StockQuantity || 0) > (element.ReorderLevel || 10) ? 'Healthy' : 'Low Stock'}
            </td>
            <td class="text-end pe-3 action-btns">
                <button class="btn btn-light text-primary border-0 shadow-sm" onclick="openEditModal('${element.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-light text-danger border-0 shadow-sm" onclick="deleteFunction('${element.id}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>`).join('');
};

// UI Toggles & Calculator Logic
const setupUIEvents = (prefix = "") => {
    const getEl = (id) => document.getElementById(prefix + id);
    
    // Toggle Sections
    const toggleConfig = (toggleId, targetId) => {
        const toggle = getEl(toggleId);
        const target = getEl(targetId);
        if(toggle && target) {
            toggle.addEventListener('change', () => target.classList.toggle('d-none', !toggle.checked));
        }
    };

    toggleConfig('allowCarton', 'cartonConfigFields');
    toggleConfig('allowPack', 'packConfigFields');

    // Stock Calculator (Add only)
    if(prefix === "") {
        ['stockCartons', 'stockPacks', 'stockUnits', 'cartonSize', 'packSize', 'allowCarton', 'allowPack'].forEach(id => {
            getEl(id).addEventListener('input', () => {
                const cSize = Number(getEl('cartonSize').value) || 0;
                const pSize = Number(getEl('packSize').value) || 0;
                const ctns = getEl('allowCarton').checked ? Number(getEl('stockCartons').value) : 0;
                const pcks = getEl('allowPack').checked ? Number(getEl('stockPacks').value) : 0;
                const units = Number(getEl('stockUnits').value) || 0;
                
                const total = (ctns * cSize) + (pcks * pSize) + units;
                document.getElementById('totalBaseUnitsDisplay').innerText = total.toLocaleString();
                document.getElementById('finalTotalStock').value = total;
            });
        });
    }
};

// Initialize listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupUIEvents(""); // For Add Modal
    setupUIEvents("edit"); // For Edit Modal
});

window.saveProductBtn = () => {
    const getValue = (id) => document.getElementById(id).value;
    const isChecked = (id) => document.getElementById(id).checked;

    const data = {
        Product: getValue('productName').trim(),
        ProductCategory: getValue('productCategory'),
        baseUnit: getValue('baseUnit') || 'pcs',
        barcode: getValue('barcode').trim(),
        ReorderLevel: Number(getValue('reorderLevel')),
        CostPrice: Number(getValue('costPrice')),
        SellingPrice: Number(getValue('sellingPrice')),
        StockQuantity: Number(getValue('finalTotalStock')),
        cartonSize: Number(getValue('cartonSize')),
        packSize: Number(getValue('packSize')),
        config: {
            allowCarton: isChecked('allowCarton'),
            allowPack: isChecked('allowPack'),
            allowHalf: isChecked('allowHalf'),
            allowQuarter: isChecked('allowQuarter'),
            allowDozen: isChecked('allowDozen')
        },
        overrides: {
            cartonPrice: getValue('cartonPriceOverride') ? Number(getValue('cartonPriceOverride')) : null,
            packPrice: getValue('packPriceOverride') ? Number(getValue('packPriceOverride')) : null,
            dozenPrice: getValue('dozenPriceOverride') ? Number(getValue('dozenPriceOverride')) : null
        }
    };

    if (!data.Product || !data.SellingPrice) {
        alert("Product Name and Selling Price are required.");
        return;
    }

    push(ref(database, 'stockRef'), data)
        .then(() => {
            alert("Product saved successfully!");
            document.getElementById('addProductForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
        });
};

window.openEditModal = (id) => {
    const product = window.dataArray.find(item => item.id === id);
    if (!product) return;

    const setVal = (id, val) => document.getElementById('edit' + id).value = val ?? '';
    const setChecked = (id, val) => {
        const el = document.getElementById('edit' + id);
        el.checked = !!val;
        // Trigger visibility
        const target = document.getElementById('edit' + id.replace('allow','').toLowerCase() + 'ConfigFields');
        if(target) target.classList.toggle('d-none', !el.checked);
    };

    setVal('ProductId', id);
    setVal('ProductName', product.Product);
    setVal('ProductCategory', product.ProductCategory);
    setVal('BaseUnit', product.baseUnit);
    setVal('Barcode', product.barcode);
    setVal('ReorderLevel', product.ReorderLevel);
    setVal('CostPrice', product.CostPrice);
    setVal('SellingPrice', product.SellingPrice);
    setVal('StockQuantity', product.StockQuantity);
    setVal('CartonSize', product.cartonSize);
    setVal('PackSize', product.packSize);

    setChecked('AllowCarton', product.config?.allowCarton);
    setChecked('AllowPack', product.config?.allowPack);
    setChecked('AllowHalf', product.config?.allowHalf);
    setChecked('AllowQuarter', product.config?.allowQuarter);
    setChecked('AllowDozen', product.config?.allowDozen);

    setVal('CartonPriceOverride', product.overrides?.cartonPrice);
    setVal('PackPriceOverride', product.overrides?.packPrice);
    setVal('DozenPriceOverride', product.overrides?.dozenPrice);

    window.currentEditId = id;
    new bootstrap.Modal(document.getElementById('editProductModal')).show();
};

window.updateProduct = () => {
    const getVal = (id) => document.getElementById('edit' + id).value;
    const isChecked = (id) => document.getElementById('edit' + id).checked;

    const updatedData = {
        Product: getVal('ProductName').trim(),
        ProductCategory: getVal('ProductCategory'),
        baseUnit: getVal('BaseUnit') || 'pcs',
        barcode: getVal('Barcode').trim(),
        ReorderLevel: Number(getVal('ReorderLevel')),
        CostPrice: Number(getVal('CostPrice')),
        SellingPrice: Number(getVal('SellingPrice')),
        cartonSize: Number(getVal('CartonSize')),
        packSize: Number(getVal('PackSize')),
        config: {
            allowCarton: isChecked('AllowCarton'),
            allowPack: isChecked('AllowPack'),
            allowHalf: isChecked('AllowHalf'),
            allowQuarter: isChecked('AllowQuarter'),
            allowDozen: isChecked('AllowDozen')
        },
        overrides: {
            cartonPrice: getVal('CartonPriceOverride') ? Number(getVal('CartonPriceOverride')) : null,
            packPrice: getVal('PackPriceOverride') ? Number(getVal('PackPriceOverride')) : null,
            dozenPrice: getVal('DozenPriceOverride') ? Number(getVal('DozenPriceOverride')) : null
        }
    };

    update(ref(database, "stockRef/" + window.currentEditId), updatedData)
        .then(() => {
            alert("Product updated successfully");
            bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide();
        });
};

window.deleteFunction = (id) => {
    if (confirm('Delete this product permanently?')) {
        remove(ref(database, 'stockRef/' + id)).then(() => alert('Deleted.'));
    }
};

window.searchProduct = () => {
    const query = document.getElementById('searchInput').value.toLowerCase();
    renderTable(window.dataArray.filter(item => item.Product.toLowerCase().includes(query)));
};

document.getElementById('saveProductBtn').addEventListener('click', saveProductBtn);

