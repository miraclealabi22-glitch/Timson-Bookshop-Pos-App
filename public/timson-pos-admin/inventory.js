 // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
  import { getDatabase, ref, push, onValue} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyACgmBzV74SwJLVyUCMdN1xOxZjMI4UgCg",
    authDomain: "posapp-ed05a.firebaseapp.com",
    databaseURL: "https://posapp-ed05a-default-rtdb.firebaseio.com",
    projectId: "posapp-ed05a",
    storageBucket: "posapp-ed05a.firebasestorage.app",
    messagingSenderId: "486175914054",
    appId: "1:486175914054:web:b2f7d71ae98c451f417247"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
window.stock = []

onValue(ref(database, "stockRef"), (snapshot) => {
     let data = snapshot.val();
     window.dataArray = Object.values(data)
  //  console.log(data);
   
  //  window.miracle = data;
  //  console.log(window.miracle);
// for (let i = 0; i < data; i++) {
//   const element = data[i];
//   console.log(element);
  
  
// }

});
const saveProductBtn = () => {
    let productName = document.getElementById('productName').value.toLowerCase();
    let productCategory = document.getElementById('productCategory').value.toLowerCase();
    let costPrice = document.getElementById('costPrice').value;
    let sellingPrice = document.getElementById('sellingPrice').value;
    let stockQuantity = document.getElementById('stockQuantity').value;
    let reorderLevel = document.getElementById('reorderLevel').value;
    let barcode = document.getElementById('barcode').value;

    if (!productName || !productCategory || !costPrice || !sellingPrice || !stockQuantity || !reorderLevel || !barcode) return;

    const stockAdjustment = {
        Product: productName,
        CostPrice: costPrice,
        SellingPrice: sellingPrice,
        StockQuantity: stockQuantity,
        ReorderLevel: reorderLevel,
        barcode: barcode,
        ProductCategory: productCategory 
    };

    window.stock.push(stockAdjustment);
    

    const stockSave = ref(database, 'stockRef');
    push(stockSave, stockAdjustment)
        .then(() => {
            document.getElementById('alertArea').innerHTML = `<div class="alert alert-primary" role="alert">
              Stock item saved successfully!
            </div>`;
            document.getElementById('addProductForm').reset();
        })
        .catch((error) => {
            document.getElementById('alertArea').innerHTML = `<div class="alert alert-warning" role="alert">
              Fail to Add!
            </div>`;
            console.error("Error saving product:", error);
        });
       
};
// console.log(window.miracle);
//  console.log(data);
setTimeout(() => {
  let tableBody = document.getElementById('tableBody')
  tableBody.innerHTML = ''
//     console.log(window.dataArray.
// CostPrice);
    for (let i = 0; i < window.dataArray.length; i++) {
      const element = window.dataArray[i]
    //   console.log(element);
      tableBody.innerHTML += `  <tr>
                                    <td class="ps-3 text-muted fw-medium">${element.
barcode
}</td>
                                    <td class="fw-bold text-dark">${element.Product}</td>
                                    <td><span class="badge bg-light text-dark border">${element.ProductCategory}</span></td>
                                    <td class="text-muted">₦${element.CostPrice}</td>
                                    <td class="fw-bold text-dark">₦${element.SellingPrice}</td>
                                    <td class="fw-bold text-dark">${element.StockQuantity}</td>
                                    <td class="text-muted">${element.ReorderLevel}</td>
                                    <td><span class="status-indicator status-in-stock"></span> In Stock</td>
                                    <td class="text-end pe-3 action-btns">
                                        <button class="btn btn-light text-info border-0 shadow-sm"
                                            title="View Details"><i class="fas fa-eye"></i></button>
                                        <button class="btn btn-light text-primary border-0 shadow-sm"
                                            title="Edit Product"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-light text-danger border-0 shadow-sm"
                                            title="Delete Product"><i class="fas fa-trash-alt"></i></button>
                                    </td>
                                </tr>`
      
    }


    window.searchProduct = (e) => {
    // console.log(e);
    let dataFilter = window.dataArray;
    // console.log(dataFilter);
    
    let searchInput = document.getElementById('searchInput').value.toLowerCase();
const searchFilter = dataFilter.filter((dataFilter) => dataFilter.Product.includes(searchInput))
console.log(searchFilter);
 let tableBody = document.getElementById('tableBody')
  tableBody.innerHTML = ''
  for (let t = 0; t < searchFilter
    .length; t++) {
    const elementT = searchFilter[t];
    // console.log(elementT);
    tableBody.innerHTML += `<tr>
                                    <td class="ps-3 text-muted fw-medium">${elementT.
barcode
}</td>
                                    <td class="fw-bold text-dark">${elementT.Product}</td>
                                    <td><span class="badge bg-light text-dark border">${elementT.ProductCategory}</span></td>
                                    <td class="text-muted">₦${elementT.CostPrice}</td>
                                    <td class="fw-bold text-dark">₦${elementT.SellingPrice}</td>
                                    <td class="fw-bold text-dark">${elementT.StockQuantity}</td>
                                    <td class="text-muted">${elementT.ReorderLevel}</td>
                                    <td><span class="status-indicator status-in-stock"></span> In Stock</td>
                                    <td class="text-end pe-3 action-btns">
                                        <button class="btn btn-light text-info border-0 shadow-sm"
                                            title="View Details"><i class="fas fa-eye"></i></button>
                                        <button class="btn btn-light text-primary border-0 shadow-sm"
                                            title="Edit Product"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-light text-danger border-0 shadow-sm"
                                            title="Delete Product"><i class="fas fa-trash-alt"></i></button>
                                    </td>
                                </tr>`
    
    
  }
//   console.log(dataFilter);
  
}

const filterCategories = dataFilter.filter((dataFilter) => dataFilter.ProductCategory)

}, 1800);



document.getElementById('saveProductBtn').addEventListener('click', saveProductBtn);
// console.log(window.data);                                                                                                                                        