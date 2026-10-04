/**
 * GenZ AI — Extension Popup Controller
 */
document.addEventListener('DOMContentLoaded', function() {
    const toggleFloatingWidget = document.getElementById('toggleFloatingWidget');
    const serverUrlInput = document.getElementById('serverUrlInput');
    const testServerBtn = document.getElementById('testServerBtn');
    const saveServerBtn = document.getElementById('saveServerBtn');
    const feedbackText = document.getElementById('feedbackText');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const summarizeTabBtn = document.getElementById('summarizeTabBtn');
    const openChatOnPageBtn = document.getElementById('openChatOnPageBtn');
    const openStudioLink = document.getElementById('openStudioLink');

    // 1. Load initial settings
    chrome.storage.local.get({
        widgetEnabled: true,
        serverUrl: 'http://127.0.0.1:5000'
    }, function(items) {
        toggleFloatingWidget.checked = items.widgetEnabled;
        serverUrlInput.value = items.serverUrl;
        openStudioLink.href = items.serverUrl;
        checkServerStatus(items.serverUrl);
    });

    // 2. Check Server Health
    async function checkServerStatus(url) {
        statusText.innerText = 'Checking...';
        statusBadge.className = 'status-badge';
        try {
            const resp = await fetch(`${url}/api/models`, { method: 'GET' });
            if (resp.ok) {
                statusText.innerText = 'Online';
                statusBadge.className = 'status-badge';
            } else {
                statusText.innerText = 'Error ' + resp.status;
                statusBadge.className = 'status-badge offline';
            }
        } catch (e) {
            statusText.innerText = 'Offline';
            statusBadge.className = 'status-badge offline';
        }
    }

    // 3. Toggle Floating Widget on websites
    toggleFloatingWidget.addEventListener('change', function() {
        const enabled = toggleFloatingWidget.checked;
        chrome.storage.local.set({ widgetEnabled: enabled }, function() {
            // Broadcast to active tab
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'TOGGLE_WIDGET',
                        enabled: enabled,
                        settings: { serverUrl: serverUrlInput.value.trim() }
                    }, () => {
                        if (chrome.runtime.lastError) {
                            // Tab might not support content scripts (e.g. chrome://)
                        }
                    });
                }
            });
        });
    });

    // 4. Test Ping Button
    testServerBtn.addEventListener('click', async function() {
        const url = serverUrlInput.value.trim().replace(/\/$/, '');
        feedbackText.style.display = 'block';
        feedbackText.style.color = '#9ca3af';
        feedbackText.innerText = 'Testing connection...';
        try {
            const resp = await fetch(`${url}/api/models`);
            if (resp.ok) {
                const data = await resp.json();
                const count = data.models ? data.models.length : 0;
                feedbackText.style.color = '#10b981';
                feedbackText.innerText = `Connected! ${count} models available.`;
                checkServerStatus(url);
            } else {
                feedbackText.style.color = '#ef4444';
                feedbackText.innerText = `Server returned status ${resp.status}.`;
            }
        } catch (e) {
            feedbackText.style.color = '#ef4444';
            feedbackText.innerText = 'Failed to connect. Is python app.py running?';
        }
    });

    // 5. Save Server URL
    saveServerBtn.addEventListener('click', function() {
        const url = serverUrlInput.value.trim().replace(/\/$/, '');
        chrome.storage.local.set({ serverUrl: url }, function() {
            feedbackText.style.display = 'block';
            feedbackText.style.color = '#10b981';
            feedbackText.innerText = 'Settings saved successfully!';
            openStudioLink.href = url;
            checkServerStatus(url);
            setTimeout(() => { feedbackText.style.display = 'none'; }, 2500);
        });
    });

    // 6. Summarize Active Page
    summarizeTabBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs[0] || !tabs[0].id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'SUMMARIZE_PAGE' }, function(response) {
                if (chrome.runtime.lastError) {
                    feedbackText.style.display = 'block';
                    feedbackText.style.color = '#f59e0b';
                    feedbackText.innerText = 'Could not access page. Refresh the webpage and try again.';
                } else {
                    window.close(); // Close popup so user sees summary on the page!
                }
            });
        });
    });

    // 7. Toggle Chat Bubble on Page
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
