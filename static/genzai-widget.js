/**
 * GenZ AI — Universal Embeddable Web Chatbox Widget & Extension Bridge
 * Embeds a floating AI copilot popup into any website using an isolated Shadow DOM.
 * Zero CSS pollution, fully responsive, powered by genZai & NVIDIA NIM.
 */
(function() {
    // Prevent double initialization
    if (window.__GENZAI_WIDGET_INITIALIZED__) return;
    window.__GENZAI_WIDGET_INITIALIZED__ = true;

    // Detect script configuration
    const currentScript = document.currentScript || (function() {
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            if (scripts[i].src && scripts[i].src.includes('genzai-widget.js')) {
                return scripts[i];
            }
        }
        return null;
    })();

    // Default configuration
    let defaultServerUrl = 'http://127.0.0.1:5000';
    if (currentScript && currentScript.src) {
        try {
            const urlObj = new URL(currentScript.src);
            defaultServerUrl = urlObj.origin;
        } catch(e) {}
    }

    const userConfig = window.GenZAIWidgetConfig || {};
    const config = {
        serverUrl: currentScript?.getAttribute('data-server') || userConfig.serverUrl || defaultServerUrl,
        defaultModel: currentScript?.getAttribute('data-model') || userConfig.defaultModel || 'genZai (Custom Trained Model)',
        position: currentScript?.getAttribute('data-position') || userConfig.position || 'bottom-right', // 'bottom-right' or 'bottom-left'
        theme: currentScript?.getAttribute('data-theme') || userConfig.theme || 'dark',
        title: currentScript?.getAttribute('data-title') || userConfig.title || 'GenZ AI Copilot',
        subtitle: currentScript?.getAttribute('data-subtitle') || userConfig.subtitle || 'Custom Model & Web Assistant',
        greeting: currentScript?.getAttribute('data-greeting') || userConfig.greeting || 'Hi there! 👋 How can I help you today?',
        autoGreeting: currentScript?.getAttribute('data-auto-greeting') !== 'false' && userConfig.autoGreeting !== false,
        includePageContext: false
    };

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

    function getWidgetModelLabel(id) {
        const found = TARGET_MODELS.find(m => m.id === id);
        if (found) return found.label;
        if (id.toLowerCase().includes('genzai')) return `✦ ${id}`;
        return `⚡ ${id}`;
    }

    // State
    const state = {
        isOpen: false,
        isLoading: false,
        messages: [],
        models: TARGET_MODELS.map(m => m.id),
        selectedModel: config.defaultModel,
        pageContextActive: false,
        unreadCount: 0
    };

    // SVG Icons
    const ICONS = {
        sparkles: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
        close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        minus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
        trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        fileText: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
        copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`
    };

    // Create Container and Shadow DOM for total isolation
    const hostEl = document.createElement('div');
    hostEl.id = 'genzai-widget-root';
    hostEl.style.position = 'fixed';
    hostEl.style.zIndex = '2147483647';
    hostEl.style.pointerEvents = 'none'; // allow click through around widget
    if (config.position === 'bottom-left') {
        hostEl.style.bottom = '20px';
        hostEl.style.left = '20px';
    } else {
        hostEl.style.bottom = '20px';
        hostEl.style.right = '20px';
    }
    document.body.appendChild(hostEl);

    const shadow = hostEl.attachShadow({ mode: 'open' });

    // Inject Styles inside Shadow DOM
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        :host {
            --gz-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
            --gz-bg-main: #0c0d12;
            --gz-bg-card: #13151b;
            --gz-bg-subtle: #1a1d26;
            --gz-bg-user: #222633;
            --gz-border: #232733;
            --gz-border-hover: #373e52;
            --gz-primary: #6366f1;
            --gz-primary-hover: #4f46e5;
            --gz-primary-glow: rgba(99, 102, 241, 0.35);
            --gz-accent-violet: #8b5cf6;
            --gz-accent-emerald: #10b981;
            --gz-text: #f3f4f6;
            --gz-text-sub: #9ca3af;
            --gz-text-muted: #6b7280;
            --gz-shadow: 0 12px 40px -4px rgba(0, 0, 0, 0.75), 0 4px 16px -2px rgba(0, 0, 0, 0.4);
            font-family: var(--gz-font);
            box-sizing: border-box;
            color: var(--gz-text);
        }

        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        .widget-wrapper {
            position: relative;
            pointer-events: auto;
            display: flex;
            flex-direction: column;
            align-items: ${config.position === 'bottom-left' ? 'flex-start' : 'flex-end'};
            font-family: var(--gz-font);
        }

        /* Launcher Floating Trigger */
        .launcher-btn {
            width: 58px;
            height: 58px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #4338ca 100%);
            border: 2px solid rgba(255, 255, 255, 0.15);
            color: #ffffff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 24px rgba(99, 102, 241, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            outline: none;
            user-select: none;
        }

        .launcher-btn:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 10px 30px rgba(99, 102, 241, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .launcher-btn:active {
            transform: scale(0.96);
        }

        .launcher-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.25s ease;
        }

        .launcher-icon svg {
            width: 26px;
            height: 26px;
        }

        /* Pulse Ring */
        .pulse-ring {
            position: absolute;
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: -4px;
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

        /* Proactive Greeting Tooltip */
        .greeting-badge {
            position: absolute;
            bottom: 70px;
            ${config.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
            background: #151720;
            border: 1px solid var(--gz-border-hover);
            color: #ffffff;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            box-shadow: var(--gz-shadow);
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            animation: gz-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .greeting-badge:hover {
            background: #1b1e2a;
            border-color: var(--gz-primary);
        }

        .greeting-close {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            color: var(--gz-text-muted);
            border: none;
            background: transparent;
            cursor: pointer;
        }
        .greeting-close:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.1);
        }

        /* Chat Window Popup */
        .chat-window {
            position: absolute;
            bottom: 74px;
            ${config.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
            width: 380px;
            max-width: calc(100vw - 36px);
            height: 590px;
            max-height: calc(100vh - 100px);
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
            transform-origin: ${config.position === 'bottom-left' ? 'bottom left' : 'bottom right'};
            backdrop-filter: blur(16px);
        }

        .chat-window.open {
            opacity: 1;
            transform: scale(1) translateY(0);
            pointer-events: auto;
        }

        /* Header */
        .chat-header {
            padding: 14px 16px;
            background: var(--gz-bg-card);
            border-bottom: 1px solid var(--gz-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
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
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            flex-shrink: 0;
            box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
        }

        .brand-meta {
            min-width: 0;
        }

        .brand-title-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .brand-title {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            letter-spacing: -0.01em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: var(--gz-accent-emerald);
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
            flex-shrink: 0;
        }

        .model-select-wrapper {
            margin-top: 2px;
        }

        .model-select {
            background: transparent;
            border: none;
            color: var(--gz-text-sub);
            font-size: 11px;
            font-family: inherit;
            cursor: pointer;
            padding: 0;
            max-width: 180px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            outline: none;
        }

        .model-select option {
            background: var(--gz-bg-card);
            color: var(--gz-text);
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }

        .header-btn {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            background: transparent;
            border: 1px solid transparent;
            color: var(--gz-text-sub);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .header-btn:hover {
            background: var(--gz-bg-subtle);
            color: #ffffff;
            border-color: var(--gz-border);
        }

        .header-btn.active {
            background: rgba(99, 102, 241, 0.15);
            color: var(--gz-primary);
            border-color: rgba(99, 102, 241, 0.3);
        }

        /* Page Context Toolbar Strip */
        .context-bar {
            padding: 6px 14px;
            background: #11141c;
            border-bottom: 1px solid var(--gz-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: var(--gz-text-muted);
        }

        .context-indicator {
            display: flex;
            align-items: center;
            gap: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .context-toggle-btn {
            border: none;
            background: transparent;
            color: var(--gz-primary);
            font-size: 11px;
            cursor: pointer;
            font-weight: 500;
        }
        .context-toggle-btn:hover {
            text-decoration: underline;
        }

        /* Messages Body Area */
        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            scroll-behavior: smooth;
        }

        .messages-container::-webkit-scrollbar {
            width: 5px;
        }
        .messages-container::-webkit-scrollbar-thumb {
            background: var(--gz-border);
            border-radius: 4px;
        }

        /* Welcome Empty State */
        .welcome-box {
            background: var(--gz-bg-card);
            border: 1px solid var(--gz-border);
            border-radius: 14px;
            padding: 16px;
            text-align: left;
            margin-bottom: 6px;
        }

        .welcome-box h3 {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .welcome-box p {
            font-size: 12px;
            color: var(--gz-text-sub);
            line-height: 1.45;
            margin-bottom: 12px;
        }

        .quick-chips {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .chip-btn {
            background: var(--gz-bg-subtle);
            border: 1px solid var(--gz-border);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 12px;
            color: var(--gz-text);
            text-align: left;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.15s ease;
            font-family: inherit;
        }

        .chip-btn:hover {
            background: rgba(99, 102, 241, 0.1);
            border-color: var(--gz-primary);
            color: #ffffff;
        }

        .chip-btn svg {
            color: var(--gz-primary);
            flex-shrink: 0;
        }

        /* Chat Message Bubbles */
        .msg-row {
            display: flex;
            gap: 10px;
            max-width: 100%;
        }

        .msg-row.user {
            justify-content: flex-end;
        }

        .msg-avatar {
            width: 26px;
            height: 26px;
            border-radius: 8px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 11px;
            flex-shrink: 0;
            margin-top: 2px;
        }

        .msg-avatar svg {
            width: 14px;
            height: 14px;
        }

        .msg-bubble {
            max-width: 84%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 13px;
            line-height: 1.5;
            word-break: break-word;
        }

        .msg-row.user .msg-bubble {
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
            color: #ffffff;
            border-bottom-right-radius: 4px;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
        }

        .msg-row.assistant .msg-bubble {
            background: var(--gz-bg-card);
            border: 1px solid var(--gz-border);
            color: var(--gz-text);
            border-bottom-left-radius: 4px;
        }

        /* Citations Accordion */
        .citations-wrap {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed var(--gz-border);
        }

        .citation-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(99, 102, 241, 0.12);
            border: 1px solid rgba(99, 102, 241, 0.25);
            color: #a5b4fc;
            font-size: 10px;
            padding: 3px 7px;
            border-radius: 6px;
            margin-right: 4px;
            margin-bottom: 4px;
        }

        /* Markdown inside messages */
        .msg-bubble p {
            margin-bottom: 8px;
        }
        .msg-bubble p:last-child {
            margin-bottom: 0;
        }
        .msg-bubble code {
            background: rgba(0, 0, 0, 0.35);
            padding: 2px 5px;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            color: #a5b4fc;
        }
        .msg-bubble pre {
            background: #090a0f;
            border: 1px solid var(--gz-border);
            border-radius: 8px;
            padding: 10px;
            margin: 8px 0;
            overflow-x: auto;
            position: relative;
        }
        .msg-bubble pre code {
            background: transparent;
            padding: 0;
            color: #e2e8f0;
            font-size: 11px;
        }
        .code-copy-btn {
            position: absolute;
            top: 6px;
            right: 6px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #94a3b8;
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 3px;
        }
        .code-copy-btn:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.2);
        }
        .msg-bubble ul, .msg-bubble ol {
            padding-left: 18px;
            margin: 6px 0;
        }
        .msg-bubble li {
            margin-bottom: 4px;
        }
        .msg-bubble strong {
            color: #ffffff;
            font-weight: 600;
        }

        /* Typing Indicator */
        .typing-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 10px;
            background: var(--gz-bg-card);
            border: 1px solid var(--gz-border);
            border-radius: 12px;
            width: fit-content;
        }
        .typing-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: var(--gz-primary);
            animation: gz-bounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        .typing-dot:nth-child(3) { animation-delay: 0s; }

        @keyframes gz-bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
        }

        /* Footer & Input Composer */
        .chat-footer {
            padding: 12px 14px;
            background: var(--gz-bg-card);
            border-top: 1px solid var(--gz-border);
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex-shrink: 0;
        }

        .input-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            background: var(--gz-bg-subtle);
            border: 1px solid var(--gz-border);
            border-radius: 12px;
            padding: 8px 10px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .input-row:focus-within {
            border-color: var(--gz-primary);
            box-shadow: 0 0 0 2px var(--gz-primary-glow);
        }

        .chat-textarea {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--gz-text);
            font-family: inherit;
            font-size: 13px;
            line-height: 1.4;
            max-height: 100px;
            resize: none;
            outline: none;
            padding: 2px 0;
        }

        .chat-textarea::placeholder {
            color: var(--gz-text-muted);
        }

        .send-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: var(--gz-primary);
            border: none;
            color: #ffffff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
            background: var(--gz-primary-hover);
            transform: translateY(-1px);
        }

        .send-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .footer-branding {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 10px;
            color: var(--gz-text-muted);
            padding: 0 2px;
        }

        .footer-branding a {
            color: var(--gz-text-muted);
            text-decoration: none;
        }
        .footer-branding a:hover {
            color: var(--gz-text-sub);
        }

        @keyframes gz-slide-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    shadow.appendChild(styleEl);

    // Build DOM structure inside Shadow DOM
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-wrapper';
    wrapper.innerHTML = `
        <!-- Floating Greeting Badge -->
        <div class="greeting-badge" id="gzGreetingBadge" style="display: ${config.autoGreeting ? 'flex' : 'none'};">
            <span>${config.greeting}</span>
            <button class="greeting-close" id="gzCloseGreeting" title="Dismiss">${ICONS.close}</button>
        </div>

        <!-- Chat Popup Window -->
        <div class="chat-window" id="gzChatWindow">
            <!-- Header -->
            <div class="chat-header">
                <div class="header-brand">
                    <div class="brand-avatar">${ICONS.sparkles}</div>
                    <div class="brand-meta">
                        <div class="brand-title-row">
                            <span class="brand-title">${config.title}</span>
                            <span class="status-dot" id="gzStatusDot" title="Server online"></span>
                        </div>
                        <div class="model-select-wrapper">
                            <select class="model-select" id="gzModelSelect" title="Select AI Model">
                                ${TARGET_MODELS.map(m => `
                                    <option value="${m.id}" ${m.id === config.defaultModel ? 'selected' : ''}>${m.label}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="header-actions">
                    <button class="header-btn" id="gzPageContextBtn" title="Toggle current page context">
                        ${ICONS.fileText}
                    </button>
                    <button class="header-btn" id="gzClearChatBtn" title="Clear chat history">
                        ${ICONS.trash}
                    </button>
                    <button class="header-btn" id="gzMinimizeBtn" title="Minimize">
                        ${ICONS.minus}
                    </button>
                </div>
            </div>

            <!-- Context Bar (Active Webpage Strip) -->
            <div class="context-bar" id="gzContextBar" style="display: none;">
                <div class="context-indicator">
                    ${ICONS.fileText}
                    <span id="gzContextTitle">Page: Active webpage context</span>
                </div>
                <button class="context-toggle-btn" id="gzDisableContextBtn">Remove</button>
            </div>

            <!-- Messages Area -->
            <div class="messages-container" id="gzMessagesContainer">
                <div class="welcome-box" id="gzWelcomeBox">
                    <h3>${ICONS.sparkles} Ask GenZ AI Copilot</h3>
                    <p>Powered by local document RAG and NVIDIA NIM inference. You can chat or ask questions about this webpage!</p>
                    <div class="quick-chips">
                        <button class="chip-btn" data-query="Summarize this webpage for me in 3 concise bullet points.">
                            ${ICONS.fileText} Summarize this webpage
                        </button>
                        <button class="chip-btn" data-query="What knowledge and documents are trained in genZai?">
                            ${ICONS.sparkles} Explore genZai knowledge
                        </button>
                        <button class="chip-btn" data-query="What can you help me with on this website?">
                            ${ICONS.sparkles} What can you help me with?
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer & Composer -->
            <div class="chat-footer">
                <div class="input-row">
                    <textarea class="chat-textarea" id="gzTextarea" placeholder="Ask a question or request a summary..." rows="1"></textarea>
                    <button class="send-btn" id="gzSendBtn" title="Send message">
                        ${ICONS.send}
                    </button>
                </div>
                <div class="footer-branding">
                    <span>${config.subtitle}</span>
                    <span id="gzServerStatusText">Connected: ${config.serverUrl.replace(/https?:\/\//, '')}</span>
                </div>
            </div>
        </div>

        <!-- Floating Launcher Button -->
        <button class="launcher-btn" id="gzLauncherBtn" aria-label="Open GenZ AI Chat">
            <div class="pulse-ring"></div>
            <div class="launcher-icon" id="gzLauncherIcon">
                ${ICONS.sparkles}
            </div>
        </button>
    `;
    shadow.appendChild(wrapper);

    // Element references
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
    const serverStatusText = shadow.getElementById('gzServerStatusText');

    // Simple Markdown Formatter
    function formatMarkdown(text) {
        if (!text) return '';
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks: ```code```
        escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(match, lang, code) {
            return `<pre><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText);this.innerText='Copied!';setTimeout(()=>this.innerText='Copy',1500);">${ICONS.copy} Copy</button><code>${code.trim()}</code></pre>`;
        });

        // Inline code: `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold: **text**
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Unordered lists: - item or * item
        escaped = escaped.replace(/(?:^|\n)[-*]\s+([^\n]+)/g, '<li>$1</li>');
        escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

        // Paragraphs
        const paras = escaped.split(/\n\n+/).map(p => {
            p = p.trim();
            if (!p) return '';
            if (p.startsWith('<pre>') || p.startsWith('<ul>') || p.startsWith('<ol>')) return p;
            return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
        });

        return paras.join('');
    }

    // Toggle Chat Window
    function toggleChat(forceState) {
        const nextState = forceState !== undefined ? forceState : !state.isOpen;
        state.isOpen = nextState;

        if (state.isOpen) {
            chatWindow.classList.add('open');
            launcherIcon.innerHTML = ICONS.close;
            if (greetingBadge) greetingBadge.style.display = 'none';
            setTimeout(() => textarea.focus(), 250);
        } else {
            chatWindow.classList.remove('open');
            launcherIcon.innerHTML = ICONS.sparkles;
        }
    }

    // Get current page context (title + text)
    function extractPageContext() {
        const title = document.title || 'Untitled Webpage';
        const url = window.location.href;
        // Grab visible text while skipping scripts/styles
        let text = '';
        try {
            const clone = document.body.cloneNode(true);
            const removeEls = clone.querySelectorAll('script, style, noscript, nav, footer, #genzai-widget-root');
            removeEls.forEach(el => el.remove());
            text = (clone.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
        } catch (e) {
            text = (document.body.innerText || '').slice(0, 2000);
        }
        return { title, url, text };
    }

    // Set page context toggle
    function setPageContextActive(active) {
        state.pageContextActive = active;
        if (active) {
            pageContextBtn.classList.add('active');
            contextBar.style.display = 'flex';
            const { title } = extractPageContext();
            contextTitle.innerText = `Context: ${title.slice(0, 30)}...`;
        } else {
            pageContextBtn.classList.remove('active');
            contextBar.style.display = 'none';
        }
    }

    // Scroll to bottom
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Append Message to UI
    function appendMessage(role, content, citations) {
        if (welcomeBox) welcomeBox.style.display = 'none';

        const row = document.createElement('div');
        row.className = `msg-row ${role}`;

        let citationHtml = '';
        if (citations && citations.length > 0) {
            citationHtml = `
                <div class="citations-wrap">
                    <span style="font-size:10px;color:#a5b4fc;display:block;margin-bottom:3px;font-weight:600;">📚 Sources from genZai Training:</span>
                    ${citations.map(c => `
                        <span class="citation-badge" title="${c.snippet ? c.snippet.replace(/"/g, '&quot;') : ''}">
                            ${c.source} ${c.page ? `(p.${c.page})` : ''}
                        </span>
                    `).join('')}
                </div>
            `;
        }

        if (role === 'user') {
            row.innerHTML = `<div class="msg-bubble">${formatMarkdown(content)}</div>`;
        } else {
            row.innerHTML = `
                <div class="msg-avatar">${ICONS.sparkles}</div>
                <div class="msg-bubble">
                    ${formatMarkdown(content)}
                    ${citationHtml}
                </div>
            `;
        }

        messagesContainer.appendChild(row);
        scrollToBottom();
        return row;
    }

    // Show Typing Indicator
    function showTypingIndicator() {
        const typingEl = document.createElement('div');
        typingEl.className = 'msg-row assistant';
        typingEl.id = 'gzTypingRow';
        typingEl.innerHTML = `
            <div class="msg-avatar">${ICONS.sparkles}</div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(typingEl);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const el = shadow.getElementById('gzTypingRow');
        if (el) el.remove();
    }

    // Fetch Models from Backend
    async function fetchModels() {
        try {
            const resp = await fetch(`${config.serverUrl}/api/models`, {
                headers: { 'Accept': 'application/json' }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.models && Array.isArray(data.models)) {
                    const targetIds = TARGET_MODELS.map(m => m.id);
                    const combined = Array.from(new Set([...data.models, ...targetIds]));
                    state.models = combined;
                    modelSelect.innerHTML = combined.map(m => `
                        <option value="${m}" ${m === state.selectedModel ? 'selected' : ''}>${getWidgetModelLabel(m)}</option>
                    `).join('');
                }
                statusDot.style.backgroundColor = '#10b981';
                statusDot.title = 'GenZ AI Server Online';
            }
        } catch (e) {
            console.warn('[GenZ AI Widget] Server check notice:', e);
            statusDot.style.backgroundColor = '#f59e0b';
            statusDot.title = 'Connecting to server...';
        }
    }

    // Send Message
    async function sendMessage(overrideText) {
        const text = (overrideText || textarea.value).trim();
        if (!text || state.isLoading) return;

        textarea.value = '';
        textarea.style.height = 'auto';

        // Add user message to UI & history
        appendMessage('user', text);
        state.messages.push({ role: 'user', content: text });

        // Prepare messages payload
        let payloadMessages = [...state.messages];

        // Attach webpage context if active
        if (state.pageContextActive) {
            const ctx = extractPageContext();
            const pagePrompt = `[Webpage Context — Title: "${ctx.title}", URL: "${ctx.url}"]\nContent excerpt:\n"${ctx.text}"\n\nPlease use the above webpage context to answer user questions when relevant.`;
            payloadMessages.unshift({ role: 'system', content: pagePrompt });
        }

        state.isLoading = true;
        sendBtn.disabled = true;
        showTypingIndicator();

        try {
            const response = await fetch(`${config.serverUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
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
                try {
                    const errJson = await response.json();
                    errText = errJson.error || errText;
                } catch(e) {}
                appendMessage('assistant', `⚠️ **Error**: ${errText}`);
                return;
            }

            const data = await response.json();
            const assistantMsg = data.choices && data.choices[0] && data.choices[0].message
                ? data.choices[0].message.content
                : 'No response content received.';

            const citations = data.citations || [];
            appendMessage('assistant', assistantMsg, citations);
            state.messages.push({ role: 'assistant', content: assistantMsg });

        } catch (err) {
            removeTypingIndicator();
            appendMessage('assistant', `⚠️ **Connection Error**: Could not connect to GenZ AI Server at \`${config.serverUrl}\`. Please ensure the backend is running (\`python app.py\`).`);
        } finally {
            state.isLoading = false;
            sendBtn.disabled = false;
        }
    }

    // Auto-grow textarea
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Keyboard handlers
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.isOpen) {
            toggleChat(false);
        }
    });

    // Event Listeners
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

    pageContextBtn.addEventListener('click', () => {
        setPageContextActive(!state.pageContextActive);
    });

    disableContextBtn.addEventListener('click', () => {
        setPageContextActive(false);
    });

    sendBtn.addEventListener('click', () => sendMessage());

    modelSelect.addEventListener('change', (e) => {
        state.selectedModel = e.target.value;
    });

    // Chip quick suggestions
    shadow.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-btn');
        if (chip) {
            const query = chip.getAttribute('data-query');
            if (query) {
                // If it's summarize page, automatically activate page context!
                if (query.includes('webpage')) {
                    setPageContextActive(true);
                }
                sendMessage(query);
            }
        }
    });

    // Initialize models & initial ping
    fetchModels();

    // Expose control API on window
    window.GenZAIWidget = {
        open: () => toggleChat(true),
        close: () => toggleChat(false),
        toggle: () => toggleChat(),
        send: (msg) => sendMessage(msg),
        setContext: (active) => setPageContextActive(active),
        config: config
    };

    console.log('[GenZ AI Widget] Floating chat box initialized successfully.');
})();
