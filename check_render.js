const fetch = require('node-fetch');

async function checkRender() {
    const url = "https://timson-bookshop-pos-app-3.onrender.com/status";
    const apiKey = "TIMSON_BOT_2026_SECURE_TOKEN";

    try {
        const res = await fetch(url, { headers: { "x-api-key": apiKey } });
        console.log(`Render status check (${url}): ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log("Response:", data);
        } else {
            const text = await res.text();
            console.log("Error response:", text);
        }
    } catch (e) {
        console.log("Could not reach Render:", e.message);
    }
}

checkRender();
