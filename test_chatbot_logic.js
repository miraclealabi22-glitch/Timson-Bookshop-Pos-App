const fetch = require('node-fetch');

// This script simulates a Voiceflow Chatbot searching for a product.
// To run this, you must have the server running: 
// 1. Open a terminal, go to 'standalone-api' and run 'npm start'
// 2. Open another terminal and run 'node test_chatbot_logic.js'

const API_URL = "http://localhost:3000";
const API_KEY = "TIMSON_BOT_2026_SECURE_TOKEN";

async function simulateChatbot(query) {
    console.log(`\n[Chatbot Simulation] User asked: "Do we have ${query}?"`);
    
    try {
        const response = await fetch(`${API_URL}/products/search?query=${encodeURIComponent(query)}`, {
            headers: { "x-api-key": API_KEY }
        });

        if (!response.ok) {
            console.error(`[Error] API returned status ${response.status}`);
            return;
        }

        const result = await response.json();
        const products = result.data;

        if (products && products.length > 0) {
            console.log(`[Chatbot Response] "Yes! I found ${products.length} matching items:"`);
            products.forEach(p => {
                console.log(` - ${p.Product}: ${p.StockQuantity} in stock (Price: ${p.SellingPrice})`);
            });
        } else {
            console.log(`[Chatbot Response] "I'm sorry, I couldn't find '${query}' in the database."`);
        }
    } catch (error) {
        console.error(`[Error] Could not connect to API: ${error.message}`);
        console.log("Tip: Make sure your local server is running on port 3000!");
    }
}

// Test with a sample query
simulateChatbot("Book");
