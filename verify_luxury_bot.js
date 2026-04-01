const axios = require('axios');

async function verifyLuxuryBot() {
    const API_URL = "http://localhost:3000";
    const API_KEY = "TIMSON_BOT_2026_SECURE_TOKEN";

    console.log("--- 🕵️ Verifying Luxury Fashion AI Assistant ---\n");

    try {
        // 1. Test /chat endpoint
        console.log("Testing AI Chat (Bespoke Query)...");
        const chatRes = await axios.post(`${API_URL}/chat`, {
            message: "How far? My client wants an Ankara gown for a wedding on Saturday. What should I do?",
            history: []
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log("AI Response:", chatRes.data.reply);
        console.log("✅ Chat Endpoint Working\n");

        // 2. Test Measurements
        console.log("Testing Measurements Endpoint...");
        const measureRes = await axios.post(`${API_URL}/measurements/test_client_001`, {
            bust: "38",
            waist: "30",
            hips: "42",
            length: "60"
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log("Save Status:", measureRes.data.message);

        const getMeasureRes = await axios.get(`${API_URL}/measurements/test_client_001`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log("Retrieved Measurements:", getMeasureRes.data.data);
        console.log("✅ Measurements Endpoint Working\n");

    } catch (err) {
        console.error("❌ Verification Failed!");
        if (err.response) {
            console.error(`Status: ${err.response.status}`, err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

verifyLuxuryBot();
