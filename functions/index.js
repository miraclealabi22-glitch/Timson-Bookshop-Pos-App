const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

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

// --- AI & BESPOKE ENDPOINTS ---

// Initialize Gemini (API Key will be set via firebase functions:config:set or environment)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 1. AI Chat Endpoint
app.post("/chat", async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Fetch dashboard context
        const context = await getDashboardContext();
        
        const systemPrompt = `
You are the "Timson POS Web App Assistant".
PERSONALITY: Professional, efficient, and technical. You help the Admin navigate their POS dashboard.
BUSINESS: Timson Bookshop & Stationery (Ogbomoso).
CONTEXT: ${JSON.stringify(context)}
RULES:
1. ONLY talk about the web app, dashboard features, inventory, and sales data.
2. Provide short "How-to" guides for features like:
   - "Import Finalizer": Explaining how to calculate shipping costs.
   - "Stock Control": How to update quantities.
   - "Analytics": How to read sales charts.
3. If the user asks about fashion trends or external topics, politely redirect them back to POS operations.
4. Use the provided context to answer specific questions about stock levels and recent sales.
        `;

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Acknowledged. I am the Timson POS Assistant. How can I help with your dashboard operations today?" }] },
                ...(history || [])
            ]
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        res.json({ success: true, reply: response.text() });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false, error: "AI Assistant is resting. Run 'firebase functions:config:set gemini.key=YOUR_KEY' if this persists." });
    }
});

// 2. Helper to fetch dashboard context
async function getDashboardContext() {
    const [stock, txns, customers] = await Promise.all([
        db.ref("stockRef").once("value"),
        db.ref("transactionsRef").limitToLast(5).once("value"),
        db.ref("customersRef").once("value")
    ]);

    const products = stock.val() ? Object.values(stock.val()) : [];
    const lowStock = products.filter(p => Number(p.StockQuantity) <= (Number(p.ReorderLevel) || 10));

    return {
        lowStock: lowStock.map(p => ({ name: p.Product, qty: p.StockQuantity })),
        recentTxns: txns.val() ? Object.values(txns.val()) : [],
        totalCustomers: customers.val() ? Object.keys(customers.val()).length : 0
    };
}

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
