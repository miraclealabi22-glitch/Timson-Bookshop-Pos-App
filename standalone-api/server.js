require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

// Initialize Firebase Admin
// On Render, we'll use an environment variable for the service account JSON
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require("./serviceAccountKey.json");
    }
} catch (e) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT or serviceAccountKey.json");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://posapp-ed05a-default-rtdb.firebaseio.com"
});

const db = admin.database();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Security Middleware: API Key Check
const authenticate = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    const validApiKey = process.env.API_KEY || "TIMSON_BOT_2026_SECURE_TOKEN";

    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
    }
    next();
};

app.use(authenticate);

// --- Endpoints ---

app.get("/products", async (req, res) => {
    try {
        const snapshot = await db.ref("stockRef").once("value");
        const data = snapshot.val();
        const products = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/products/search", async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Missing query parameter" });
    try {
        const snapshot = await db.ref("stockRef").once("value");
        const data = snapshot.val();
        if (!data) return res.json({ success: true, data: [] });
        const results = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(p => 
                (p.Product && p.Product.toLowerCase().includes(query.toLowerCase())) || 
                (p.barcode && p.barcode === query)
            );
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch("/products/:id", async (req, res) => {
    const { id } = req.params;
    const { StockQuantity } = req.body;
    try {
        await db.ref(`stockRef/${id}`).update({ StockQuantity });
        res.json({ success: true, message: `Updated stock for ${id}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/transactions", async (req, res) => {
    try {
        const snapshot = await db.ref("transactionsRef").limitToLast(20).once("value");
        const data = snapshot.val();
        const transactions = data ? Object.values(data).reverse() : [];
        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/customers", async (req, res) => {
    try {
        const snapshot = await db.ref("customersRef").once("value");
        const data = snapshot.val();
        const customers = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
        res.json({ success: true, data: customers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/", (req, res) => res.json({ status: "API is live!", timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
