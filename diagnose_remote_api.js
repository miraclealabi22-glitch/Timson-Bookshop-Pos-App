const fetch = require('node-fetch');

// --- DIAGNOSTIC CONFIGURATION ---
const YOUR_RENDER_URL = "https://timson-api.onrender.com"; // <-- PASTE YOUR URL HERE
const API_KEY = "TIMSON_BOT_2026_SECURE_TOKEN";
// ---------------------------------

async function diagnose() {
    console.log(`Starting Diagnostics for: ${YOUR_RENDER_URL}...`);

    try {
        // Test 1: Public Connection
        const res1 = await fetch(YOUR_RENDER_URL);
        console.log(`[Test 1] Public URL check: ${res1.ok ? "PASS" : "FAIL (Status: " + res1.status + ")"}`);

        // Test 2: Authenticated Status
        const res2 = await fetch(`${YOUR_RENDER_URL}/status`, {
            headers: { "x-api-key": API_KEY }
        });
        const data2 = await res2.json();
        console.log(`[Test 2] Auth + /status check: ${data2.status === "online" ? "PASS" : "FAIL"}`);

        // Test 3: Database Stock Access
        const res3 = await fetch(`${YOUR_RENDER_URL}/products`, {
            headers: { "x-api-key": API_KEY }
        });
        const data3 = await res3.json();
        console.log(`[Test 3] DB /products check: ${data3.success ? "PASS (Found " + data3.data.length + " items)" : "FAIL"}`);

        console.log("\nResults Summary:");
        if (data3.success) {
            console.log("SUCCESS: Your API is perfectly online and connected to the database.");
            console.log("ACTION: The issue is likely inside your Voiceflow API Block configuration (Check headers!).");
        } else {
            console.log("FAILURE: Your API is online but cannot reach the database.");
            console.log("ACTION: Double-check your FIREBASE_SERVICE_ACCOUNT on Render.");
        }
    } catch (e) {
        console.error(`[Fatal Error] Could not reach the server: ${e.message}`);
        console.log("ACTION: Make sure your Render URL is correct and the service is not 'suspended' or 'sleeping'.");
    }
}

diagnose();
