/**
 * GenZ AI — Chrome / Edge Extension Content Script
 * Injects a floating AI chat box popup onto any webpage the user visits.
 * Total styling isolation using Shadow DOM.
 * Features:
 *  - 📸 Read Screen & Answer: Automatically extracts MCQs, practice questions, and options from active screen and solves them.
 *  - Supports all target models (genZai, Llama 3.2, Nemotron Reasoning, DeepSeek, Gemma, etc.)
 *  - Easily switches between Host's Local Server (http://127.0.0.1:5000) and Friend's Online Tunnel URL.
 */
(function() {
    if (window.__GENZAI_EXTENSION_CONTENT_INJECTED__) return;
    window.__GENZAI_EXTENSION_CONTENT_INJECTED__ = true;

    // Comprehensive list of target models with clear badges
    const TARGET_MODELS = [
        { id: "genZai (Custom Trained Model)", label: "✦ genZai (Custom Trained Model)" },
        { id: "meta/llama-3.2-11b-vision-instruct", label: "⚡ Llama 3.2 11B Vision (Meta)" },
        { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "🧠 Nemotron 3 Reasoning (NVIDIA)" },
        { id: "deepseek-ai/deepseek-v4.1-flash", label: "⚡ DeepSeek V4.1 Flash" },
        { id: "deepseek-ai/deepseek-coder-6.7b-instruct", label: "💻 DeepSeek Coder 6.7B" },
        { id: "google/gemma-4-31b-it", label: "⚡ Gemma 4 31B (Google)" },
        { id: "moonshotai/kimi-k3", label: "⚡ Kimi K3 (Moonshot AI)" },
        { id: "openai/gpt-oss-20b", label: "⚡ GPT OSS 20B (OpenAI)" },
        { id: "nvidia/nemotron-3-ultra-550b-a55b", label: "🚀 Nemotron 3 Ultra 550B" },
        { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "⚡ Nemotron 70B Instruct" },
        { id: "nvidia/llama-3.1-nemotron-51b-instruct", label: "⚡ Nemotron 51B Instruct" },
        { id: "meta/llama-3.2-90b-vision-instruct", label: "⚡ Llama 3.2 90B Vision" },
        { id: "meta/llama-guard-4-12b", label: "🛡️ Llama Guard 4 12B" },
        { id: "nvidia/nemotron-4-340b-instruct", label: "⚡ Nemotron 4 340B Instruct" },
        { id: "z-ai/glm-5.3", label: "⚡ GLM 5.3" }
    ];

    function getModelLabel(id) {
        const found = TARGET_MODELS.find(m => m.id === id);
        if (found) return found.label;
        if (id.toLowerCase().includes('genzai')) return `✦ ${id}`;
        return `⚡ ${id}`;
    }

    // Load user preferences from chrome.storage
    chrome.storage.local.get({
        widgetEnabled: true,
        serverUrl: 'http://127.0.0.1:5000',
        defaultModel: 'genZai (Custom Trained Model)',
        position: 'bottom-right'
    }, function(settings) {
        if (!settings.widgetEnabled) {
            console.log('[GenZ AI Extension] Widget is disabled in extension settings.');
            return;
        }
        initExtensionWidget(settings);
    });

    // Listen for extension commands from popup.js
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'PING') {
            sendResponse({ status: 'OK' });
        } else if (request.action === 'TOGGLE_WIDGET') {
            const host = document.getElementById('genzai-extension-root');
            if (host) {
                const currentDisplay = host.style.display;
                host.style.display = currentDisplay === 'none' ? 'block' : 'none';
                sendResponse({ visible: host.style.display !== 'none' });
            } else {
                initExtensionWidget(request.settings || { serverUrl: 'http://127.0.0.1:5000' });
                sendResponse({ visible: true });
            }
        } else if (request.action === 'SUMMARIZE_PAGE') {
            if (window.GenZAIExtensionInstance) {
                window.GenZAIExtensionInstance.open();
                window.GenZAIExtensionInstance.setContext(true);
                window.GenZAIExtensionInstance.send("Please provide a thorough 3-5 bullet point summary of this webpage with its key takeaways.");
                sendResponse({ started: true });
            }
        } else if (request.action === 'READ_SCREEN') {
            if (window.GenZAIExtensionInstance) {
                window.GenZAIExtensionInstance.open();
                window.GenZAIExtensionInstance.readScreen();
                sendResponse({ started: true });
            }
        }
        return true;
    });

    // Safe API fetcher: proxies via background service worker to prevent CORS and HTTPS mixed content issues
    function safeApiFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'API_FETCH',
                        url: url,
                        options: options
                    }, (response) => {
                        if (chrome.runtime.lastError || !response) {
                            directFetch(url, options).then(resolve).catch(reject);
                        } else if (response.ok) {
                            resolve(response.data);
                        } else {
                            const err = (response.data && response.data.error) || response.error || `HTTP ${response.status}`;
                            reject(new Error(err));
                        }
                    });
                    return;
                } catch(e) {
                    // Fallback to direct fetch
                }
            }
            directFetch(url, options).then(resolve).catch(reject);
        });
    }

    async function directFetch(url, options = {}) {
        const resp = await fetch(url, options);
        let data = null;
        try {
            data = await resp.json();
        } catch(e) {
            data = { error: `Server returned HTTP ${resp.status}` };
        }
        if (!resp.ok) {
            throw new Error((data && data.error) || `HTTP ${resp.status}`);
        }
        return data;
    }

    function initExtensionWidget(settings) {
        if (document.getElementById('genzai-extension-root')) return;

        const config = {
            serverUrl: settings.serverUrl || 'http://127.0.0.1:5000',
            defaultModel: settings.defaultModel || 'genZai (Custom Trained Model)',
            position: settings.position || 'bottom-right',
            title: 'GenZ AI Copilot',
            subtitle: 'Browser Extension · Powered by NVIDIA NIM',
            greeting: 'Hi! I can solve questions on your screen or answer any questions.',
            autoGreeting: true
        };

        const state = {
            isOpen: false,
            isLoading: false,
            messages: [],
            models: TARGET_MODELS.map(m => m.id),
            selectedModel: config.defaultModel,
            pageContextActive: false
        };

        const ICONS = {
            sparkles: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
            close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
            minus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
            send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
            trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
            fileText: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
            copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
            globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
            camera: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>`,
            target: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`
        };

        const hostEl = document.createElement('div');
        hostEl.id = 'genzai-extension-root';
        hostEl.style.position = 'fixed';
        hostEl.style.zIndex = '2147483647';
        hostEl.style.pointerEvents = 'none';
        hostEl.style.bottom = '20px';
        hostEl.style.right = '20px';
        document.documentElement.appendChild(hostEl);

        const shadow = hostEl.attachShadow({ mode: 'open' });

        const styleEl = document.createElement('style');
        styleEl.textContent = `
            :host {
                --gz-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
                --gz-bg-main: #0c0d12;
                --gz-bg-card: #13151b;
                --gz-bg-subtle: #1a1d26;
                --gz-border: #232733;
                --gz-primary: #6366f1;
                --gz-primary-hover: #4f46e5;
                --gz-accent-emerald: #10b981;
                --gz-text: #f3f4f6;
                --gz-text-sub: #9ca3af;
                --gz-text-muted: #6b7280;
                --gz-shadow: 0 12px 40px -4px rgba(0, 0, 0, 0.75), 0 4px 16px -2px rgba(0, 0, 0, 0.4);
                font-family: var(--gz-font);
                color: var(--gz-text);
            }
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            .widget-wrapper {
                position: relative;
                pointer-events: auto;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }
            .launcher-btn {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #4338ca 100%);
                border: 2px solid rgba(255, 255, 255, 0.2);
                color: #ffffff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 6px 24px rgba(99, 102, 241, 0.45);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                outline: none;
                position: relative;
            }
            .launcher-btn:hover {
                transform: scale(1.08) translateY(-2px);
                box-shadow: 0 10px 30px rgba(99, 102, 241, 0.6);
            }
            .pulse-ring {
                position: absolute;
                top: -4px; left: -4px; right: -4px; bottom: -4px;
                border-radius: 50%;
                border: 2px solid rgba(99, 102, 241, 0.6);
                animation: gz-pulse 2.4s infinite cubic-bezier(0.25, 1, 0.5, 1);
                pointer-events: none;
            }
            @keyframes gz-pulse {
                0% { transform: scale(1); opacity: 0.8; }
                70% { transform: scale(1.35); opacity: 0; }
                100% { transform: scale(1.35); opacity: 0; }
            }
            .greeting-badge {
                margin-bottom: 12px;
                background: var(--gz-bg-card);
                border: 1px solid var(--gz-border);
                padding: 10px 14px;
                border-radius: 12px;
                box-shadow: var(--gz-shadow);
                font-size: 13px;
                max-width: 260px;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: gz-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                cursor: pointer;
            }
            .greeting-close {
                background: none; border: none; color: var(--gz-text-muted); cursor: pointer; padding: 2px;
                display: flex; align-items: center; justify-content: center; border-radius: 4px;
            }
            .greeting-close:hover { color: var(--gz-text); }
            @keyframes gz-slide-up {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .chat-window {
                width: 390px;
                height: 590px;
                max-width: calc(100vw - 32px);
                max-height: calc(100vh - 100px);
                background: var(--gz-bg-main);
                border: 1px solid var(--gz-border);
                border-radius: 16px;
                box-shadow: var(--gz-shadow);
                display: none;
                flex-direction: column;
                overflow: hidden;
                margin-bottom: 12px;
                animation: gz-chat-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .chat-window.open { display: flex; }
            @keyframes gz-chat-pop {
                from { opacity: 0; transform: scale(0.92) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .chat-header {
                padding: 12px 14px;
                background: var(--gz-bg-card);
                border-bottom: 1px solid var(--gz-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }
            .header-brand {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }
            .brand-avatar {
                width: 34px;
                height: 34px;
                border-radius: 10px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                flex-shrink: 0;
            }
            .brand-title {
                font-weight: 600;
                font-size: 13px;
                color: #ffffff;
                white-space: nowrap;
            }
            .status-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background-color: var(--gz-accent-emerald);
                display: inline-block;
                transition: background-color 0.3s;
            }
            .model-select {
                background: var(--gz-bg-subtle);
                border: 1px solid var(--gz-border);
                color: var(--gz-text-sub);
                font-size: 11px;
                padding: 3px 6px;
                border-radius: 6px;
                outline: none;
                cursor: pointer;
                max-width: 175px;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
            }
            .model-select option {
                background: #151821;
                color: #f3f4f6;
            }
            .header-actions { display: flex; align-items: center; gap: 4px; }
            .header-btn {
                background: transparent;
                border: none;
                color: var(--gz-text-sub);
                width: 28px;
                height: 28px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.15s;
            }
            .header-btn:hover { background: var(--gz-bg-subtle); color: var(--gz-text); }
            .header-btn.active { color: #818cf8; background: rgba(99, 102, 241, 0.15); }
            
            .context-bar {
                background: rgba(99, 102, 241, 0.1);
                border-bottom: 1px solid rgba(99, 102, 241, 0.25);
                padding: 6px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 11px;
                color: #a5b4fc;
                flex-shrink: 0;
            }
            .context-indicator { display: flex; align-items: center; gap: 6px; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
            .context-toggle-btn { background: none; border: none; color: #818cf8; cursor: pointer; font-size: 11px; text-decoration: underline; margin-left: 6px; }

            .messages-container {
                flex: 1;
                padding: 14px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                scroll-behavior: smooth;
            }
            .welcome-box {
                background: var(--gz-bg-subtle);
                border: 1px dashed var(--gz-border);
                border-radius: 12px;
                padding: 14px;
                text-align: center;
                margin-top: 6px;
            }
            .welcome-box h3 { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 6px; }
            .welcome-box p { font-size: 11px; color: var(--gz-text-sub); line-height: 1.4; margin-bottom: 10px; }
            .quick-chips { display: flex; flex-direction: column; gap: 6px; }
            .chip-btn {
                background: var(--gz-bg-card);
                border: 1px solid var(--gz-border);
                color: var(--gz-text);
                font-size: 11px;
                padding: 7px 10px;
                border-radius: 8px;
                cursor: pointer;
                text-align: left;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.15s;
            }
            .chip-btn:hover { border-color: var(--gz-primary); background: var(--gz-bg-subtle); }
            .chip-btn.highlight-chip {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
                border-color: rgba(99, 102, 241, 0.4);
                color: #c7d2fe;
            }
            .chip-btn.highlight-chip:hover {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25));
                border-color: var(--gz-primary);
            }

            .msg-row { display: flex; gap: 8px; max-width: 90%; }
            .msg-row.user { align-self: flex-end; flex-direction: row-reverse; }
            .msg-row.assistant { align-self: flex-start; }
            .msg-avatar {
                width: 26px; height: 26px; border-radius: 8px;
                background: var(--gz-bg-subtle); border: 1px solid var(--gz-border);
                display: flex; align-items: center; justify-content: center;
                color: var(--gz-primary); flex-shrink: 0;
            }
            .msg-row.user .msg-avatar { background: var(--gz-primary); color: #fff; }
            .msg-bubble {
                background: var(--gz-bg-subtle);
                border: 1px solid var(--gz-border);
                padding: 9px 12px;
                border-radius: 12px;
                font-size: 12.5px;
                line-height: 1.45;
                color: var(--gz-text);
                word-break: break-word;
            }
            .msg-row.user .msg-bubble {
                background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                border-color: #6366f1;
                color: #ffffff;
                border-bottom-right-radius: 2px;
            }
            .msg-row.assistant .msg-bubble { border-bottom-left-radius: 2px; }
            .msg-bubble p { margin-bottom: 6px; }
            .msg-bubble p:last-child { margin-bottom: 0; }
            .msg-bubble ul, .msg-bubble ol { margin-left: 18px; margin-bottom: 6px; }
            .msg-bubble li { margin-bottom: 3px; }
            .msg-bubble code { background: rgba(0,0,0,0.35); padding: 2px 4px; border-radius: 4px; font-size: 11px; color: #a5b4fc; }
            .msg-bubble pre { background: #08090d; border: 1px solid var(--gz-border); border-radius: 6px; padding: 8px; margin: 6px 0; overflow-x: auto; position: relative; }
            .msg-bubble pre code { background: transparent; padding: 0; color: #e2e8f0; font-size: 11px; }
            .code-copy-btn {
                position: absolute; top: 4px; right: 4px; background: rgba(255,255,255,0.1); border: none;
                color: #94a3b8; border-radius: 3px; padding: 2px 5px; font-size: 9px; cursor: pointer;
            }
            .code-copy-btn:hover { color: #fff; background: rgba(255,255,255,0.2); }
            .citation-badge {
                display: inline-flex; align-items: center; gap: 4px;
                background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.25);
                color: #a5b4fc; font-size: 10px; padding: 2px 6px; border-radius: 5px; margin: 3px 2px 0 0;
            }
            .typing-indicator { display: flex; align-items: center; gap: 4px; padding: 6px 10px; background: var(--gz-bg-card); border: 1px solid var(--gz-border); border-radius: 10px; width: fit-content; }
            .typing-dot { width: 5px; height: 5px; border-radius: 50%; background-color: var(--gz-primary); animation: gz-bounce 1.4s infinite ease-in-out both; }
            .typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .typing-dot:nth-child(2) { animation-delay: -0.16s; }
            .typing-dot:nth-child(3) { animation-delay: 0s; }
            @keyframes gz-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
            
            .chat-footer { padding: 10px 14px; background: var(--gz-bg-card); border-top: 1px solid var(--gz-border); display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
            .quick-prompt-bar { display: flex; align-items: center; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
            .quick-pill-btn {
                background: var(--gz-bg-subtle);
                border: 1px solid var(--gz-border);
                color: var(--gz-text-sub);
                font-size: 11px;
                font-weight: 500;
                padding: 4px 9px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                white-space: nowrap;
                transition: all 0.15s ease;
            }
            .quick-pill-btn:hover { border-color: var(--gz-primary); color: #fff; background: rgba(99, 102, 241, 0.15); }
            .quick-pill-btn.active-pill {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25));
                border-color: rgba(99, 102, 241, 0.6);
                color: #c7d2fe;
                font-weight: 600;
            }
            
            .input-row { display: flex; align-items: flex-end; gap: 6px; background: var(--gz-bg-subtle); border: 1px solid var(--gz-border); border-radius: 10px; padding: 7px 9px; }
            .input-row:focus-within { border-color: var(--gz-primary); }
            .chat-textarea { flex: 1; background: transparent; border: none; color: var(--gz-text); font-family: inherit; font-size: 13px; max-height: 80px; resize: none; outline: none; }
            .send-btn { width: 30px; height: 30px; border-radius: 6px; background: var(--gz-primary); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .send-btn:hover:not(:disabled) { background: var(--gz-primary-hover); }
            .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .footer-branding { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--gz-text-muted); }
        `;
        shadow.appendChild(styleEl);

        function formatServerFooter(url) {
            if (!url) return '🖥️ My Local (127.0.0.1:5000)';
            if (url.includes('127.0.0.1') || url.includes('localhost')) {
                return '🖥️ My Local (127.0.0.1:5000)';
            }
            const clean = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return '🌐 Friend Tunnel (' + clean.slice(0, 18) + (clean.length > 18 ? '...' : '') + ')';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'widget-wrapper';
        wrapper.innerHTML = `
            <div class="greeting-badge" id="gzGreetingBadge">
                <span>${config.greeting}</span>
                <button class="greeting-close" id="gzCloseGreeting">${ICONS.close}</button>
            </div>
            <div class="chat-window" id="gzChatWindow">
                <div class="chat-header">
                    <div class="header-brand">
                        <div class="brand-avatar">${ICONS.sparkles}</div>
                        <div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <span class="brand-title">${config.title}</span>
                                <span class="status-dot" id="gzStatusDot" title="Connecting to server..."></span>
                            </div>
                            <select class="model-select" id="gzModelSelect" title="Select Target AI Model">
                                ${TARGET_MODELS.map(m => `
                                    <option value="${m.id}" ${m.id === config.defaultModel ? 'selected' : ''}>${m.label}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="header-btn" id="gzReadScreenBtn" title="📸 Read Screen & Answer (Solve MCQ / Question)">${ICONS.camera}</button>
                        <button class="header-btn" id="gzPageContextBtn" title="Attach webpage context">${ICONS.fileText}</button>
                        <button class="header-btn" id="gzClearChatBtn" title="Clear chat">${ICONS.trash}</button>
                        <button class="header-btn" id="gzMinimizeBtn" title="Minimize">${ICONS.minus}</button>
                    </div>
                </div>
                <div class="context-bar" id="gzContextBar" style="display:none;">
                    <div class="context-indicator">
                        ${ICONS.target}
                        <span id="gzContextTitle">Webpage Screen Context</span>
                    </div>
                    <button class="context-toggle-btn" id="gzDisableContextBtn">Remove</button>
                </div>
                <div class="messages-container" id="gzMessagesContainer">
                    <div class="welcome-box" id="gzWelcomeBox">
                        <h3>${ICONS.sparkles} GenZ AI Web Copilot</h3>
                        <p>Ask anything, or let GenZ AI read questions on your screen and provide instant verified answers.</p>
                        <div class="quick-chips">
                            <button class="chip-btn highlight-chip" id="gzChipReadScreen" data-action="read-screen">
                                ${ICONS.camera} <strong>Read Screen & Answer</strong> (Solve MCQ / Quiz)
                            </button>
                            <button class="chip-btn" data-query="Please provide a concise 3-point summary of this webpage.">
                                ${ICONS.fileText} Summarize this page
                            </button>
                            <button class="chip-btn" data-query="What custom documents are trained inside genZai?">
                                ${ICONS.sparkles} Ask genZai knowledge
                            </button>
                        </div>
                    </div>
                </div>
                <div class="chat-footer">
                    <div class="quick-prompt-bar">
                        <button class="quick-pill-btn active-pill" id="gzQuickReadScreenBtn">
                            ${ICONS.camera} Read Screen & Answer
                        </button>
                        <button class="quick-pill-btn" id="gzQuickSummarizeBtn">
                            ${ICONS.fileText} Summarize Page
                        </button>
                    </div>
                    <div class="input-row">
                        <textarea class="chat-textarea" id="gzTextarea" placeholder="Ask anything, or type 'read screen' to solve..." rows="1"></textarea>
                        <button class="send-btn" id="gzSendBtn">${ICONS.send}</button>
                    </div>
                    <div class="footer-branding">
                        <span>${config.subtitle}</span>
                        <span id="gzServerStatusText" style="cursor:pointer;color:#818cf8;text-decoration:underline;display:inline-flex;align-items:center;gap:3px;" title="Click to switch: My Local Server vs Friend's Tunnel">
                            ${formatServerFooter(config.serverUrl)} ⚙️
                        </span>
                    </div>
                </div>
            </div>
            <button class="launcher-btn" id="gzLauncherBtn">
                <div class="pulse-ring"></div>
                <div id="gzLauncherIcon">${ICONS.sparkles}</div>
            </button>
        `;
        shadow.appendChild(wrapper);

        const launcherBtn = shadow.getElementById('gzLauncherBtn');
        const launcherIcon = shadow.getElementById('gzLauncherIcon');
        const chatWindow = shadow.getElementById('gzChatWindow');
        const greetingBadge = shadow.getElementById('gzGreetingBadge');
        const closeGreeting = shadow.getElementById('gzCloseGreeting');
        const minimizeBtn = shadow.getElementById('gzMinimizeBtn');
        const clearChatBtn = shadow.getElementById('gzClearChatBtn');
        const pageContextBtn = shadow.getElementById('gzPageContextBtn');
        const readScreenBtn = shadow.getElementById('gzReadScreenBtn');
        const quickReadScreenBtn = shadow.getElementById('gzQuickReadScreenBtn');
        const quickSummarizeBtn = shadow.getElementById('gzQuickSummarizeBtn');
        const contextBar = shadow.getElementById('gzContextBar');
        const contextTitle = shadow.getElementById('gzContextTitle');
        const disableContextBtn = shadow.getElementById('gzDisableContextBtn');
        const messagesContainer = shadow.getElementById('gzMessagesContainer');
        const welcomeBox = shadow.getElementById('gzWelcomeBox');
        const textarea = shadow.getElementById('gzTextarea');
        const sendBtn = shadow.getElementById('gzSendBtn');
        const modelSelect = shadow.getElementById('gzModelSelect');
        const statusDot = shadow.getElementById('gzStatusDot');
        const serverStatusTextEl = shadow.getElementById('gzServerStatusText');

        function updateServerStatusUI(url) {
            config.serverUrl = url;
            if (serverStatusTextEl) {
                serverStatusTextEl.innerHTML = `${formatServerFooter(url)} ⚙️`;
            }
        }

        function formatMarkdown(text) {
            if (!text) return '';
            let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (m, lang, code) =>
                `<pre><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText);this.innerText='Copied!';setTimeout(()=>this.innerText='Copy',1500);">${ICONS.copy} Copy</button><code>${code.trim()}</code></pre>`
            );
            escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
            escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, p1, p2) => {
                if (p2 === '#change-server-url') {
                    return `<button class="gz-change-url-btn" style="background:#6366f1;color:#fff;border:none;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;margin:4px 0;font-weight:600;display:inline-block;">⚙️ ${p1}</button>`;
                }
                if (p2 === '#use-local-server') {
                    return `<button class="gz-use-local-btn" style="background:#10b981;color:#fff;border:none;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;margin:4px 0;font-weight:600;display:inline-block;">🖥️ ${p1}</button>`;
                }
                if (p2 === '#retry-connection') {
                    return `<button class="gz-retry-btn" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;margin:4px 0;font-weight:600;display:inline-block;">🔄 ${p1}</button>`;
                }
                return `<a href="${p2}" target="_blank" rel="noopener noreferrer" style="color:#818cf8;text-decoration:underline;">${p1}</a>`;
            });
            escaped = escaped.replace(/(?:^|\n)[-*]\s+([^\n]+)/g, '<li>$1</li>');
            escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
            return escaped.split(/\n\n+/).map(p => {
                p = p.trim();
                if (!p) return '';
                if (p.startsWith('<pre>') || p.startsWith('<ul>')) return p;
                return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
            }).join('');
        }

        function toggleChat(force) {
            state.isOpen = force !== undefined ? force : !state.isOpen;
            if (state.isOpen) {
                chatWindow.classList.add('open');
                launcherIcon.innerHTML = ICONS.close;
                if (greetingBadge) greetingBadge.style.display = 'none';
                setTimeout(() => textarea.focus(), 200);
            } else {
                chatWindow.classList.remove('open');
                launcherIcon.innerHTML = ICONS.sparkles;
            }
        }

        /**
         * Intelligent Screen & Question Extractor
         * Scans for MCQ questions, practice problems, radio buttons, choices, and viewport elements
         */
        function extractScreenQuestionContext() {
            const title = document.title || 'Webpage';
            const url = window.location.href;
            
            // 1. Look for targeted Quiz / MCQ / Question containers first
            const questionSelectors = [
                '[class*="question"]',
                '[class*="mcq"]',
                '[class*="practice"]',
                '[class*="quiz"]',
                '[class*="assessment"]',
                '[class*="problem"]',
                '[class*="exercise"]',
                '[id*="question"]',
                '[id*="mcq"]',
                'form',
                'main',
                'article',
                '[role="main"]'
            ];
            
            let detectedQuestions = [];
            for (const sel of questionSelectors) {
                try {
                    const els = document.querySelectorAll(sel);
                    for (const el of els) {
                        if (el.closest('#genzai-extension-root')) continue;
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                          rect.top < window.innerHeight && rect.bottom > 0;
                        if (isVisible) {
                            const text = (el.innerText || '').trim();
                            if (text.length > 25 && text.length < 3500 && !detectedQuestions.includes(text)) {
                                detectedQuestions.push(text);
                            }
                        }
                    }
                } catch (e) {}
            }

            // 2. Extract visible text in the viewport (headings, questions, options, radio labels)
            const visibleItems = [];
            try {
                const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, label, li, pre, code, [role="radio"], [role="option"], .option, .choice, [class*="option"], [class*="choice"]');
                candidates.forEach(el => {
                    if (el.closest('#genzai-extension-root')) return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && 
                        rect.top >= -50 && rect.top <= window.innerHeight + 50 && 
                        rect.left >= 0 && rect.left <= window.innerWidth) {
                        const t = (el.innerText || '').trim();
                        if (t && t.length > 2 && !visibleItems.includes(t)) {
                            visibleItems.push(t);
                        }
                    }
                });
            } catch (e) {}

            // 3. Fallback to clean body text
            let fallbackText = '';
            try {
                const clone = document.body.cloneNode(true);
                const removeEls = clone.querySelectorAll('script, style, noscript, nav, footer, #genzai-extension-root');
                removeEls.forEach(el => el.remove());
                fallbackText = (clone.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
            } catch (e) {}

            let finalContent = '';
            if (detectedQuestions.length > 0) {
                finalContent = detectedQuestions.join('\n\n---\n\n');
            } else if (visibleItems.length > 0) {
                finalContent = visibleItems.join('\n');
            } else {
                finalContent = fallbackText;
            }

            return {
                title: title,
                url: url,
                combinedText: finalContent.slice(0, 3500)
            };
        }

        function extractPageContext() {
            return extractScreenQuestionContext();
        }

        function setPageContext(active, customTitle) {
            state.pageContextActive = active;
            if (active) {
                const ctx = extractScreenQuestionContext();
                contextTitle.innerText = customTitle || ctx.title;
                contextBar.style.display = 'flex';
                pageContextBtn.classList.add('active');
            } else {
                contextBar.style.display = 'none';
                pageContextBtn.classList.remove('active');
            }
        }

        function appendMessage(role, content, citations) {
            if (welcomeBox) welcomeBox.style.display = 'none';

            const row = document.createElement('div');
            row.className = `msg-row ${role}`;

            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            avatar.innerHTML = role === 'user' ? 'ME' : ICONS.sparkles;

            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.innerHTML = formatMarkdown(content);

            if (citations && citations.length > 0) {
                const citeBox = document.createElement('div');
                citeBox.style.marginTop = '6px';
                citeBox.innerHTML = citations.map(c => `
                    <span class="citation-badge" title="Score: ${Math.round((c.score || 0) * 100)}%">
                        ${ICONS.fileText} ${c.source} ${c.page ? `(p.${c.page})` : ''}
                    </span>
                `).join('');
                bubble.appendChild(citeBox);
            }

            row.appendChild(avatar);
            row.appendChild(bubble);
            messagesContainer.appendChild(row);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function showTypingIndicator() {
            removeTypingIndicator();
            const typingEl = document.createElement('div');
            typingEl.className = 'msg-row assistant';
            typingEl.id = 'gzExtTyping';
            typingEl.innerHTML = `
                <div class="msg-avatar">${ICONS.sparkles}</div>
                <div class="typing-indicator">
                    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                </div>
            `;
            messagesContainer.appendChild(typingEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function removeTypingIndicator() {
            const el = shadow.getElementById('gzExtTyping');
            if (el) el.remove();
        }

        async function fetchModels() {
            try {
                const data = await safeApiFetch(`${config.serverUrl}/api/models`);
                if (data && data.models && Array.isArray(data.models)) {
                    // Combine server models with all target models
                    const targetIds = TARGET_MODELS.map(m => m.id);
                    const combined = Array.from(new Set([...data.models, ...targetIds]));
                    state.models = combined;

                    modelSelect.innerHTML = combined.map(m => `
                        <option value="${m}" ${m === state.selectedModel ? 'selected' : ''}>${getModelLabel(m)}</option>
                    `).join('');
                }
                statusDot.style.backgroundColor = '#10b981';
                statusDot.title = `Connected to ${config.serverUrl}`;
            } catch (e) {
                statusDot.style.backgroundColor = '#f59e0b';
                statusDot.title = `Cannot reach server at ${config.serverUrl}`;
            }
        }

        /**
         * 📸 Core Feature: Read Screen & Answer Question
         * Scans the active screen, parses MCQ or practice problem, and provides verified answer
         */
        async function readScreenAndAnswer(customQuery) {
            if (state.isLoading) return;

            setPageContext(true, "📸 Reading Active Screen...");
            const screenData = extractScreenQuestionContext();

            const userDisplay = customQuery || "📸 Read screen and solve the question";
            appendMessage('user', userDisplay);
            state.messages.push({ role: 'user', content: userDisplay });

            state.isLoading = true;
            sendBtn.disabled = true;
            showTypingIndicator();

            const solvingPrompt = `[ACTIVE SCREEN ANALYSIS & QUESTION SOLVING]
The user is viewing a webpage containing a test, quiz, or multiple-choice question (MCQ).
Page Title: "${screenData.title}"
URL: "${screenData.url}"

[CONTENT VISIBLE ON THE USER'S SCREEN]:
"""
${screenData.combinedText}
"""

TASK FOR GENZ AI:
1. Identify the primary question being asked on the screen and all available answer options.
2. At the very top, state the **CORRECT ANSWER** clearly and prominently in bold (e.g. "**Correct Answer:** Option ...").
3. Provide a clear, step-by-step conceptual or mathematical explanation explaining why this option is correct.
4. Briefly explain why the other options are incorrect.
User Query / Directive: ${customQuery || "Please solve this question from my screen and give the correct answer."}`;

            let payloadMessages = [
                { role: 'user', content: solvingPrompt }
            ];

            try {
                const data = await safeApiFetch(`${config.serverUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: state.selectedModel,
                        messages: payloadMessages,
                        temperature: 0.2, // precise & deterministic for test questions
                        max_tokens: 1024
                    })
                });

                removeTypingIndicator();

                const assistantMsg = data.choices && data.choices[0] && data.choices[0].message
                    ? data.choices[0].message.content
                    : 'Could not generate an answer from the screen content.';
                appendMessage('assistant', assistantMsg, data.citations || []);
                state.messages.push({ role: 'assistant', content: assistantMsg });

            } catch (err) {
                removeTypingIndicator();
                appendMessage('assistant', `⚠️ **Error reading screen**: ${err.message || 'Could not connect to GenZ AI server'}.\n\nEnsure your local server is running (\`http://127.0.0.1:5000\`). [Switch to Local Server](#use-local-server)`);
            } finally {
                state.isLoading = false;
                sendBtn.disabled = false;
            }
        }

        async function sendMessage(overrideText) {
            const text = (overrideText || textarea.value).trim();
            if (!text || state.isLoading) return;

            // Detect natural language screen reading / question solving intent
            const lower = text.toLowerCase();
            const isScreenReadingIntent = 
                lower.includes('read screen') ||
                lower.includes('read the screen') ||
                lower.includes('solve this') ||
                lower.includes('solve question') ||
                lower.includes('answer this') ||
                lower.includes('what is the answer') ||
                lower.includes('answer the question') ||
                lower.includes('which option') ||
                lower.includes('solve mcq') ||
                (lower === 'solve') ||
                (lower === 'answer') ||
                (lower === 'read');

            if (isScreenReadingIntent) {
                textarea.value = '';
                textarea.style.height = 'auto';
                readScreenAndAnswer(text);
                return;
            }

            textarea.value = '';
            textarea.style.height = 'auto';

            appendMessage('user', text);
            state.messages.push({ role: 'user', content: text });

            let payloadMessages = [...state.messages];
            if (state.pageContextActive) {
                const ctx = extractScreenQuestionContext();
                const pagePrompt = `[Current Webpage Screen Context]\nTitle: "${ctx.title}"\nURL: "${ctx.url}"\nContent excerpt:\n"${ctx.combinedText}"\n\nPlease consider the page context above when answering.`;
                payloadMessages.unshift({ role: 'system', content: pagePrompt });
            }

            state.isLoading = true;
            sendBtn.disabled = true;
            showTypingIndicator();

            try {
                const data = await safeApiFetch(`${config.serverUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: state.selectedModel,
                        messages: payloadMessages,
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                });

                removeTypingIndicator();

                const assistantMsg = data.choices && data.choices[0] && data.choices[0].message
                    ? data.choices[0].message.content
                    : 'No response received.';
                appendMessage('assistant', assistantMsg, data.citations || []);
                state.messages.push({ role: 'assistant', content: assistantMsg });

            } catch (err) {
                removeTypingIndicator();
                const isTunnel = config.serverUrl.includes('trycloudflare.com') || (!config.serverUrl.includes('127.0.0.1') && !config.serverUrl.includes('localhost'));
                const displayUrl = (config.serverUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

                let msg = `⚠️ **Connection Error**: Could not connect to GenZ AI Server at \`${config.serverUrl}\`.\n\n`;

                if (isTunnel) {
                    msg += `🖥️ **Using on Your Own Computer (Host)?**\n` +
                        `Your local server is faster and direct without needing public tunnels:\n` +
                        `[Switch to My Local Server (http://127.0.0.1:5000)](#use-local-server)\n\n` +
                        `🌐 **Friend's Remote Access:**\n` +
                        `If your friend is accessing or your Cloudflare tunnel restarted:\n` +
                        `[Click to Enter New Tunnel URL](#change-server-url) or click (${displayUrl} ⚙️) at bottom right.`;
                } else {
                    msg += `🖥️ **Local Server Check:**\n` +
                        `Please verify your local Python backend is running:\n` +
                        `• Run \`python app.py\` (or double-click \`start_online.bat\`) in your project folder.\n\n` +
                        `[Retry Connection](#retry-connection) · [Switch to Friend / Online Tunnel URL](#change-server-url)`;
                }

                appendMessage('assistant', msg);
            } finally {
                state.isLoading = false;
                sendBtn.disabled = false;
            }
        }

        function switchToMyLocalServer() {
            const localUrl = 'http://127.0.0.1:5000';
            config.serverUrl = localUrl;
            chrome.storage.local.set({ serverUrl: localUrl }, () => {
                updateServerStatusUI(localUrl);
                appendMessage('assistant', `✅ Switched to **My Local Server** (\`${localUrl}\`). Connecting...`);
                fetchModels();
            });
        }

        function promptChangeServerUrl() {
            const promptText = `Select GenZ AI Server:\n\n` +
                `1. Enter '1' or 'local' to use My Local Server (http://127.0.0.1:5000)\n` +
                `2. Or enter Friend's Public Cloudflare Tunnel URL (https://...trycloudflare.com):\n\n` +
                `Current: ${config.serverUrl}`;
            
            const entered = window.prompt(promptText, config.serverUrl);
            if (entered !== null) {
                let clean = entered.trim();
                if (clean === '1' || clean.toLowerCase() === 'local' || clean === '') {
                    clean = 'http://127.0.0.1:5000';
                } else {
                    clean = clean.replace(/\/$/, '');
                    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                        clean = 'https://' + clean;
                    }
                }
                if (clean !== config.serverUrl) {
                    config.serverUrl = clean;
                    chrome.storage.local.set({ serverUrl: clean }, () => {
                        updateServerStatusUI(clean);
                        fetchModels();
                        appendMessage('assistant', `✅ Server updated to \`${clean}\`. Reconnecting...`);
                    });
                }
            }
        }

        if (serverStatusTextEl) {
            serverStatusTextEl.addEventListener('click', promptChangeServerUrl);
        }

        // Auto-sync settings if updated in extension popup
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local') {
                    if (changes.serverUrl && changes.serverUrl.newValue) {
                        updateServerStatusUI(changes.serverUrl.newValue);
                        fetchModels();
                    }
                    if (changes.defaultModel && changes.defaultModel.newValue) {
                        state.selectedModel = changes.defaultModel.newValue;
                        if (modelSelect) modelSelect.value = changes.defaultModel.newValue;
                    }
                }
            });
        }

        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });

        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        launcherBtn.addEventListener('click', () => toggleChat());
        if (closeGreeting) {
            closeGreeting.addEventListener('click', (e) => {
                e.stopPropagation();
                greetingBadge.style.display = 'none';
            });
        }
        if (greetingBadge) {
            greetingBadge.addEventListener('click', () => {
                greetingBadge.style.display = 'none';
                toggleChat(true);
            });
        }

        minimizeBtn.addEventListener('click', () => toggleChat(false));
        clearChatBtn.addEventListener('click', () => {
            state.messages = [];
            messagesContainer.innerHTML = '';
            if (welcomeBox) {
                messagesContainer.appendChild(welcomeBox);
                welcomeBox.style.display = 'block';
            }
        });

        pageContextBtn.addEventListener('click', () => setPageContext(!state.pageContextActive));
        readScreenBtn.addEventListener('click', () => readScreenAndAnswer());
        quickReadScreenBtn.addEventListener('click', () => readScreenAndAnswer());
        quickSummarizeBtn.addEventListener('click', () => {
            setPageContext(true);
            sendMessage("Please provide a thorough 3-5 bullet point summary of this webpage with its key takeaways.");
        });

        disableContextBtn.addEventListener('click', () => setPageContext(false));
        sendBtn.addEventListener('click', () => sendMessage());

        modelSelect.addEventListener('change', (e) => {
            state.selectedModel = e.target.value;
            chrome.storage.local.set({ defaultModel: e.target.value });
        });

        shadow.addEventListener('click', (e) => {
            if (e.target.closest('.gz-change-url-btn') || e.target.closest('button[data-action="change-url"]')) {
                promptChangeServerUrl();
                return;
            }
            if (e.target.closest('.gz-use-local-btn') || e.target.closest('button[data-action="use-local"]')) {
                switchToMyLocalServer();
                return;
            }
            if (e.target.closest('.gz-retry-btn')) {
                appendMessage('assistant', `🔄 Retrying connection to \`${config.serverUrl}\`...`);
                fetchModels();
                return;
            }
            if (e.target.closest('[data-action="read-screen"]')) {
                readScreenAndAnswer();
                return;
            }
            const chip = e.target.closest('.chip-btn');
            if (chip) {
                const query = chip.getAttribute('data-query');
                if (query) {
                    if (query.includes('summary') || query.includes('webpage')) {
                        setPageContext(true);
                    }
                    sendMessage(query);
                }
            }
        });

        fetchModels();

        window.GenZAIExtensionInstance = {
            open: () => toggleChat(true),
            close: () => toggleChat(false),
            setContext: (active) => setPageContext(active),
            send: (text) => sendMessage(text),
            readScreen: (prompt) => readScreenAndAnswer(prompt)
        };
    }
})();
