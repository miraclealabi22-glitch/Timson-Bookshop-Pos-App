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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
window.stock = [];

onValue(ref(database, "stockRef"), (snapshot) => {
  let data = snapshot.val();
  if (!data) {
    window.dataArray = [];
    renderTable(window.dataArray);
    return;
  }

  window.dataArray = Object.entries(data).map(([key, value]) => ({
    id: key,
    ...value
  }));

  renderTable(window.dataArray);
});

const renderTable = (items = []) => {
  const tableBody = document.getElementById('tableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  for (let i = 0; i < items.length; i++) {
    const element = items[i];
    const cartonQuantity = Number(element.cartonQuantity ?? 0);
    const cartonSize = Number(element.cartonSize ?? 0);
    const unitQuantity = Number(element.unitQuantity ?? 0);

    const totalUnits = cartonQuantity * cartonSize + unitQuantity;
    let stockBalanceText = `${totalUnits.toLocaleString()} pcs`;

    if (cartonSize > 0) {
      const fullCartons = Math.floor(totalUnits / cartonSize);
      const remainingUnits = totalUnits % cartonSize;
      stockBalanceText = `${fullCartons} ctn${fullCartons === 1 ? '' : 's'}`;
      if (remainingUnits > 0) {
        stockBalanceText += ` ${remainingUnits} pcs`;
      }
      if (fullCartons === 0 && remainingUnits === 0) {
        stockBalanceText = '0 pcs';
      }
    }

    tableBody.innerHTML += `
      <tr>
        <td class="ps-3 text-muted fw-medium">${element.barcode || ""}</td>
        <td class="fw-bold text-dark">${element.Product || ""}</td>
        <td><span class="badge bg-light text-dark border">${element.ProductCategory || ""}</span></td>
        <td class="text-muted">${stockBalanceText}</td>
        <td class="fw-bold text-dark">₦${element.SellingPrice ?? 0}</td>
        <td><span class="status-indicator status-in-stock"></span> In Stock</td>
        <td class="text-end pe-3 action-btns">
          <button class="btn btn-light text-primary border-0 shadow-sm" title="Edit Product" data-bs-toggle="modal" data-bs-target="#editProductModal" onclick="openEditModal('${element.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-light text-danger border-0 shadow-sm" title="Delete Product" onclick="deleteFunction('${element.id}')"><i class="fas fa-trash-alt"></i></button>
        </td>
      </tr>`;
  }
};

const saveProductBtn = () => {
  const productName = document.getElementById('productName').value.trim().toLowerCase();
  const productCategory = document.getElementById('productCategory').value.trim().toLowerCase();
  const costPrice = document.getElementById('costPrice').value;
  const sellingPrice = document.getElementById('sellingPrice').value;
  const stockQuantity = document.getElementById('stockQuantity').value;
  const reorderLevel = document.getElementById('reorderLevel').value;
  const barcode = document.getElementById('barcode').value.trim();

  const cartonQuantity = document.getElementById('cartonQuantity').value;
  const cartonSize = document.getElementById('cartonSize').value;
  const unitQuantity = document.getElementById('unitQuantity').value;
  const cartonSellingPrice = document.getElementById('cartonSellingPrice').value;
  const pricePerDozen = document.getElementById('pricePerDozen').value;
  const pricePerHalf = document.getElementById('pricePerHalf').value;
  const pricePerQuarter = document.getElementById('pricePerQuarter').value;
  const pricePerUnit = document.getElementById('pricePerUnit').value;

  if (!productName || !productCategory || !costPrice || !sellingPrice || !stockQuantity || !reorderLevel || !barcode) return;

  const stockAdjustment = {
    Product: productName,
    ProductCategory: productCategory,
    CostPrice: Number(costPrice),
    SellingPrice: Number(sellingPrice),
    StockQuantity: Number(stockQuantity),
    ReorderLevel: Number(reorderLevel),
    barcode,
    cartonQuantity: Number(cartonQuantity),
    cartonSize: Number(cartonSize),
    unitQuantity: Number(unitQuantity),
    cartonSellingPrice: Number(cartonSellingPrice),
    pricePerDozen: Number(pricePerDozen),
    pricePerHalf: Number(pricePerHalf),
    pricePerQuarter: Number(pricePerQuarter),
    pricePerUnit: Number(pricePerUnit)
  };

  window.stock.push(stockAdjustment);

  const stockSave = ref(database, 'stockRef');
  push(stockSave, stockAdjustment)
    .then(() => {
      document.getElementById('alertArea').innerHTML = `<div class="alert alert-primary" role="alert">Stock item saved successfully!</div>`;
      document.getElementById('addProductForm').reset();
    })
    .catch((error) => {
      document.getElementById('alertArea').innerHTML = `<div class="alert alert-warning" role="alert">Fail to Add!</div>`;
      console.error("Error saving product:", error);
    });
};

window.searchProduct = () => {
  const searchInput = document.getElementById('searchInput').value.toLowerCase();
  const dataFilter = Array.isArray(window.dataArray) ? window.dataArray : [];

  const searchFilter = dataFilter.filter(item =>
    item.Product && item.Product.toLowerCase().includes(searchInput)
  );

  renderTable(searchFilter);
};

window.filterCategory = () => {
  const selectedCategory = document.getElementById('categoryFilter').value.toLowerCase();
  const allData = Array.isArray(window.dataArray) ? window.dataArray : [];

  if (!selectedCategory || selectedCategory === 'all') {
    renderTable(allData);
    return;
  }

  const filtered = allData.filter(item =>
    item.ProductCategory && item.ProductCategory.toLowerCase() === selectedCategory
  );

  renderTable(filtered);
};

document.getElementById("categoryFilter").addEventListener("change", filterCategory);
document.getElementById('searchInput').addEventListener('input', searchProduct);
document.getElementById('saveProductBtn').addEventListener('click', saveProductBtn);

window.refreshPage = () => {
  location.reload();
};

window.deleteFunction = (id) => {
  if (!id) return;

  const confirmed = window.confirm('Do you really want to delete this product? This action cannot be undone.');
  if (!confirmed) return;

  const productRef = ref(database, 'stockRef/' + id);

  remove(productRef)
    .then(() => {
      window.dataArray = (window.dataArray || []).filter(item => item.id !== id);
      renderTable(window.dataArray);
      alert('Product deleted successfully.');
    })
    .catch(error => {
      console.error('Delete failed', error);
      alert('Delete failed: ' + (error.message || error));
    });
};

window.openEditModal = (id) => {
  const product = window.dataArray.find(item => item.id === id);
  if (!product) return;

  document.getElementById("editProductName").value = product.Product || '';
  document.getElementById("editProductCategory").value = product.ProductCategory || '';
  document.getElementById("editCostPrice").value = product.CostPrice ?? '';
  document.getElementById("editSellingPrice").value = product.SellingPrice ?? '';
  document.getElementById("editStockQuantity").value = product.StockQuantity ?? '';
  document.getElementById("editReorderLevel").value = product.ReorderLevel ?? '';
  document.getElementById("editBarcode").value = product.barcode || '';
  document.getElementById("editCartonQuantity").value = product.cartonQuantity ?? '';
  document.getElementById("editCartonSize").value = product.cartonSize ?? '';
  document.getElementById("editUnitQuantity").value = product.unitQuantity ?? '';
  document.getElementById("editCartonSellingPrice").value = product.cartonSellingPrice ?? '';
  document.getElementById("editPricePerDozen").value = product.pricePerDozen ?? '';
  document.getElementById("editPricePerHalf").value = product.pricePerHalf ?? '';
  document.getElementById("editPricePerQuarter").value = product.pricePerQuarter ?? '';
  document.getElementById("editPricePerUnit").value = product.pricePerUnit ?? '';

  window.currentEditId = id;
};

window.updateProduct = () => {
  if (!window.currentEditId) return;

  const updatedData = {
    Product: document.getElementById("editProductName").value.trim().toLowerCase(),
    ProductCategory: document.getElementById("editProductCategory").value.trim().toLowerCase(),
    CostPrice: Number(document.getElementById("editCostPrice").value),
    SellingPrice: Number(document.getElementById("editSellingPrice").value),
    StockQuantity: Number(document.getElementById("editStockQuantity").value),
    ReorderLevel: Number(document.getElementById("editReorderLevel").value),
    barcode: document.getElementById("editBarcode").value.trim(),
    cartonQuantity: Number(document.getElementById("editCartonQuantity").value),
    cartonSize: Number(document.getElementById("editCartonSize").value),
    unitQuantity: Number(document.getElementById("editUnitQuantity").value),
    cartonSellingPrice: Number(document.getElementById("editCartonSellingPrice").value),
    pricePerDozen: Number(document.getElementById("editPricePerDozen").value),
    pricePerHalf: Number(document.getElementById("editPricePerHalf").value),
    pricePerQuarter: Number(document.getElementById("editPricePerQuarter").value),
    pricePerUnit: Number(document.getElementById("editPricePerUnit").value)
  };

  const productRef = ref(database, "stockRef/" + window.currentEditId);

  update(productRef, updatedData)
    .then(() => {
      alert("Product updated successfully");
      window.currentEditId = null;
    })
    .catch(error => {
      console.error(error);
      alert("Update failed");
    });
};

