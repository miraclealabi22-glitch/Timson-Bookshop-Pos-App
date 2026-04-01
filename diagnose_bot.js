require('dotenv').config({ path: './standalone-api/.env' });
const axios = require('axios');

async function diagnose() {
    console.log("--- 🧑‍⚕️ Timson POS AI Diagnostic Tool ---\n");

    const API_URL = "http://localhost:3000";
    const API_KEY = "TIMSON_BOT_2026_SECURE_TOKEN";

    // 1. Check if server is reachable
    try {
        console.log(`Checking server at ${API_URL}/status...`);
        const status = await axios.get(`${API_URL}/status`);
        console.log("✅ Server is ONLINE:", status.data.timestamp);
    } catch (err) {
        console.error("❌ Server is OFFLINE or UNREACHABLE.");
        console.log("👉 Action: Go to 'standalone-api' folder and run: node server.js\n");
        return;
    }

    // 2. Check Gemini API Key
    console.log("\nChecking Gemini API configuration...");
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is missing in your .env file.");
        console.log("👉 Action: Add GEMINI_API_KEY=your_key_here to 'standalone-api/.env'\n");
    } else {
        console.log("✅ GEMINI_API_KEY is found.");
    }

    // 3. Test a Chat query
    try {
        console.log("\nTesting AI Response (this may take a few seconds)...");
        const res = await axios.post(`${API_URL}/chat`, {
            message: "Hello",
            history: []
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log("✅ AI Response received:", res.data.reply);
    } catch (err) {
        console.error("❌ AI Error:", err.response ? err.response.data : err.message);
        console.log("👉 Check if your Gemini API key is valid and has access to 'gemini-pro'.\n");
    }
}

diagnose();
