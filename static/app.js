// GenZ AI Premium Workspace Script

document.addEventListener("DOMContentLoaded", () => {
    // Instantiate Lucide Icons
    lucide.createIcons();

    // DOM References
    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menuBtn");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    const newChatBtn = document.getElementById("newChatBtn");
    const modelSelect = document.getElementById("modelSelect");
    const tempInput = document.getElementById("tempInput");
    const tempValDisplay = document.getElementById("tempValDisplay");
    const maxTokensInput = document.getElementById("maxTokensInput");
    const reasoningInput = document.getElementById("reasoningInput");
    const reasoningBudgetWrapper = document.getElementById("reasoningBudgetWrapper");
    const systemPrompt = document.getElementById("systemPrompt");
    const clearChatBtn = document.getElementById("clearChatBtn");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const activeModelLabel = document.getElementById("activeModelLabel");
    const chatViewport = document.getElementById("chatViewport");
    const welcomeScreen = document.getElementById("welcomeScreen");
    const conversationStream = document.getElementById("conversationStream");
    const composerInput = document.getElementById("composerInput");
    const charCounter = document.getElementById("charCounter");
    const sendBtn = document.getElementById("sendBtn");
    const apiStatusDot = document.getElementById("apiStatusDot");
    const apiStatusRing = document.getElementById("apiStatusRing");
    const apiStatusText = document.getElementById("apiStatusText");
    const configPanel = document.getElementById("configPanel");
    const configDrawerBtn = document.getElementById("configDrawerBtn");
    const closeConfigPanelBtn = document.getElementById("closeConfigPanelBtn");
    const toggleConfigBtn = document.getElementById("toggleConfigBtn");
    const composerConfigToggle = document.getElementById("composerConfigToggle");

    // State Variables
    let conversationHistory = [];
    const DEFAULT_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

    // Navigation & Layout Interactions
    menuBtn.addEventListener("click", () => sidebar.classList.add("active"));
    closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("active"));
    
    // Config panel togglers
    function toggleConfigPanel() {
        configPanel.classList.toggle("collapsed");
        const isCollapsed = configPanel.classList.contains("collapsed");
        if (isCollapsed) {
            configDrawerBtn.classList.remove("active");
            toggleConfigBtn.parentElement.classList.remove("active");
        } else {
            configDrawerBtn.classList.add("active");
            toggleConfigBtn.parentElement.classList.add("active");
        }
    }
    
    configDrawerBtn.addEventListener("click", toggleConfigPanel);
    closeConfigPanelBtn.addEventListener("click", toggleConfigPanel);
    toggleConfigBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleConfigPanel();
    });
    composerConfigToggle.addEventListener("click", toggleConfigPanel);

    // Dynamic temperature display
    tempInput.addEventListener("input", (e) => {
        tempValDisplay.textContent = e.target.value;
    });

    // Auto-grow message input box
    composerInput.addEventListener("input", () => {
        composerInput.style.height = "auto";
        composerInput.style.height = (composerInput.scrollHeight) + "px";
        
        const count = composerInput.value.length;
        charCounter.textContent = `${count} chars`;
        
        if (count > 0) {
            sendBtn.disabled = false;
            sendBtn.classList.add("active");
        } else {
            sendBtn.disabled = true;
            sendBtn.classList.remove("active");
        }
    });

    // Model selection changes header info
    modelSelect.addEventListener("change", () => {
        const val = modelSelect.value;
        activeModelLabel.textContent = val;
        toggleReasoningBudgetVisibility(val);
    });

    // Setup prompt card clicks
    document.querySelectorAll(".prompt-card").forEach(card => {
        card.addEventListener("click", () => {
            const promptText = card.getAttribute("data-prompt");
            composerInput.value = promptText;
            composerInput.style.height = "auto";
            composerInput.style.height = (composerInput.scrollHeight) + "px";
            charCounter.textContent = `${promptText.length} chars`;
            sendBtn.disabled = false;
            sendBtn.classList.add("active");
            sendMessage();
        });
    });

    // New Chat / Clear Chat CTA
    newChatBtn.addEventListener("click", resetConversation);
    clearChatBtn.addEventListener("click", resetConversation);
    
    document.getElementById("navNewChat").addEventListener("click", (e) => {
        e.preventDefault();
        resetConversation();
    });

    function resetConversation() {
        conversationHistory = [];
        conversationStream.innerHTML = "";
        welcomeScreen.style.display = "flex";
    }

    // Keyboard support: Enter key submits
    composerInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener("click", sendMessage);

    // Initial load
    fetchModels();

    // ----------------------------------------------------
    // Function Definitions
    // ----------------------------------------------------

    // Fetch catalog models dynamically
    async function fetchModels() {
        try {
            apiStatusText.textContent = "Connecting to server...";
            const response = await fetch("/api/models");
            const data = await response.json();
            
            if (response.ok && data.models) {
                modelSelect.innerHTML = "";
                data.models.forEach(modelId => {
                    const opt = document.createElement("option");
                    opt.value = modelId;
                    opt.textContent = modelId;
                    if (modelId === DEFAULT_MODEL) {
                        opt.selected = true;
                    }
                    modelSelect.appendChild(opt);
                });
                
                // Align active headers
                activeModelLabel.textContent = modelSelect.value;
                toggleReasoningBudgetVisibility(modelSelect.value);
                
                // Connected state
                setAPIIndicatorState("connected", "Connected");
            } else {
                setAPIIndicatorState("error", data.error || "Failed to load endpoints.");
            }
        } catch (error) {
            setAPIIndicatorState("error", "API Server offline.");
        }
    }

    function setAPIIndicatorState(state, text) {
        if (state === "connected") {
            apiStatusDot.className = "ping-dot";
            apiStatusRing.style.display = "block";
            apiStatusText.textContent = text;
        } else {
            apiStatusDot.className = "ping-dot error";
            apiStatusRing.style.display = "none";
            apiStatusText.textContent = text;
        }
    }

    function toggleReasoningBudgetVisibility(modelId) {
        if (modelId.includes("reasoning") || modelId.includes("gpt-oss")) {
            reasoningBudgetWrapper.style.display = "flex";
        } else {
            reasoningBudgetWrapper.style.display = "none";
        }
    }

    // Custom Lightweight Markdown Compiler
    function formatMessageText(text) {
        if (!text) return "";
        
        // Escape HTML for safety
        let escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Parse markdown tables first
        let lines = escaped.split("\n");
        let inTable = false;
        let tableHtml = "";
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith("|") && line.endsWith("|")) {
                if (!inTable) {
                    inTable = true;
                    tableHtml = "<table>";
                }
                let cells = line.split("|").slice(1, -1).map(c => c.trim());
                if (cells.every(c => c.startsWith("-") || c.endsWith("-"))) {
                    continue; // Skip table header separator row
                }
                let isHeader = tableHtml === "<table>";
                tableHtml += "<tr>" + cells.map(c => isHeader ? `<th>${c}</th>` : `<td>${c}</td>`).join("") + "</tr>";
            } else {
                if (inTable) {
                    inTable = false;
                    tableHtml += "</table>";
                    processedLines.push(tableHtml);
                    tableHtml = "";
                }
                processedLines.push(lines[i]);
            }
        }
        if (inTable) {
            tableHtml += "</table>";
            processedLines.push(tableHtml);
        }

        let parsedText = processedLines.join("\n");

        // Fenced code blocks with language wrapper
        parsedText = parsedText.replace(/```(?:[a-zA-Z0-9]+)?([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Inline code blocks
        parsedText = parsedText.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Quotes blockquotes
        parsedText = parsedText.replace(/^(?:&gt;)\s?(.*)$/gm, "<blockquote>$1</blockquote>");

        // Bullets (Unordered lists)
        parsedText = parsedText.replace(/^\s*[\*\-]\s(.*)$/gm, "<li>$1</li>");
        parsedText = parsedText.replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>");
        parsedText = parsedText.replace(/<\/ul>\s*<ul>/g, "");

        // Numbers (Ordered lists)
        parsedText = parsedText.replace(/^\s*\d+\.\s(.*)$/gm, "<ol-item>$1</ol-item>");
        parsedText = parsedText.replace(/(<ol-item>.*<\/ol-item>)/g, "<ol>$1</ol>");
        parsedText = parsedText.replace(/<\/ol>\s*<ol>/g, "");
        parsedText = parsedText.replace(/ol-item/g, "li");

        // Group regular text blocks into paragraphs
        let blocks = parsedText.split("\n\n");
        for (let j = 0; j < blocks.length; j++) {
            let b = blocks[j].trim();
            if (b && !b.startsWith("<pre>") && !b.startsWith("<table>") && !b.startsWith("<blockquote>") && !b.startsWith("<ul>") && !b.startsWith("<ol>")) {
                blocks[j] = `<p>${b.replace(/\n/g, "<br>")}</p>`;
            }
        }
        
        return blocks.join("\n");
    }

    // Main send message dispatcher
    async function sendMessage() {
        const text = composerInput.value.trim();
        if (!text) return;

        // Reset input state
        composerInput.value = "";
        composerInput.style.height = "auto";
        charCounter.textContent = "0 chars";
        sendBtn.disabled = true;
        sendBtn.classList.remove("active");

        // Hide landing screen
        welcomeScreen.style.display = "none";

        // Append user prompt to list
        appendMessageUI("user", text);
        scrollToBottom();

        // Save conversation history
        conversationHistory.push({
            "role": "user",
            "content": text
        });

        // Append assistant typing indicator
        const indicatorId = appendTypingIndicatorUI();
        scrollToBottom();

        // Build messages pipeline
        const messages = [];
        const systemDirectives = systemPrompt.value.trim();
        if (systemDirectives) {
            messages.push({
                "role": "system",
                "content": systemDirectives
            });
        }
        messages.push(...conversationHistory);

        const payload = {
            model: modelSelect.value,
            messages: messages,
            temperature: parseFloat(tempInput.value),
            max_tokens: parseInt(maxTokensInput.value),
            reasoning_budget: parseInt(reasoningInput.value)
        };

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            removeTypingIndicatorUI(indicatorId);

            const data = await response.json();

            if (response.ok && data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                const msg = choice.message;
                const content = msg.content;
                const reasoning = msg.reasoning_content || msg.reasoning;

                // Append assistant reply bubble
                appendMessageUI("assistant", content, reasoning);
                scrollToBottom();

                // Save to history
                conversationHistory.push({
                    "role": "assistant",
                    "content": content
                });
            } else {
                const errorText = data.error?.message || data.error || "Unable to retrieve response from server.";
                appendMessageUI("assistant", `<span class="accent-red">Error: ${errorText}</span>`);
                scrollToBottom();
            }
        } catch (error) {
            removeTypingIndicatorUI(indicatorId);
            appendMessageUI("assistant", `<span class="accent-red">Network Error: Failed to communicate with backend.</span>`);
            scrollToBottom();
        }
    }

    // Append Message Bubble with Action Bar to UI
    function appendMessageUI(role, text, reasoning = null) {
        const row = document.createElement("div");
        row.className = `message-row ${role}`;

        // Create avatar for assistant
        if (role === "assistant") {
            const avatar = document.createElement("div");
            avatar.className = "message-avatar";
            avatar.innerHTML = `<i data-lucide="sparkles"></i>`;
            row.appendChild(avatar);
        }

        const wrapper = document.createElement("div");
        wrapper.className = "message-content-wrapper";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        // Prepend reasoning accordion if reasoning exists
        if (reasoning && reasoning.trim()) {
            const reasoningBox = document.createElement("div");
            reasoningBox.className = "reasoning-box collapsed";

            const header = document.createElement("div");
            header.className = "reasoning-header";
            header.innerHTML = `
                <div class="reasoning-header-left">
                    <i data-lucide="brain"></i>
                    <span>Thought Process</span>
                </div>
                <i data-lucide="chevron-down" class="reasoning-toggle-icon"></i>
            `;

            const body = document.createElement("div");
            body.className = "reasoning-content";
            body.textContent = reasoning.trim();

            header.addEventListener("click", () => {
                reasoningBox.classList.toggle("collapsed");
            });

            reasoningBox.appendChild(header);
            reasoningBox.appendChild(body);
            bubble.appendChild(reasoningBox);
        }

        const textDiv = document.createElement("div");
        textDiv.className = "text-markdown";
        textDiv.innerHTML = formatMessageText(text);
        bubble.appendChild(textDiv);
        wrapper.appendChild(bubble);

        // Prepend action menu under assistant replies
        if (role === "assistant") {
            const actions = document.createElement("div");
            actions.className = "message-actions";
            actions.innerHTML = `
                <button class="action-btn btn-copy" title="Copy reply to clipboard">
                    <i data-lucide="copy"></i>
                </button>
                <button class="action-btn btn-regenerate" title="Regenerate response">
                    <i data-lucide="rotate-cw"></i>
                </button>
                <button class="action-btn btn-like" title="Good response">
                    <i data-lucide="thumbs-up"></i>
                </button>
                <button class="action-btn btn-dislike" title="Bad response">
                    <i data-lucide="thumbs-down"></i>
                </button>
                <button class="action-btn" title="More options">
                    <i data-lucide="more-horizontal"></i>
                </button>
            `;

            // Action: Copy to clipboard
            actions.querySelector(".btn-copy").addEventListener("click", function() {
                navigator.clipboard.writeText(text).then(() => {
                    const icon = this.querySelector("i");
                    icon.setAttribute("data-lucide", "check");
                    lucide.createIcons();
                    setTimeout(() => {
                        icon.setAttribute("data-lucide", "copy");
                        lucide.createIcons();
                    }, 1500);
                });
            });

            // Action: Regenerate
            actions.querySelector(".btn-regenerate").addEventListener("click", () => {
                // Find last user query
                const userMessages = conversationHistory.filter(m => m.role === "user");
                if (userMessages.length > 0) {
                    const lastUserText = userMessages[userMessages.length - 1].content;
                    // Remove last items from array
                    conversationHistory = conversationHistory.slice(0, -2);
                    // Remove elements from DOM
                    const domRows = conversationStream.querySelectorAll(".message-row");
                    if (domRows.length >= 2) {
                        domRows[domRows.length - 1].remove();
                        domRows[domRows.length - 2].remove();
                    }
                    // Insert into composer and execute
                    composerInput.value = lastUserText;
                    composerInput.style.height = "auto";
                    composerInput.style.height = (composerInput.scrollHeight) + "px";
                    charCounter.textContent = `${lastUserText.length} chars`;
                    sendBtn.disabled = false;
                    sendBtn.classList.add("active");
                    sendMessage();
                }
            });

            // Action: Like/Dislike state
            const likeBtn = actions.querySelector(".btn-like");
            const dislikeBtn = actions.querySelector(".btn-dislike");
            
            likeBtn.addEventListener("click", () => {
                likeBtn.classList.toggle("active");
                dislikeBtn.classList.remove("active");
            });

            dislikeBtn.addEventListener("click", () => {
                dislikeBtn.classList.toggle("active");
                likeBtn.classList.remove("active");
            });

            wrapper.appendChild(actions);
        }

        row.appendChild(wrapper);
        conversationStream.appendChild(row);
        lucide.createIcons();
    }

    // UI Typing indicators
    function appendTypingIndicatorUI() {
        const id = "indicator_" + Date.now();
        const row = document.createElement("div");
        row.className = "message-row assistant";
        row.id = id;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.innerHTML = `<i data-lucide="sparkles"></i>`;
        row.appendChild(avatar);

        const wrapper = document.createElement("div");
        wrapper.className = "message-content-wrapper";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        wrapper.appendChild(bubble);
        row.appendChild(wrapper);
        conversationStream.appendChild(row);
        lucide.createIcons();
        return id;
    }

    function removeTypingIndicatorUI(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatViewport.scrollTop = chatViewport.scrollHeight;
    }
});
