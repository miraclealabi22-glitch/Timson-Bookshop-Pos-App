/**
 * Timson Luxury Fashion AI Assistant
 * - Robust Vanilla JS implementation (No dependencies)
 */

(function initLuxuryBot() {
    // TIMSON POS AI CONFIGURATION
    // Using the LIVE Render URL directly to ensure accessibility everywhere
    const API_BASE = "https://timson-bookshop-pos-app-3.onrender.com"; 
    const API_KEY = "TIMSON_BOT_2026_SECURE_TOKEN";

    // --- State ---
    let isOpen = false;
    let messages = [
        { role: 'bot', text: "Welcome to Timson Luxury Fashion. I am your concierge. How can I assist you with your bespoke operations today?" }
    ];

    // --- DOM Elements ---
    let container, trigger, chatWindow, messagesContainer, input;

    function render() {
        // Create Container
        container = document.createElement('div');
        container.id = 'lux-bot-container';
        document.body.appendChild(container);

        // Create Trigger
        trigger = document.createElement('div');
        trigger.className = 'lux-bot-trigger';
        trigger.innerHTML = '<i class="fas fa-robot"></i>';
        trigger.onclick = toggleBot;
        container.appendChild(trigger);

        // Create Chat Window
        chatWindow = document.createElement('div');
        chatWindow.className = 'lux-chat-window';
        chatWindow.style.display = 'none';
        chatWindow.innerHTML = `
            <div class="lux-chat-header">
                <h4>Timson POS Assistant</h4>
                <p>Support & Operations Concierge</p>
            </div>
            <div class="lux-chat-messages" id="lux-messages"></div>
            <div class="lux-chat-actions">
                <button class="lux-action-btn" data-query="How do I use this dashboard?">App Guide</button>
                <button class="lux-action-btn" data-query="Show my current stock status.">Stock Check</button>
                <button class="lux-action-btn" data-query="Give me a summary of today's sales.">Sales Report</button>
            </div>
            <div class="lux-chat-input-area">
                <div class="lux-input-group">
                    <input type="text" class="lux-chat-input" placeholder="Ask about POS features..." id="lux-input">
                    <button class="lux-send-btn" id="lux-send"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        container.appendChild(chatWindow);

        messagesContainer = chatWindow.querySelector('#lux-messages');
        input = chatWindow.querySelector('#lux-input');

        // Event Listeners
        chatWindow.querySelector('#lux-send').onclick = () => sendMessage(input.value);
        input.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(input.value); };
        
        chatWindow.querySelectorAll('.lux-action-btn').forEach(btn => {
            btn.onclick = () => sendMessage(btn.getAttribute('data-query'));
        });

        updateMessages();
    }

    function toggleBot() {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';
        trigger.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-gem"></i>';
        if (isOpen) input.focus();
    }

    // Expose toggle to window
    window.toggleLuxuryBot = toggleBot;

    function updateMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(m => `
            <div class="lux-msg ${m.role}">${m.text}</div>
        `).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage(text) {
        if (!text || !text.trim()) return;
        
        messages.push({ role: 'user', text });
        updateMessages();
        input.value = '';

        const typingMsg = { role: 'bot', text: '<i>Typing...</i>' };
        messages.push(typingMsg);
        updateMessages();

        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                },
                body: JSON.stringify({ 
                    message: text,
                    history: messages.filter(m => m.text !== '<i>Typing...</i>').map(m => ({ 
                        role: m.role === 'bot' ? 'model' : 'user', 
                        parts: m.text 
                    }))
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "Server error (" + res.status + ")" }));
                throw new Error(errData.error || "Server responded with status " + res.status);
            }

            const data = await res.json();
            messages.pop(); // Remove typing
            messages.push({ role: 'bot', text: data.reply });
        } catch (err) {
            messages.pop();
            console.error("Bot Error:", err);
            const displayErr = err.message || "Unknown Error";
            messages.push({ role: 'bot', text: `⚠️ ${displayErr}. (Check your Render environment variables if this persists).` });
        }
        updateMessages();
    }

    // Init on load
    if (document.readyState === 'complete') {
        render();
    } else {
        window.addEventListener('load', render);
    }
})();
