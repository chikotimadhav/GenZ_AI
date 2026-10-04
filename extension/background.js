/**
 * GenZ AI — Chrome / Edge Background Service Worker
 * Proxies API requests to avoid CORS and Mixed Content restrictions on external HTTPS pages.
 */

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['serverUrl', 'widgetEnabled', 'defaultModel'], (items) => {
        const defaults = {};
        if (!items.serverUrl) defaults.serverUrl = 'http://127.0.0.1:5000';
        if (items.widgetEnabled === undefined) defaults.widgetEnabled = true;
        if (!items.defaultModel) defaults.defaultModel = 'genZai (Custom Trained Model)';
        
        if (Object.keys(defaults).length > 0) {
            chrome.storage.local.set(defaults);
        }
    });
});

// Proxy network requests on behalf of content scripts and popups
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'API_FETCH') {
        const { url, options = {} } = request;
        
        fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body || undefined
        })
        .then(async (resp) => {
            let data = null;
            const text = await resp.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { rawText: text };
            }
            sendResponse({
                ok: resp.ok,
                status: resp.status,
                statusText: resp.statusText,
                data: data
            });
        })
        .catch((err) => {
            sendResponse({
                ok: false,
                status: 0,
                error: err.message || 'Network request failed'
            });
        });

        // Return true to indicate asynchronous sendResponse
        return true;
    } else if (request.action === 'CAPTURE_SCREEN') {
        chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
                sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'Could not capture screen' });
            } else {
                sendResponse({ ok: true, dataUrl: dataUrl });
            }
        });
        return true;
    }
});
