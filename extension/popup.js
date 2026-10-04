/**
 * GenZ AI — Extension Popup Controller
 * Manages target model selection, local vs friend server switcher, and widget commands.
 */
document.addEventListener('DOMContentLoaded', function() {
    const toggleFloatingWidget = document.getElementById('toggleFloatingWidget');
    const popupModelSelect = document.getElementById('popupModelSelect');
    const serverUrlInput = document.getElementById('serverUrlInput');
    const testServerBtn = document.getElementById('testServerBtn');
    const saveServerBtn = document.getElementById('saveServerBtn');
    const feedbackText = document.getElementById('feedbackText');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const readScreenTabBtn = document.getElementById('readScreenTabBtn');
    const summarizeTabBtn = document.getElementById('summarizeTabBtn');
    const openChatOnPageBtn = document.getElementById('openChatOnPageBtn');
    const openStudioLink = document.getElementById('openStudioLink');
    const btnModeLocal = document.getElementById('btnModeLocal');
    const btnModeFriend = document.getElementById('btnModeFriend');
    const serverTypeBadge = document.getElementById('serverTypeBadge');
    const serverTipText = document.getElementById('serverTipText');

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

    function renderModelOptions(selectedModel) {
        popupModelSelect.innerHTML = TARGET_MODELS.map(m => `
            <option value="${m.id}" ${m.id === selectedModel ? 'selected' : ''}>${m.label}</option>
        `).join('');
    }

    function updateModeUI(url) {
        const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
        if (isLocal) {
            btnModeLocal.classList.add('active');
            btnModeFriend.classList.remove('active');
            serverTypeBadge.innerText = 'My Local Server';
            serverTypeBadge.style.color = '#34d399';
            serverTipText.innerHTML = '🖥️ <strong>For You (Host):</strong> Using <code>http://127.0.0.1:5000</code> gives instant local access.';
        } else {
            btnModeLocal.classList.remove('active');
            btnModeFriend.classList.add('active');
            serverTypeBadge.innerText = 'Friend Tunnel';
            serverTypeBadge.style.color = '#818cf8';
            serverTipText.innerHTML = '🌐 <strong>For Friends:</strong> Public HTTPS Tunnel URL for remote access anywhere.';
        }
    }

    // 1. Load initial settings
    chrome.storage.local.get({
        widgetEnabled: true,
        serverUrl: 'http://127.0.0.1:5000',
        defaultModel: 'genZai (Custom Trained Model)'
    }, function(items) {
        toggleFloatingWidget.checked = items.widgetEnabled;
        serverUrlInput.value = items.serverUrl;
        openStudioLink.href = items.serverUrl;
        renderModelOptions(items.defaultModel);
        updateModeUI(items.serverUrl);
        checkServerStatus(items.serverUrl);
    });

    // 2. Switch mode button handlers
    btnModeLocal.addEventListener('click', function() {
        serverUrlInput.value = 'http://127.0.0.1:5000';
        updateModeUI('http://127.0.0.1:5000');
        saveAndPing('http://127.0.0.1:5000');
    });

    btnModeFriend.addEventListener('click', function() {
        updateModeUI('https://trycloudflare.com');
        serverUrlInput.focus();
        if (serverUrlInput.value.includes('127.0.0.1') || serverUrlInput.value.includes('localhost')) {
            serverUrlInput.value = '';
            serverUrlInput.placeholder = 'Paste Cloudflare HTTPS URL (https://...trycloudflare.com)';
        }
    });

    // 3. Model selector change handler
    popupModelSelect.addEventListener('change', function(e) {
        const newModel = e.target.value;
        chrome.storage.local.set({ defaultModel: newModel }, function() {
            feedbackText.style.display = 'block';
            feedbackText.style.color = '#10b981';
            feedbackText.innerText = `Active model set to: ${newModel}`;
            setTimeout(() => { feedbackText.style.display = 'none'; }, 2000);
        });
    });

    // 4. Safe Fetch via Background Proxy
    function safePing(url) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'API_FETCH',
                url: `${url}/api/models`,
                options: { method: 'GET' }
            }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    // Fallback to fetch
                    fetch(`${url}/api/models`)
                        .then(r => r.json())
                        .then(d => resolve({ ok: true, models: d.models }))
                        .catch(e => resolve({ ok: false, error: e.message }));
                } else if (response.ok) {
                    resolve({ ok: true, models: response.data ? response.data.models : [] });
                } else {
                    resolve({ ok: false, error: response.error || `HTTP ${response.status}` });
                }
            });
        });
    }

    // 5. Check Server Health
    async function checkServerStatus(url) {
        statusText.innerText = 'Checking...';
        statusBadge.className = 'status-badge';
        const res = await safePing(url);
        if (res.ok) {
            statusText.innerText = 'Online';
            statusBadge.className = 'status-badge';
        } else {
            statusText.innerText = 'Offline';
            statusBadge.className = 'status-badge offline';
        }
    }

    function saveAndPing(url) {
        const clean = url.trim().replace(/\/$/, '');
        chrome.storage.local.set({ serverUrl: clean }, function() {
            feedbackText.style.display = 'block';
            feedbackText.style.color = '#9ca3af';
            feedbackText.innerText = 'Testing connection...';
            openStudioLink.href = clean;
            
            safePing(clean).then(res => {
                if (res.ok) {
                    feedbackText.style.color = '#10b981';
                    feedbackText.innerText = `Connected! ${res.models ? res.models.length : 0} models ready.`;
                    statusText.innerText = 'Online';
                    statusBadge.className = 'status-badge';
                } else {
                    feedbackText.style.color = '#ef4444';
                    feedbackText.innerText = clean.includes('127.0.0.1')
                        ? 'Could not connect. Is "python app.py" running?'
                        : 'Could not connect to online tunnel. Check URL or restart tunnel.';
                    statusText.innerText = 'Offline';
                    statusBadge.className = 'status-badge offline';
                }
            });
        });
    }

    // 6. Test Ping Button
    testServerBtn.addEventListener('click', async function() {
        const url = serverUrlInput.value.trim().replace(/\/$/, '');
        if (!url) return;
        feedbackText.style.display = 'block';
        feedbackText.style.color = '#9ca3af';
        feedbackText.innerText = 'Testing connection...';
        const res = await safePing(url);
        if (res.ok) {
            feedbackText.style.color = '#10b981';
            feedbackText.innerText = `Connected! ${res.models ? res.models.length : 0} models available.`;
            statusText.innerText = 'Online';
            statusBadge.className = 'status-badge';
        } else {
            feedbackText.style.color = '#ef4444';
            feedbackText.innerText = url.includes('127.0.0.1')
                ? 'Failed to connect. Is python app.py running?'
                : 'Failed to connect to tunnel. Check if tunnel is active.';
            statusText.innerText = 'Offline';
            statusBadge.className = 'status-badge offline';
        }
    });

    // 7. Save Server URL
    saveServerBtn.addEventListener('click', function() {
        const url = serverUrlInput.value.trim().replace(/\/$/, '');
        if (!url) return;
        updateModeUI(url);
        saveAndPing(url);
    });

    // 8. Toggle Floating Widget on websites
    toggleFloatingWidget.addEventListener('change', function() {
        const enabled = toggleFloatingWidget.checked;
        chrome.storage.local.set({ widgetEnabled: enabled }, function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'TOGGLE_WIDGET',
                        enabled: enabled,
                        settings: { serverUrl: serverUrlInput.value.trim() }
                    }, () => {});
                }
            });
        });
    });

    // 9. Read Screen & Answer Question on Active Page
    if (readScreenTabBtn) {
        readScreenTabBtn.addEventListener('click', function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (!tabs[0] || !tabs[0].id) return;
                chrome.tabs.sendMessage(tabs[0].id, { action: 'READ_SCREEN' }, function(response) {
                    if (chrome.runtime.lastError) {
                        feedbackText.style.display = 'block';
                        feedbackText.style.color = '#f59e0b';
                        feedbackText.innerText = 'Refresh the active webpage and try again.';
                    } else {
                        window.close();
                    }
                });
            });
        });
    }

    // 10. Summarize Active Page
    summarizeTabBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs[0] || !tabs[0].id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'SUMMARIZE_PAGE' }, function(response) {
                if (chrome.runtime.lastError) {
                    feedbackText.style.display = 'block';
                    feedbackText.style.color = '#f59e0b';
                    feedbackText.innerText = 'Refresh the active webpage and try again.';
                } else {
                    window.close();
                }
            });
        });
    });

    // 10. Toggle Chat Bubble on Page
    openChatOnPageBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs[0] || !tabs[0].id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_WIDGET' }, function(response) {
                if (chrome.runtime.lastError) {
                    feedbackText.style.display = 'block';
                    feedbackText.style.color = '#f59e0b';
                    feedbackText.innerText = 'Refresh the active webpage to activate the widget.';
                } else {
                    window.close();
                }
            });
        });
    });
});
