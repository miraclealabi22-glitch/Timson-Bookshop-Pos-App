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
    let messages = JSON.parse(localStorage.getItem('timson_chat_history')) || [
        { role: 'bot', text: "Welcome to Timson POS Support. I am your operations concierge. How can I assist you with your business today?", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
    ];

    // --- DOM Elements ---
    let container, trigger, chatWindow, messagesContainer, input;

    function render() {
        // Remove existing if any
        const old = document.getElementById('lux-bot-container');
        if(old) old.remove();

        // Create Container
        container = document.createElement('div');
        container.id = 'lux-bot-container';
        document.body.appendChild(container);

        // Create Trigger
        trigger = document.createElement('div');
        trigger.className = 'lux-bot-trigger';
        trigger.innerHTML = '<iconify-icon icon="hugeicons:bot" width="32" height="32" style="color: white;"></iconify-icon>';
        trigger.onclick = toggleBot;
        container.appendChild(trigger);

        // Create Chat Window
        chatWindow = document.createElement('div');
        chatWindow.className = 'lux-chat-window';
        chatWindow.style.display = 'none';
        chatWindow.innerHTML = `
            <div class="lux-chat-header">
                <div class="lux-header-info">
                    <iconify-icon icon="solar:shield-star-bold-duotone" width="24" height="24" class="me-2"></iconify-icon>
                    <div>
                        <h4>Timson POS Assistant</h4>
                        <p>Secure Operations Support</p>
                    </div>
                </div>
                <button class="lux-clear-btn" title="Clear History" id="lux-clear">
                    <iconify-icon icon="solar:trash-bin-trash-bold-duotone" width="20" height="20"></iconify-icon>
                </button>
            </div>
            <div class="lux-chat-messages" id="lux-messages"></div>
            <div class="lux-chat-actions">
                <button class="lux-action-btn" data-query="How do I use this dashboard?">Help Guide</button>
                <button class="lux-action-btn" data-query="Show my current stock status.">Stock Check</button>
                <button class="lux-action-btn" data-query="Suggest a price for calculus book.">Price Suggestion</button>
            </div>
            <div class="lux-chat-input-area">
                <div class="lux-input-group">
                    <input type="text" class="lux-chat-input" placeholder="Ask anything about POS..." id="lux-input">
                    <button class="lux-send-btn" id="lux-send">
                        <iconify-icon icon="solar:send-square-bold-duotone" width="24" height="24"></iconify-icon>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(chatWindow);

        messagesContainer = chatWindow.querySelector('#lux-messages');
        input = chatWindow.querySelector('#lux-input');

        // Event Listeners
        chatWindow.querySelector('#lux-send').onclick = () => sendMessage(input.value);
        chatWindow.querySelector('#lux-clear').onclick = clearHistory;
        input.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(input.value); };
        
        chatWindow.querySelectorAll('.lux-action-btn').forEach(btn => {
            btn.onclick = () => sendMessage(btn.getAttribute('data-query'));
        });

        updateMessages();
    }

    function toggleBot() {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';
        trigger.innerHTML = isOpen 
            ? '<iconify-icon icon="solar:close-circle-bold-duotone" width="32" height="32"></iconify-icon>' 
            : '<iconify-icon icon="hugeicons:bot" width="32" height="32" style="color: white;"></iconify-icon>';
        
        if (isOpen) {
            input.focus();
            updateMessages(); // ensure scroll to bottom
        }
    }

    // Expose toggle to window
    window.toggleLuxuryBot = toggleBot;

    function clearHistory() {
        if(confirm("Are you sure you want to clear your chat history?")) {
            messages = [
                { role: 'bot', text: "History cleared. How can I assist you now?", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
            ];
            localStorage.setItem('timson_chat_history', JSON.stringify(messages));
            updateMessages();
        }
    }

    function updateMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(m => `
            <div class="lux-msg ${m.role}">
                <div class="lux-msg-text">${m.text}</div>
                <div class="lux-msg-time">${m.time || ''}</div>
            </div>
        `).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage(text) {
        if (!text || !text.trim()) return;
        
        const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messages.push({ role: 'user', text, time: now });
        updateMessages();
        input.value = '';
        localStorage.setItem('timson_chat_history', JSON.stringify(messages));

        const typingId = 'typing-' + Date.now();
        const typingMsg = { role: 'bot', text: '<span class="lux-typing"><i>Typing...</i></span>', time: '', id: typingId };
        messages.push(typingMsg);
        updateMessages();

        try {
            const data = await window.timsonApi.post(`${API_BASE}/chat`, { 
                message: text,
                history: messages.slice(0, -1).map(m => ({ 
                    role: m.role === 'bot' ? 'model' : 'user', 
                    parts: m.text.replace(/<[^>]*>/g, '') // strip any html tags
                }))
            }, { "x-api-key": API_KEY });

            messages = messages.filter(m => m.id !== typingId);
            messages.push({ role: 'bot', text: data.reply, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
        } catch (err) {
            messages = messages.filter(m => m.id !== typingId);
            console.error("Bot Error:", err);
            // Error handling is gracefully managed by timsonApi (SweetAlert2)
            messages.push({ role: 'bot', text: `⚠️ Connection lost. I'll be here when you're back online.`, time: '' });
        }
        
        localStorage.setItem('timson_chat_history', JSON.stringify(messages));
        updateMessages();
    }

    // Init on load
    if (document.readyState === 'complete') {
        render();
    } else {
        window.addEventListener('load', render);
    }
})();
