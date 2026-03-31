const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Security Middleware: API Key Check
const authenticate = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    // For 2026+ deployments, runtime config is deprecated. 
    // Using a defined secret fallback for this implementation.
    const validApiKey = (functions.config().api && functions.config().api.key) || "TIMSON_BOT_2026_SECURE_TOKEN";

    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
    }
    next();
};

app.use(authenticate);

// --- Endpoints ---

// 1. Get All Products
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

// 2. Get Specific Product by Barcode or Name
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

// 3. Update Product Stock
app.patch("/products/:id", async (req, res) => {
    const { id } = req.params;
    const { StockQuantity } = req.body;

    if (StockQuantity === undefined) {
        return res.status(400).json({ error: "Missing StockQuantity in request body" });
    }

    try {
        await db.ref(`stockRef/${id}`).update({ StockQuantity });
        res.json({ success: true, message: `Updated stock for ${id}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Get Latest Transactions
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

// 5. Get Customers (User Info)
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

// Health Check
app.get("/status", (req, res) => {
    res.json({ status: "online", timestamp: new Date().toISOString() });
});

// Expose Express API as a single Cloud Function
exports.api = functions.https.onRequest(app);
