/**
 * GenZ AI — Chrome / Edge Extension Content Script
 * Injects a floating AI chat box popup onto any webpage the user visits.
 * Total styling isolation using Shadow DOM.
 */
(function() {
    if (window.__GENZAI_EXTENSION_CONTENT_INJECTED__) return;
    window.__GENZAI_EXTENSION_CONTENT_INJECTED__ = true;

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
        }
        return true;
    });

    function initExtensionWidget(settings) {
        if (document.getElementById('genzai-extension-root')) return;

        const config = {
            serverUrl: settings.serverUrl || 'http://127.0.0.1:5000',
            defaultModel: settings.defaultModel || 'genZai (Custom Trained Model)',
            position: settings.position || 'bottom-right',
            title: 'GenZ AI Copilot',
            subtitle: 'Browser Extension · Powered by NVIDIA NIM',
            greeting: 'Hi! I can summarize this page or answer any questions.',
            autoGreeting: true
        };

        const state = {
            isOpen: false,
            isLoading: false,
            messages: [],
            models: [config.defaultModel],
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
            globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
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
                position: absolute;
                bottom: 68px; right: 0;
                background: #151720;
                border: 1px solid #2d3345;
                color: #ffffff;
                padding: 9px 13px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                box-shadow: var(--gz-shadow);
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .greeting-close {
                border: none; background: transparent; color: var(--gz-text-muted); cursor: pointer;
                display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;
            }
            .greeting-close:hover { color: #fff; }
            .chat-window {
                position: absolute;
                bottom: 70px; right: 0;
                width: 380px;
                max-width: calc(100vw - 32px);
                height: 580px;
                max-height: calc(100vh - 90px);
                background: var(--gz-bg-main);
                border: 1px solid var(--gz-border);
                border-radius: 18px;
                box-shadow: var(--gz-shadow);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.92) translateY(20px);
                pointer-events: none;
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                transform-origin: bottom right;
                backdrop-filter: blur(16px);
            }
            .chat-window.open {
                opacity: 1;
                transform: scale(1) translateY(0);
                pointer-events: auto;
            }
            .chat-header {
                padding: 12px 16px;
                background: var(--gz-bg-card);
                border-bottom: 1px solid var(--gz-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-shrink: 0;
            }
            .header-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .brand-avatar {
                width: 34px; height: 34px; border-radius: 10px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
            }
            .brand-title { font-size: 14px; font-weight: 600; color: #fff; }
            .status-dot {
                width: 7px; height: 7px; border-radius: 50%;
                background-color: var(--gz-accent-emerald);
                box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
            }
            .model-select {
                background: transparent; border: none; color: var(--gz-text-sub);
                font-size: 11px; cursor: pointer; max-width: 170px; outline: none;
            }
            .model-select option { background: var(--gz-bg-card); color: var(--gz-text); }
            .header-actions { display: flex; align-items: center; gap: 4px; }
            .header-btn {
                width: 28px; height: 28px; border-radius: 6px;
                background: transparent; border: none; color: var(--gz-text-sub);
                display: flex; align-items: center; justify-content: center; cursor: pointer;
            }
            .header-btn:hover { background: var(--gz-bg-subtle); color: #fff; }
            .header-btn.active { background: rgba(99, 102, 241, 0.2); color: var(--gz-primary); }
            .context-bar {
                padding: 6px 14px; background: #11141c; border-bottom: 1px solid var(--gz-border);
                display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--gz-text-muted);
            }
            .context-indicator { display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .context-toggle-btn { border: none; background: transparent; color: var(--gz-primary); font-size: 11px; cursor: pointer; }
            .messages-container {
                flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px;
            }
            .welcome-box {
                background: var(--gz-bg-card); border: 1px solid var(--gz-border); border-radius: 14px; padding: 14px;
            }
            .welcome-box h3 { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
            .welcome-box p { font-size: 12px; color: var(--gz-text-sub); line-height: 1.4; margin-bottom: 10px; }
            .quick-chips { display: flex; flex-direction: column; gap: 6px; }
            .chip-btn {
                background: var(--gz-bg-subtle); border: 1px solid var(--gz-border); border-radius: 8px;
                padding: 8px 10px; font-size: 12px; color: var(--gz-text); text-align: left; cursor: pointer;
                display: flex; align-items: center; gap: 8px; font-family: inherit;
            }
            .chip-btn:hover { background: rgba(99, 102, 241, 0.12); border-color: var(--gz-primary); color: #fff; }
            .msg-row { display: flex; gap: 8px; max-width: 100%; }
            .msg-row.user { justify-content: flex-end; }
            .msg-avatar {
                width: 24px; height: 24px; border-radius: 6px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; flex-shrink: 0;
            }
            .msg-bubble {
                max-width: 85%; padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.45; word-break: break-word;
            }
            .msg-row.user .msg-bubble { background: #4f46e5; color: #ffffff; border-bottom-right-radius: 3px; }
            .msg-row.assistant .msg-bubble { background: var(--gz-bg-card); border: 1px solid var(--gz-border); border-bottom-left-radius: 3px; }
            .msg-bubble p { margin-bottom: 6px; }
            .msg-bubble p:last-child { margin-bottom: 0; }
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
            .chat-footer { padding: 10px 14px; background: var(--gz-bg-card); border-top: 1px solid var(--gz-border); display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
            .input-row { display: flex; align-items: flex-end; gap: 6px; background: var(--gz-bg-subtle); border: 1px solid var(--gz-border); border-radius: 10px; padding: 7px 9px; }
            .input-row:focus-within { border-color: var(--gz-primary); }
            .chat-textarea { flex: 1; background: transparent; border: none; color: var(--gz-text); font-family: inherit; font-size: 13px; max-height: 80px; resize: none; outline: none; }
            .send-btn { width: 30px; height: 30px; border-radius: 6px; background: var(--gz-primary); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .send-btn:hover:not(:disabled) { background: var(--gz-primary-hover); }
            .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .footer-branding { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--gz-text-muted); }
        `;
        shadow.appendChild(styleEl);

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
                                <span class="status-dot" id="gzStatusDot"></span>
                            </div>
                            <select class="model-select" id="gzModelSelect">
                                <option value="${config.defaultModel}">${config.defaultModel}</option>
                            </select>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="header-btn" id="gzPageContextBtn" title="Attach webpage context">${ICONS.fileText}</button>
                        <button class="header-btn" id="gzClearChatBtn" title="Clear chat">${ICONS.trash}</button>
                        <button class="header-btn" id="gzMinimizeBtn" title="Minimize">${ICONS.minus}</button>
                    </div>
                </div>
                <div class="context-bar" id="gzContextBar" style="display:none;">
                    <div class="context-indicator">
                        ${ICONS.globe}
                        <span id="gzContextTitle">Webpage Context</span>
                    </div>
                    <button class="context-toggle-btn" id="gzDisableContextBtn">Remove</button>
                </div>
                <div class="messages-container" id="gzMessagesContainer">
                    <div class="welcome-box" id="gzWelcomeBox">
                        <h3>${ICONS.sparkles} GenZ AI Web Copilot</h3>
                        <p>Ask anything, summarize this webpage, or query your custom trained genZai model.</p>
                        <div class="quick-chips">
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
                    <div class="input-row">
                        <textarea class="chat-textarea" id="gzTextarea" placeholder="Ask GenZ AI anything on this page..." rows="1"></textarea>
                        <button class="send-btn" id="gzSendBtn">${ICONS.send}</button>
                    </div>
                    <div class="footer-branding">
                        <span>${config.subtitle}</span>
                        <span id="gzServerStatusText" style="cursor:pointer;color:#818cf8;text-decoration:underline;display:inline-flex;align-items:center;gap:3px;" title="Click to change Server URL (Online / Local)">
                            ${(config.serverUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')} ⚙️
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
        const contextBar = shadow.getElementById('gzContextBar');
        const contextTitle = shadow.getElementById('gzContextTitle');
        const disableContextBtn = shadow.getElementById('gzDisableContextBtn');
        const messagesContainer = shadow.getElementById('gzMessagesContainer');
        const welcomeBox = shadow.getElementById('gzWelcomeBox');
        const textarea = shadow.getElementById('gzTextarea');
        const sendBtn = shadow.getElementById('gzSendBtn');
        const modelSelect = shadow.getElementById('gzModelSelect');
        const statusDot = shadow.getElementById('gzStatusDot');

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
                    return `<button class="gz-change-url-btn" style="background:#6366f1;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;margin:4px 0;font-weight:600;">⚙️ ${p1}</button>`;
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

        function extractPageContext() {
            const title = document.title || 'Untitled Webpage';
            const url = window.location.href;
            let text = '';
            try {
                const clone = document.body.cloneNode(true);
                const removeEls = clone.querySelectorAll('script, style, noscript, nav, footer, #genzai-extension-root');
                removeEls.forEach(el => el.remove());
                text = (clone.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
            } catch (e) {
                text = (document.body.innerText || '').slice(0, 2000);
            }
            return { title, url, text };
        }

        function setPageContext(active) {
            state.pageContextActive = active;
            if (active) {
                pageContextBtn.classList.add('active');
                contextBar.style.display = 'flex';
                const ctx = extractPageContext();
                contextTitle.innerText = `Page: ${ctx.title.slice(0, 26)}...`;
            } else {
                pageContextBtn.classList.remove('active');
                contextBar.style.display = 'none';
            }
        }

        function appendMessage(role, content, citations) {
            if (welcomeBox) welcomeBox.style.display = 'none';
            const row = document.createElement('div');
            row.className = `msg-row ${role}`;
            let citationHtml = '';
            if (citations && citations.length > 0) {
                citationHtml = `
                    <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--gz-border);">
                        <span style="font-size:10px;color:#a5b4fc;display:block;margin-bottom:2px;font-weight:600;">📚 genZai Knowledge:</span>
                        ${citations.map(c => `<span class="citation-badge">${c.source}</span>`).join('')}
                    </div>
                `;
            }

            if (role === 'user') {
                row.innerHTML = `<div class="msg-bubble">${formatMarkdown(content)}</div>`;
            } else {
                row.innerHTML = `<div class="msg-avatar">${ICONS.sparkles}</div><div class="msg-bubble">${formatMarkdown(content)}${citationHtml}</div>`;
            }
            messagesContainer.appendChild(row);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function showTypingIndicator() {
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
                const resp = await fetch(`${config.serverUrl}/api/models`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.models && Array.isArray(data.models)) {
                        state.models = data.models;
                        modelSelect.innerHTML = data.models.map(m => `
                            <option value="${m}" ${m === state.selectedModel ? 'selected' : ''}>${m}</option>
                        `).join('');
                    }
                    statusDot.style.backgroundColor = '#10b981';
                }
            } catch (e) {
                statusDot.style.backgroundColor = '#f59e0b';
            }
        }

        async function sendMessage(overrideText) {
            const text = (overrideText || textarea.value).trim();
            if (!text || state.isLoading) return;

            textarea.value = '';
            textarea.style.height = 'auto';

            appendMessage('user', text);
            state.messages.push({ role: 'user', content: text });

            let payloadMessages = [...state.messages];
            if (state.pageContextActive) {
                const ctx = extractPageContext();
                const pagePrompt = `[Current Webpage Context]\nTitle: "${ctx.title}"\nURL: "${ctx.url}"\nContent excerpt:\n"${ctx.text}"\n\nPlease consider the page context above when answering.`;
                payloadMessages.unshift({ role: 'system', content: pagePrompt });
            }

            state.isLoading = true;
            sendBtn.disabled = true;
            showTypingIndicator();

            try {
                const response = await fetch(`${config.serverUrl}/api/chat`, {
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

                if (!response.ok) {
                    let errText = 'Server error occurred.';
                    try { const errJson = await response.json(); errText = errJson.error || errText; } catch(e) {}
                    appendMessage('assistant', `⚠️ **Error**: ${errText}`);
                    return;
                }

                const data = await response.json();
                const assistantMsg = data.choices && data.choices[0] && data.choices[0].message
                    ? data.choices[0].message.content
                    : 'No response received.';
                appendMessage('assistant', assistantMsg, data.citations || []);
                state.messages.push({ role: 'assistant', content: assistantMsg });

            } catch (err) {
                removeTypingIndicator();
                const displayUrl = (config.serverUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
                appendMessage('assistant', `⚠️ **Connection Error**: Could not connect to GenZ AI Server at \`${config.serverUrl}\`.\n\n🌐 **Taking it Online / Connecting to Friend's Server:**\nIf your server is hosted online (e.g. via Cloudflare HTTPS Tunnel or Cloud Web Service):\n[Click Here to Enter Server URL](#change-server-url) or click the server address in the bottom right corner (${displayUrl} ⚙️).`);
            } finally {
                state.isLoading = false;
                sendBtn.disabled = false;
            }
        }

        function promptChangeServerUrl() {
            const current = config.serverUrl || 'http://127.0.0.1:5000';
            const entered = window.prompt("Enter GenZ AI Server URL (Cloudflare HTTPS or Render URL):", current);
            if (entered !== null) {
                const clean = entered.trim().replace(/\/$/, '');
                if (clean && clean !== current) {
                    config.serverUrl = clean;
                    chrome.storage.local.set({ serverUrl: clean }, () => {
                        const statusTextEl = shadow.getElementById('gzServerStatusText');
                        if (statusTextEl) {
                            statusTextEl.innerHTML = `${clean.replace(/^https?:\/\//, '')} ⚙️`;
                        }
                        fetchModels();
                        appendMessage('assistant', `✅ Server URL updated to \`${clean}\`. Reconnecting...`);
                    });
                }
            }
        }

        const serverStatusTextEl = shadow.getElementById('gzServerStatusText');
        if (serverStatusTextEl) {
            serverStatusTextEl.addEventListener('click', promptChangeServerUrl);
        }

        // Auto-sync settings if updated in extension popup
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && changes.serverUrl && changes.serverUrl.newValue) {
                    config.serverUrl = changes.serverUrl.newValue;
                    const stEl = shadow.getElementById('gzServerStatusText');
                    if (stEl) {
                        stEl.innerHTML = `${config.serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} ⚙️`;
                    }
                    fetchModels();
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
        disableContextBtn.addEventListener('click', () => setPageContext(false));
        sendBtn.addEventListener('click', () => sendMessage());
        modelSelect.addEventListener('change', (e) => { state.selectedModel = e.target.value; });

        shadow.addEventListener('click', (e) => {
            if (e.target.closest('.gz-change-url-btn')) {
                promptChangeServerUrl();
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
            send: (text) => sendMessage(text)
        };
    }
})();
