require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Firebase Admin
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        // Support base64 encoded string for easier .env management
        serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString());
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require("./serviceAccountKey.json");
    }
} catch (e) {
    console.error("❌ CRITICAL: Missing Firebase Credentials!");
    console.log("👉 Please place 'serviceAccountKey.json' in this folder OR set FIREBASE_SERVICE_ACCOUNT in .env");
    // Don't exit immediately, let's just log it to help the user
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://posapp-ed05a-default-rtdb.firebaseio.com"
});

const genAI_Key = process.env.GEMINI_API_KEY || "";
console.log(`[Init] Gemini API Key present: ${genAI_Key ? "YES" : "NO"} ${genAI_Key ? "(Starts with: " + genAI_Key.substring(0, 4) + "...)" : ""}`);
const genAI = new GoogleGenerativeAI(genAI_Key);
const db = admin.database();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// --- Endpoints ---
// Health Check (PUBLIC)
app.get("/status", (req, res) => {
    res.json({ 
        status: "online", 
        timestamp: new Date().toISOString(),
        service: "Timson POS Standalone API"
    });
});
app.get("/", (req, res) => res.json({ status: "API is live!", timestamp: new Date().toISOString() }));

app.get("/models", async (req, res) => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const modelNames = data.models ? data.models.map(m => m.name) : [];
        res.json({ success: true, models: modelNames, debug: data });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// --- SECURITY MIDDLEWARE ---
// Everything below this line requires x-api-key
const authenticate = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    const validApiKey = process.env.API_KEY || "TIMSON_BOT_2026_SECURE_TOKEN";

    console.log(`[Request] ${req.method} ${req.url} | API Key Received: ${apiKey ? "YES" : "NO"}`);

    if (!apiKey || apiKey !== validApiKey) {
        console.warn(`[Unauthorized] Access denied for ${req.url} (Invalid or missing API Key)`);
        return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
    }
    next();
};

app.use(authenticate);

// --- Protected Endpoints ---

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

// --- AI & BESPOKE ENDPOINTS ---

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

        // Map history to the format Gemini expects (role and parts)
        const formatHistory = (history || []).map(item => ({
            role: (item.role === "bot" || item.role === "ai" || item.role === "assistant") ? "model" : "user",
            parts: [{ text: String(item.content || item.message || "") }]
        }));

        // Use generateContent instead of startChat for better stability
        const contents = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Acknowledged. I am the Timson POS Assistant. Ready to help." }] },
            ...formatHistory,
            { role: "user", parts: [{ text: message }] }
        ];

        // Direct REST API call for maximum reliability (bypassing SDK 404 issues)
        const tryGemini = async (modelName, apiVersion = "v1") => {
            const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
            console.log(`[AI] Trying ${modelName} on ${apiVersion}...`);
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents })
            });

            const data = await response.json();
            if (!response.ok) {
                console.error(`[AI] Error ${modelName} (${response.status}):`, data);
                throw new Error(data.error?.message || `API Error ${response.status}`);
            }
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response content";
        };

        let reply = "";
        try {
            // Priority 1: gemini-1.5-flash (v1)
            reply = await tryGemini("gemini-1.5-flash", "v1");
        } catch (e) {
            console.warn("⚠️ Flash (v1) failed. Trying Flash (v1beta)...");
            try {
                // Priority 2: gemini-1.5-flash (v1beta)
                reply = await tryGemini("gemini-1.5-flash", "v1beta");
            } catch (e2) {
                console.warn("⚠️ Flash (v1beta) failed. Trying gemini-pro (v1)...");
                // Priority 3: gemini-pro (v1)
                reply = await tryGemini("gemini-pro", "v1");
            }
        }
        
        res.json({ success: true, reply });
    } catch (error) {
        console.error("AI Error Details:", error);
        let errorHint = "AI Assistant is resting. Try again in a bit.";
        
        if (!process.env.GEMINI_API_KEY) {
            errorHint = "Missing GEMINI_API_KEY. Please set it in Render Env vars.";
        } else if (error.message && error.message.includes("API key not valid")) {
            errorHint = "Invalid GEMINI_API_KEY. Please check Google AI Studio.";
        } else if (error.message && error.message.includes("quota")) {
            errorHint = "Gemini API quota exceeded. Please try again later.";
        }
        
        res.status(500).json({ 
            success: false, 
            error: errorHint,
            debug: error.message 
        });
    }
});

// 2. Helper to fetch dashboard context
async function getDashboardContext() {
    try {
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
    } catch (e) {
        console.error("Firebase Context Error:", e);
        return { error: "Could not fetch store data. Check Firebase credentials in Render." };
    }
}

// 3. Measurements Endpoint
app.get("/measurements/:customerId", async (req, res) => {
    try {
        const snap = await db.ref(`measurementsRef/${req.params.customerId}`).once("value");
        res.json({ success: true, data: snap.val() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/measurements/:customerId", async (req, res) => {
    try {
        await db.ref(`measurementsRef/${req.params.customerId}`).set({
            ...req.body,
            lastUpdated: new Date().toISOString()
        });
        res.json({ success: true, message: "Measurements saved" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check moved above security middleware

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
