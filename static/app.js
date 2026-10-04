// GenZ AI Premium Workspace Script — Custom Model Studio

document.addEventListener("DOMContentLoaded", () => {
    // Instantiate Lucide Icons
    lucide.createIcons();

    // DOM References - Core Workspace
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
    const activeModelBadge = document.getElementById("activeModelBadge");
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

    // DOM References - Train genZai Studio Modal
    const trainModalOverlay = document.getElementById("trainModalOverlay");
    const closeTrainModalBtn = document.getElementById("closeTrainModalBtn");
    const openTrainModalBtn = document.getElementById("openTrainModalBtn");
    const navTrainGenzai = document.getElementById("navTrainGenzai");
    const configOpenTrainBtn = document.getElementById("configOpenTrainBtn");
    const composerTrainBtn = document.getElementById("composerTrainBtn");
    const composerAttachBtn = document.getElementById("composerAttachBtn");
    const uploadDropzone = document.getElementById("uploadDropzone");
    const filePickerInput = document.getElementById("filePickerInput");
    const browseFilesBtn = document.getElementById("browseFilesBtn");
    const uploadProgressCard = document.getElementById("uploadProgressCard");
    const uploadNoticeBox = document.getElementById("uploadNoticeBox");
    const noteTitleInput = document.getElementById("noteTitleInput");
    const noteContentInput = document.getElementById("noteContentInput");
    const saveNoteBtn = document.getElementById("saveNoteBtn");
    const noteNoticeBox = document.getElementById("noteNoticeBox");
    const genTopicInput = document.getElementById("genTopicInput");
    const genCountSelect = document.getElementById("genCountSelect");
    const startGenerateBtn = document.getElementById("startGenerateBtn");
    const generatorLoading = document.getElementById("generatorLoading");
    const generatedPreview = document.getElementById("generatedPreview");
    const pairsScrollList = document.getElementById("pairsScrollList");
    const statDocCount = document.getElementById("statDocCount");
    const statChunkCount = document.getElementById("statChunkCount");
    const statTrainedStatus = document.getElementById("statTrainedStatus");
    const statLastTrained = document.getElementById("statLastTrained");
    const libraryItemsList = document.getElementById("libraryItemsList");
    const retrainAllBtn = document.getElementById("retrainAllBtn");
    const genzaiDocBadge = document.getElementById("genzaiDocBadge");
    const sidebarDocChunkCount = document.getElementById("sidebarDocChunkCount");

    // DOM References - Admin Option & Admin Modal
    const adminConfigCard = document.getElementById("adminConfigCard");
    const adminStatusPill = document.getElementById("adminStatusPill");
    const adminCardHeaderIcon = document.getElementById("adminCardHeaderIcon");
    const adminLoginView = document.getElementById("adminLoginView");
    const adminActiveView = document.getElementById("adminActiveView");
    const adminIdInput = document.getElementById("adminIdInput");
    const adminPasswordInput = document.getElementById("adminPasswordInput");
    const adminLoginBtn = document.getElementById("adminLoginBtn");
    const adminLoginNotice = document.getElementById("adminLoginNotice");
    const adminActiveUsername = document.getElementById("adminActiveUsername");
    const adminOpenTrainBtn = document.getElementById("adminOpenTrainBtn");
    const adminLogoutBtn = document.getElementById("adminLogoutBtn");

    const adminLoginModalOverlay = document.getElementById("adminLoginModalOverlay");
    const closeAdminModalBtn = document.getElementById("closeAdminModalBtn");
    const modalAdminIdInput = document.getElementById("modalAdminIdInput");
    const modalAdminPasswordInput = document.getElementById("modalAdminPasswordInput");
    const modalAdminLoginBtn = document.getElementById("modalAdminLoginBtn");
    const modalAdminNotice = document.getElementById("modalAdminNotice");

    // DOM References - Image Training Tab
    const imageDropzone = document.getElementById("imageDropzone");
    const imagePickerInput = document.getElementById("imagePickerInput");
    const browseImagesBtn = document.getElementById("browseImagesBtn");
    const imagePreviewCard = document.getElementById("imagePreviewCard");
    const imagePreviewImg = document.getElementById("imagePreviewImg");
    const imageMetaName = document.getElementById("imageMetaName");
    const imageMetaSize = document.getElementById("imageMetaSize");
    const removeSelectedImageBtn = document.getElementById("removeSelectedImageBtn");
    const imageTopicInput = document.getElementById("imageTopicInput");
    const imageDirectivesInput = document.getElementById("imageDirectivesInput");
    const trainImageBtn = document.getElementById("trainImageBtn");
    const imageTrainingProgress = document.getElementById("imageTrainingProgress");
    const imageNoticeBox = document.getElementById("imageNoticeBox");

    // State Variables
    let conversationHistory = [];
    const DEFAULT_MODEL = "genZai (Custom Trained Model)";
    let isAdminAuthenticated = false;
    let currentAdminId = "";
    let selectedImageFile = null;

    // Safe JSON Fetch helper preventing "Unexpected token < in JSON"
    async function safeFetchJson(url, options = {}) {
        try {
            const res = await fetch(url, options);
            let data = null;
            try {
                const text = await res.text();
                try {
                    data = JSON.parse(text);
                } catch (parseErr) {
                    const cleanText = text && text.length < 200 && !text.includes("<") ? text : `Server error (${res.status || 'unknown'})`;
                    data = { error: cleanText };
                }
            } catch (bodyErr) {
                data = { error: `Network error: ${bodyErr.message}` };
            }
            return { res, data };
        } catch (netErr) {
            return {
                res: { ok: false, status: 0, statusText: "Network Error" },
                data: { error: `Connection failed: ${netErr.message || "Cannot reach server."}` }
            };
        }
    }

    // Navigation & Layout Interactions
    if (menuBtn) menuBtn.addEventListener("click", () => sidebar.classList.add("active"));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("active"));
    
    // Config panel togglers
    function toggleConfigPanel() {
        configPanel.classList.toggle("collapsed");
        const isCollapsed = configPanel.classList.contains("collapsed");
        if (isCollapsed) {
            configDrawerBtn.classList.remove("active");
            if (toggleConfigBtn) toggleConfigBtn.parentElement.classList.remove("active");
        } else {
            configDrawerBtn.classList.add("active");
            if (toggleConfigBtn) toggleConfigBtn.parentElement.classList.add("active");
        }
    }
    
    if (configDrawerBtn) configDrawerBtn.addEventListener("click", toggleConfigPanel);
    if (closeConfigPanelBtn) closeConfigPanelBtn.addEventListener("click", toggleConfigPanel);
    if (toggleConfigBtn) toggleConfigBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleConfigPanel();
    });
    if (composerConfigToggle) composerConfigToggle.addEventListener("click", toggleConfigPanel);

    // Dynamic temperature display
    if (tempInput) {
        tempInput.addEventListener("input", (e) => {
            tempValDisplay.textContent = e.target.value;
        });
    }

    // Auto-grow message input box
    if (composerInput) {
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

        // Keyboard support: Enter key submits
        composerInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Model selection changes header info
    if (modelSelect) {
        modelSelect.addEventListener("change", () => {
            const val = modelSelect.value;
            activeModelLabel.textContent = val;
            updateActiveModelBadge(val);
            toggleReasoningBudgetVisibility(val);
        });
    }

    function updateActiveModelBadge(modelName) {
        if (!activeModelBadge) return;
        if (modelName.toLowerCase().includes("genzai")) {
            activeModelBadge.classList.add("genzai-badge");
        } else {
            activeModelBadge.classList.remove("genzai-badge");
        }
    }

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
    if (newChatBtn) newChatBtn.addEventListener("click", resetConversation);
    if (clearChatBtn) clearChatBtn.addEventListener("click", resetConversation);
    
    const navNewChat = document.getElementById("navNewChat");
    if (navNewChat) {
        navNewChat.addEventListener("click", (e) => {
            e.preventDefault();
            resetConversation();
        });
    }

    function resetConversation() {
        conversationHistory = [];
        conversationStream.innerHTML = "";
        welcomeScreen.style.display = "flex";
    }

    if (sendBtn) sendBtn.addEventListener("click", sendMessage);

    // Initial load
    fetchModels();
    fetchGenzaiStatus();
    checkAdminStatus();

    // =========================================================================
    // Admin RBAC & Authentication Handlers
    // =========================================================================
    async function checkAdminStatus() {
        try {
            const { res, data } = await safeFetchJson("/api/admin/status");
            if (res.ok && data) {
                isAdminAuthenticated = !!data.is_admin;
                currentAdminId = data.admin_id || "";
                updateAdminUI();
            }
        } catch (e) {
            console.warn("Admin status check failed", e);
        }
    }

    function updateAdminUI() {
        if (isAdminAuthenticated) {
            if (adminStatusPill) {
                adminStatusPill.className = "admin-status-pill admin-mode";
                adminStatusPill.textContent = "Admin Mode";
            }
            if (adminLoginView) adminLoginView.style.display = "none";
            if (adminActiveView) adminActiveView.style.display = "block";
            if (adminActiveUsername) adminActiveUsername.textContent = currentAdminId || "admin";
            if (adminPasswordInput) adminPasswordInput.value = "";
            if (modalAdminPasswordInput) modalAdminPasswordInput.value = "";

            if (navTrainGenzai) {
                navTrainGenzai.classList.remove("user-locked");
                navTrainGenzai.title = "Open genZai Training Studio";
            }
            if (composerTrainBtn) {
                composerTrainBtn.title = "genZai Training Studio (Admin Active)";
            }
        } else {
            if (adminStatusPill) {
                adminStatusPill.className = "admin-status-pill user-mode";
                adminStatusPill.textContent = "User Mode";
            }
            if (adminLoginView) adminLoginView.style.display = "block";
            if (adminActiveView) adminActiveView.style.display = "none";
            if (adminPasswordInput) adminPasswordInput.value = "";
            if (modalAdminPasswordInput) modalAdminPasswordInput.value = "";

            if (navTrainGenzai) {
                navTrainGenzai.classList.add("user-locked");
                navTrainGenzai.title = "Model training is restricted to Admin";
            }
            if (composerTrainBtn) {
                composerTrainBtn.title = "Model training restricted to Admin";
            }
        }
        lucide.createIcons();
    }

    function openAdminModal(customMessage) {
        if (!adminLoginModalOverlay) return;
        if (modalAdminNotice) {
            if (customMessage) {
                modalAdminNotice.style.display = "block";
                modalAdminNotice.className = "admin-login-feedback";
                modalAdminNotice.textContent = customMessage;
            } else {
                modalAdminNotice.style.display = "none";
            }
        }
        adminLoginModalOverlay.classList.add("active");
        if (modalAdminIdInput) modalAdminIdInput.focus();
    }

    function closeAdminModal() {
        if (!adminLoginModalOverlay) return;
        adminLoginModalOverlay.classList.remove("active");
        if (modalAdminNotice) modalAdminNotice.style.display = "none";
    }

    async function handleAdminLogin(adminId, password, noticeEl, isFromModal = false) {
        if (!adminId || !password) {
            if (noticeEl) {
                noticeEl.style.display = "block";
                noticeEl.className = "admin-login-feedback error";
                noticeEl.textContent = "Please enter both Admin ID and Password.";
            }
            return;
        }

        if (noticeEl) {
            noticeEl.style.display = "block";
            noticeEl.className = "admin-login-feedback";
            noticeEl.innerHTML = `<span class="spinner-ring" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Verifying credentials...`;
        }

        try {
            const { res, data } = await safeFetchJson("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ admin_id: adminId, password: password })
            });

            if (res.ok && data.success) {
                isAdminAuthenticated = true;
                currentAdminId = data.admin_id;
                updateAdminUI();

                if (noticeEl) {
                    noticeEl.className = "admin-login-feedback success";
                    noticeEl.textContent = `⚡ Welcome, ${data.admin_id}! Admin access granted.`;
                }

                setTimeout(() => {
                    if (isFromModal) {
                        closeAdminModal();
                    }
                    if (noticeEl) noticeEl.style.display = "none";
                    // Open training studio immediately upon admin login
                    openTrainModal("tab-upload");
                }, 400);
            } else {
                if (noticeEl) {
                    noticeEl.className = "admin-login-feedback error";
                    noticeEl.textContent = data.error || "Invalid Admin ID or Password.";
                }
            }
        } catch (err) {
            if (noticeEl) {
                noticeEl.className = "admin-login-feedback error";
                noticeEl.textContent = `Login failed: ${err.message}`;
            }
        }
    }

    async function handleAdminLogout() {
        try {
            await safeFetchJson("/api/admin/logout", { method: "POST" });
        } catch (e) {
            console.error("Logout request error", e);
        }
        isAdminAuthenticated = false;
        currentAdminId = "";
        updateAdminUI();
        closeTrainModal();
    }

    // Connect Admin Options in Settings Panel
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener("click", () => {
            const id = adminIdInput ? adminIdInput.value.trim() : "";
            const pass = adminPasswordInput ? adminPasswordInput.value : "";
            handleAdminLogin(id, pass, adminLoginNotice, false);
        });
    }

    if (adminPasswordInput) {
        adminPasswordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const id = adminIdInput ? adminIdInput.value.trim() : "";
                const pass = adminPasswordInput ? adminPasswordInput.value : "";
                handleAdminLogin(id, pass, adminLoginNotice, false);
            }
        });
    }

    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener("click", handleAdminLogout);
    }

    if (adminOpenTrainBtn) {
        adminOpenTrainBtn.addEventListener("click", () => {
            if (isAdminAuthenticated) {
                openTrainModal("tab-upload");
            } else {
                openAdminModal("Admin authorization required to open training studio.");
            }
        });
    }

    // Connect Admin Login Modal Controls
    if (modalAdminLoginBtn) {
        modalAdminLoginBtn.addEventListener("click", () => {
            const id = modalAdminIdInput ? modalAdminIdInput.value.trim() : "";
            const pass = modalAdminPasswordInput ? modalAdminPasswordInput.value : "";
            handleAdminLogin(id, pass, modalAdminNotice, true);
        });
    }

    if (modalAdminPasswordInput) {
        modalAdminPasswordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const id = modalAdminIdInput ? modalAdminIdInput.value.trim() : "";
                const pass = modalAdminPasswordInput ? modalAdminPasswordInput.value : "";
                handleAdminLogin(id, pass, modalAdminNotice, true);
            }
        });
    }

    if (closeAdminModalBtn) closeAdminModalBtn.addEventListener("click", closeAdminModal);
    if (adminLoginModalOverlay) {
        adminLoginModalOverlay.addEventListener("click", (e) => {
            if (e.target === adminLoginModalOverlay) closeAdminModal();
        });
    }

    // =========================================================================
    // Train genZai Studio Modal Controls (Admin Guarded)
    // =========================================================================
    function requestOpenTrainStudio(initialTab = "tab-upload") {
        if (isAdminAuthenticated) {
            openTrainModal(initialTab);
        } else {
            openAdminModal("Model training is restricted to Admin. Log in with your Admin ID and Password to train genZai.");
        }
    }

    function openTrainModal(initialTab = "tab-upload") {
        if (!trainModalOverlay) return;
        trainModalOverlay.classList.add("active");
        switchModalTab(initialTab);
        fetchGenzaiStatus();
    }

    function closeTrainModal() {
        if (!trainModalOverlay) return;
        trainModalOverlay.classList.remove("active");
    }

    function switchModalTab(tabId) {
        document.querySelectorAll(".modal-tab").forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-tab") === tabId);
        });
        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.toggle("active", content.id === tabId);
        });
    }

    if (openTrainModalBtn) openTrainModalBtn.addEventListener("click", () => requestOpenTrainStudio("tab-upload"));
    if (navTrainGenzai) navTrainGenzai.addEventListener("click", (e) => {
        e.preventDefault();
        requestOpenTrainStudio("tab-upload");
    });
    if (configOpenTrainBtn) configOpenTrainBtn.addEventListener("click", () => requestOpenTrainStudio("tab-library"));
    if (composerTrainBtn) composerTrainBtn.addEventListener("click", () => requestOpenTrainStudio("tab-upload"));
    if (composerAttachBtn) composerAttachBtn.addEventListener("click", () => requestOpenTrainStudio("tab-upload"));
    if (closeTrainModalBtn) closeTrainModalBtn.addEventListener("click", closeTrainModal);

    if (trainModalOverlay) {
        trainModalOverlay.addEventListener("click", (e) => {
            if (e.target === trainModalOverlay) closeTrainModal();
        });
    }

    // =========================================================================
    // Extension & Embed Widget Modal Controls
    // =========================================================================
    const navExtensionModal = document.getElementById("navExtensionModal");
    const extensionModalOverlay = document.getElementById("extensionModalOverlay");
    const closeExtensionModalBtn = document.getElementById("closeExtensionModalBtn");
    const extTabBtnExtension = document.getElementById("extTabBtnExtension");
    const extTabBtnEmbed = document.getElementById("extTabBtnEmbed");
    const extTabContentExtension = document.getElementById("extTabContentExtension");
    const extTabContentEmbed = document.getElementById("extTabContentEmbed");
    const copyExtPathBtn = document.getElementById("copyExtPathBtn");
    const copyEmbedCodeBtn = document.getElementById("copyEmbedCodeBtn");
    const extFolderPathInput = document.getElementById("extFolderPathInput");
    const embedScriptSnippet = document.getElementById("embedScriptSnippet");

    function openExtensionModal() {
        if (!extensionModalOverlay) return;
        extensionModalOverlay.classList.add("active");
        lucide.createIcons();
    }

    function closeExtensionModal() {
        if (!extensionModalOverlay) return;
        extensionModalOverlay.classList.remove("active");
    }

    if (navExtensionModal) {
        navExtensionModal.addEventListener("click", (e) => {
            e.preventDefault();
            openExtensionModal();
        });
    }

    if (closeExtensionModalBtn) {
        closeExtensionModalBtn.addEventListener("click", closeExtensionModal);
    }

    if (extensionModalOverlay) {
        extensionModalOverlay.addEventListener("click", (e) => {
            if (e.target === extensionModalOverlay) closeExtensionModal();
        });
    }

    if (extTabBtnExtension && extTabBtnEmbed) {
        extTabBtnExtension.addEventListener("click", () => {
            extTabBtnExtension.classList.add("active");
            extTabBtnEmbed.classList.remove("active");
            if (extTabContentExtension) extTabContentExtension.style.display = "block";
            if (extTabContentEmbed) extTabContentEmbed.style.display = "none";
            lucide.createIcons();
        });

        extTabBtnEmbed.addEventListener("click", () => {
            extTabBtnEmbed.classList.add("active");
            extTabBtnExtension.classList.remove("active");
            if (extTabContentExtension) extTabContentExtension.style.display = "none";
            if (extTabContentEmbed) extTabContentEmbed.style.display = "block";
            lucide.createIcons();
        });
    }

    if (copyExtPathBtn && extFolderPathInput) {
        copyExtPathBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(extFolderPathInput.value);
            const originalHtml = copyExtPathBtn.innerHTML;
            copyExtPathBtn.innerHTML = `<span>Copied!</span>`;
            setTimeout(() => { copyExtPathBtn.innerHTML = originalHtml; lucide.createIcons(); }, 1800);
        });
    }

    if (copyEmbedCodeBtn && embedScriptSnippet) {
        copyEmbedCodeBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(embedScriptSnippet.innerText);
            const originalHtml = copyEmbedCodeBtn.innerHTML;
            copyEmbedCodeBtn.innerHTML = `<span>Copied!</span>`;
            setTimeout(() => { copyEmbedCodeBtn.innerHTML = originalHtml; lucide.createIcons(); }, 1800);
        });
    }

    document.querySelectorAll(".modal-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.getAttribute("data-tab");
            if (targetTab) {
                switchModalTab(targetTab);
                if (targetTab === "tab-library") fetchGenzaiStatus();
            }
        });
    });

    // ----------------------------------------------------
    // Tab 1: File Dropzone & Uploads
    // ----------------------------------------------------
    if (browseFilesBtn && filePickerInput) {
        browseFilesBtn.addEventListener("click", () => filePickerInput.click());
    }

    if (uploadDropzone && filePickerInput) {
        uploadDropzone.addEventListener("click", (e) => {
            if (e.target !== browseFilesBtn && !browseFilesBtn.contains(e.target)) {
                filePickerInput.click();
            }
        });

        uploadDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            uploadDropzone.classList.add("dragover");
        });

        uploadDropzone.addEventListener("dragleave", () => {
            uploadDropzone.classList.remove("dragover");
        });

        uploadDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            uploadDropzone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileUploads(e.dataTransfer.files);
            }
        });

        filePickerInput.addEventListener("change", () => {
            if (filePickerInput.files && filePickerInput.files.length > 0) {
                handleFileUploads(filePickerInput.files);
            }
        });
    }

    async function handleFileUploads(files) {
        if (!isAdminAuthenticated) {
            openAdminModal("Admin authorization required to upload and train files into genZai.");
            return;
        }

        uploadNoticeBox.style.display = "none";
        uploadProgressCard.style.display = "flex";

        let successCount = 0;
        let lastMsg = "";

        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);

            try {
                const { res, data } = await safeFetchJson("/api/genzai/upload", {
                    method: "POST",
                    body: formData
                });
                if (res.ok) {
                    successCount++;
                    lastMsg = data.message || "File uploaded successfully";
                } else {
                    lastMsg = data.error || "Upload failed";
                }
            } catch (err) {
                lastMsg = `Error uploading ${file.name}: ${err.message}`;
            }
        }

        uploadProgressCard.style.display = "none";
        uploadNoticeBox.style.display = "block";
        if (successCount > 0) {
            uploadNoticeBox.className = "upload-notice";
            uploadNoticeBox.textContent = `⚡ Success: Trained ${successCount} document(s) into genZai!`;
            fetchGenzaiStatus();
        } else {
            uploadNoticeBox.className = "upload-notice error";
            uploadNoticeBox.textContent = lastMsg;
        }
    }

    // ----------------------------------------------------
    // Tab 1.5: Train by Images (Multimodal Vision Intelligence)
    // ----------------------------------------------------
    if (browseImagesBtn && imagePickerInput) {
        browseImagesBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            imagePickerInput.click();
        });
    }

    if (imageDropzone && imagePickerInput) {
        imageDropzone.addEventListener("click", (e) => {
            if (e.target !== browseImagesBtn && !browseImagesBtn?.contains(e.target)) {
                imagePickerInput.click();
            }
        });

        imageDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            imageDropzone.classList.add("dragover");
        });

        imageDropzone.addEventListener("dragleave", () => {
            imageDropzone.classList.remove("dragover");
        });

        imageDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            imageDropzone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleImageFileSelected(e.dataTransfer.files[0]);
            }
        });

        imagePickerInput.addEventListener("change", () => {
            if (imagePickerInput.files && imagePickerInput.files.length > 0) {
                handleImageFileSelected(imagePickerInput.files[0]);
            }
        });
    }

    function handleImageFileSelected(file) {
        if (!file) return;
        if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
            alert("Please select a supported image file (PNG, JPG, WEBP, or BMP).");
            return;
        }

        selectedImageFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (imagePreviewImg) imagePreviewImg.src = e.target.result;
            if (imageMetaName) imageMetaName.textContent = file.name;
            if (imageMetaSize) imageMetaSize.textContent = formatBytes(file.size);
            if (imagePreviewCard) imagePreviewCard.style.display = "flex";
            if (trainImageBtn) trainImageBtn.disabled = false;

            if (imageTopicInput && !imageTopicInput.value.trim()) {
                const autoName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                imageTopicInput.value = autoName.charAt(0).toUpperCase() + autoName.slice(1);
            }
            if (imageNoticeBox) imageNoticeBox.style.display = "none";
        };
        reader.readAsDataURL(file);
    }

    if (removeSelectedImageBtn) {
        removeSelectedImageBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            clearSelectedImage();
        });
    }

    function clearSelectedImage() {
        selectedImageFile = null;
        if (imagePickerInput) imagePickerInput.value = "";
        if (imagePreviewCard) imagePreviewCard.style.display = "none";
        if (imagePreviewImg) imagePreviewImg.src = "";
        if (trainImageBtn) trainImageBtn.disabled = true;
        if (imageNoticeBox) imageNoticeBox.style.display = "none";
    }

    if (trainImageBtn) {
        trainImageBtn.addEventListener("click", async () => {
            if (!selectedImageFile) {
                alert("Please select an image first.");
                return;
            }

            if (!isAdminAuthenticated) {
                openAdminModal("Admin authorization required to train images into genZai.");
                return;
            }

            const title = (imageTopicInput ? imageTopicInput.value.trim() : "") || selectedImageFile.name;
            const directives = imageDirectivesInput ? imageDirectivesInput.value.trim() : "";

            trainImageBtn.disabled = true;
            if (imageTrainingProgress) imageTrainingProgress.style.display = "flex";
            if (imageNoticeBox) imageNoticeBox.style.display = "none";

            const formData = new FormData();
            formData.append("image", selectedImageFile);
            formData.append("title", title);
            if (directives) {
                formData.append("directives", directives);
            }

            try {
                const { res, data } = await safeFetchJson("/api/genzai/image", {
                    method: "POST",
                    body: formData
                });

                if (res.ok) {
                    if (imageNoticeBox) {
                        imageNoticeBox.style.display = "block";
                        imageNoticeBox.className = "upload-notice";
                        imageNoticeBox.innerHTML = `⚡ <strong>Vision Intelligence Trained!</strong> Llama 3.2 Vision analyzed the visual data and indexed ${data.extracted_chars || 0} characters of knowledge into genZai.`;
                    }
                    clearSelectedImage();
                    if (imageTopicInput) imageTopicInput.value = "";
                    if (imageDirectivesInput) imageDirectivesInput.value = "";
                    fetchGenzaiStatus();
                } else {
                    if (imageNoticeBox) {
                        imageNoticeBox.style.display = "block";
                        imageNoticeBox.className = "upload-notice error";
                        imageNoticeBox.textContent = data.error || "Failed to train image into genZai.";
                    }
                }
            } catch (err) {
                if (imageNoticeBox) {
                    imageNoticeBox.style.display = "block";
                    imageNoticeBox.className = "upload-notice error";
                    imageNoticeBox.textContent = `Error: ${err.message}`;
                }
            } finally {
                if (imageTrainingProgress) imageTrainingProgress.style.display = "none";
                trainImageBtn.disabled = !selectedImageFile;
                lucide.createIcons();
            }
        });
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ----------------------------------------------------
    // Tab 2: Quick Knowledge Note
    // ----------------------------------------------------
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener("click", async () => {
            if (!isAdminAuthenticated) {
                openAdminModal("Admin authorization required to train notes into genZai.");
                return;
            }

            const title = noteTitleInput.value.trim();
            const content = noteContentInput.value.trim();

            if (!content) {
                noteNoticeBox.style.display = "block";
                noteNoticeBox.className = "upload-notice error";
                noteNoticeBox.textContent = "Please enter knowledge content to train.";
                return;
            }

            saveNoteBtn.disabled = true;
            saveNoteBtn.innerHTML = `<span class="spinner-ring" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Training...`;

            try {
                const { res, data } = await safeFetchJson("/api/genzai/note", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, content })
                });
                if (res.ok) {
                    noteNoticeBox.style.display = "block";
                    noteNoticeBox.className = "upload-notice";
                    noteNoticeBox.textContent = `⚡ Knowledge note trained into genZai!`;
                    noteTitleInput.value = "";
                    noteContentInput.value = "";
                    fetchGenzaiStatus();
                } else {
                    noteNoticeBox.style.display = "block";
                    noteNoticeBox.className = "upload-notice error";
                    noteNoticeBox.textContent = data.error || "Failed to train note.";
                }
            } catch (err) {
                noteNoticeBox.style.display = "block";
                noteNoticeBox.className = "upload-notice error";
                noteNoticeBox.textContent = `Error: ${err.message}`;
            } finally {
                saveNoteBtn.disabled = false;
                saveNoteBtn.innerHTML = `<i data-lucide="zap"></i><span>Train Note into genZai</span>`;
                lucide.createIcons();
            }
        });
    }

    // ----------------------------------------------------
    // Tab 3: AI Dataset Generator
    // ----------------------------------------------------
    if (startGenerateBtn) {
        startGenerateBtn.addEventListener("click", async () => {
            if (!isAdminAuthenticated) {
                openAdminModal("Admin authorization required to generate AI datasets.");
                return;
            }

            const topic = genTopicInput.value.trim();
            const count = parseInt(genCountSelect.value) || 5;

            if (!topic) {
                alert("Please provide a subject or reference text to synthesize training pairs.");
                return;
            }

            generatorLoading.style.display = "flex";
            generatedPreview.style.display = "none";
            startGenerateBtn.disabled = true;

            try {
                const { res, data } = await safeFetchJson("/api/genzai/generate-dataset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ topic, count, auto_train: true })
                });

                if (res.ok && data && data.pairs && data.pairs.length > 0) {
                    pairsScrollList.innerHTML = "";
                    data.pairs.forEach((pair, idx) => {
                        const card = document.createElement("div");
                        card.className = "pair-card";
                        card.innerHTML = `
                            <div class="pair-q">#${idx+1}: ${pair.question}</div>
                            <div class="pair-a">${pair.answer}</div>
                        `;
                        pairsScrollList.appendChild(card);
                    });
                    generatedPreview.style.display = "flex";
                    fetchGenzaiStatus();
                } else {
                    alert(data.error || "Failed to generate dataset.");
                }
            } catch (err) {
                alert(`Error: ${err.message}`);
            } finally {
                generatorLoading.style.display = "none";
                startGenerateBtn.disabled = false;
            }
        });
    }

    // ----------------------------------------------------
    // Tab 4: Trained Library & Status
    // ----------------------------------------------------
    async function fetchGenzaiStatus() {
        try {
            const { res, data } = await safeFetchJson("/api/genzai/status");

            if (res.ok && data) {
                if (statDocCount) statDocCount.textContent = data.total_documents || 0;
                if (statChunkCount) statChunkCount.textContent = data.total_chunks || 0;
                if (statTrainedStatus) statTrainedStatus.textContent = data.trained ? "Active" : "Unindexed";
                if (statLastTrained) statLastTrained.textContent = data.trained_at ? data.trained_at.split(" ")[1] || data.trained_at : "Never";

                // Update badges
                if (genzaiDocBadge) {
                    const count = data.total_documents || 0;
                    genzaiDocBadge.textContent = `${count} Doc${count === 1 ? '' : 's'}`;
                }
                if (sidebarDocChunkCount) {
                    sidebarDocChunkCount.textContent = `${data.total_chunks || 0} Knowledge Chunks`;
                }

                // Render library documents list
                if (libraryItemsList && data.documents) {
                    libraryItemsList.innerHTML = "";
                    data.documents.forEach(doc => {
                        const item = document.createElement("div");
                        item.className = "doc-item";
                        item.innerHTML = `
                            <div class="doc-info">
                                <span class="doc-type-badge ${doc.type === 'image' ? 'image' : ''}">${doc.type}</span>
                                <div>
                                    <div class="doc-name">${doc.name}</div>
                                    <div class="doc-size">${doc.size_formatted}</div>
                                </div>
                            </div>
                            <div class="doc-actions">
                                ${doc.is_removable ? `
                                    <button class="btn-delete-doc" data-file="${doc.name}" title="Delete document from genZai">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                ` : `
                                    <span style="font-size:11px;color:var(--text-muted);">Built-in</span>
                                `}
                            </div>
                        `;

                        if (doc.is_removable) {
                            const delBtn = item.querySelector(".btn-delete-doc");
                            delBtn.addEventListener("click", async () => {
                                if (!isAdminAuthenticated) {
                                    openAdminModal("Admin authorization required to delete documents from genZai.");
                                    return;
                                }
                                if (confirm(`Delete '${doc.name}' and retrain genZai?`)) {
                                    await deleteDocument(doc.name);
                                }
                            });
                        }

                        libraryItemsList.appendChild(item);
                    });
                    lucide.createIcons();
                }
            }
        } catch (e) {
            console.error("Failed to fetch genZai status", e);
        }
    }

    async function deleteDocument(filename) {
        if (!isAdminAuthenticated) {
            openAdminModal("Admin authorization required to delete documents.");
            return;
        }

        try {
            const { res, data } = await safeFetchJson(`/api/genzai/document/${encodeURIComponent(filename)}`, {
                method: "DELETE"
            });
            if (res.ok) {
                fetchGenzaiStatus();
            } else {
                alert(data.error || "Failed to delete document.");
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }

    if (retrainAllBtn) {
        retrainAllBtn.addEventListener("click", async () => {
            if (!isAdminAuthenticated) {
                openAdminModal("Admin authorization required to retrain genZai.");
                return;
            }

            retrainAllBtn.disabled = true;
            retrainAllBtn.innerHTML = `<span class="spinner-ring" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:4px;"></span> Retraining...`;
            try {
                const { res, data } = await safeFetchJson("/api/genzai/train", { method: "POST" });
                if (res.ok) {
                    alert(`⚡ ${data.message || 'Trained successfully'} (${data.total_chunks || 0} chunks indexed)`);
                    fetchGenzaiStatus();
                } else {
                    alert(data.error || "Failed to retrain genZai.");
                }
            } catch (err) {
                alert(`Error: ${err.message}`);
            } finally {
                retrainAllBtn.disabled = false;
                retrainAllBtn.innerHTML = `<i data-lucide="rotate-cw"></i><span>Retrain All</span>`;
                lucide.createIcons();
            }
        });
    }

    // =========================================================================
    // Catalog Models Fetching
    // =========================================================================
    async function fetchModels() {
        try {
            apiStatusText.textContent = "Connecting to server...";
            const { res: response, data } = await safeFetchJson("/api/models");
            
            if (response.ok && data && data.models) {
                modelSelect.innerHTML = "";
                const VERIFIED_SET = new Set([
                    "genZai (Custom Trained Model)",
                    "meta/llama-3.2-11b-vision-instruct",
                    "moonshotai/kimi-k3",
                    "nvidia/nemotron-3-ultra-550b-a55b",
                    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
                    "nvidia/riva-translate-4b-instruct-v2"
                ]);

                data.models.forEach(modelId => {
                    const opt = document.createElement("option");
                    opt.value = modelId;
                    if (modelId.toLowerCase().includes("genzai")) {
                        opt.textContent = `✦ ${modelId}`;
                    } else if (VERIFIED_SET.has(modelId)) {
                        opt.textContent = `⚡ ${modelId} (Online)`;
                    } else {
                        opt.textContent = modelId;
                    }

                    if (modelId === DEFAULT_MODEL || (modelId.toLowerCase().includes("genzai") && !modelSelect.value)) {
                        opt.selected = true;
                    }
                    modelSelect.appendChild(opt);
                });
                
                // Align active headers
                activeModelLabel.textContent = modelSelect.value;
                updateActiveModelBadge(modelSelect.value);
                toggleReasoningBudgetVisibility(modelSelect.value);
                
                // Connected state
                setAPIIndicatorState("connected", "Connected");
            } else {
                setAPIIndicatorState("error", extractErrorText(data) || "Failed to load endpoints.");
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
        if (!reasoningBudgetWrapper) return;
        if (modelId.includes("reasoning") || modelId.includes("gpt-oss")) {
            reasoningBudgetWrapper.style.display = "flex";
        } else {
            reasoningBudgetWrapper.style.display = "none";
        }
    }

    function extractErrorText(data) {
        if (!data) return "";
        let raw = "";
        if (typeof data === "string") {
            raw = data;
        } else if (data.error) {
            if (typeof data.error === "object" && data.error.message) {
                raw = data.error.message;
            } else {
                raw = data.error;
            }
        } else if (data.detail) {
            raw = data.title ? `${data.title}: ${data.detail}` : data.detail;
        } else if (data.message) {
            raw = data.message;
        } else if (data.title) {
            raw = data.title;
        } else {
            raw = JSON.stringify(data);
        }

        if (raw.includes("Worker local total request limit reached") || raw.includes("ResourceExhausted") || raw.includes("503")) {
            return `${raw} (NVIDIA server capacity temporarily reached. Please retry in a moment).`;
        }
        if (raw.includes("Not found for account")) {
            return `${raw} (This model function is not enabled for your account tier).`;
        }
        return raw;
    }

    // =========================================================================
    // Chat Message Processing & Citations
    // =========================================================================
    async function sendMessage() {
        const text = composerInput.value.trim();
        if (!text) return;

        // Hide welcome screen
        if (welcomeScreen.style.display !== "none") {
            welcomeScreen.style.display = "none";
        }

        // Append user bubble
        appendMessageUI("user", text);
        scrollToBottom();

        // Clear composer
        composerInput.value = "";
        composerInput.style.height = "auto";
        charCounter.textContent = "0 chars";
        sendBtn.disabled = true;
        sendBtn.classList.remove("active");

        // Save to history
        conversationHistory.push({
            "role": "user",
            "content": text
        });

        // Append assistant typing indicator
        const indicatorId = appendTypingIndicatorUI();
        scrollToBottom();

        // Build messages pipeline
        const messages = [];
        const systemDirectives = systemPrompt ? systemPrompt.value.trim() : "";
        if (systemDirectives) {
            messages.push({
                "role": "system",
                "content": systemDirectives
            });
        }
        messages.push(...conversationHistory);

        // Sanitize messages
        const sanitizedMessages = [];
        for (const m of messages) {
            if (sanitizedMessages.length > 0 && sanitizedMessages[sanitizedMessages.length - 1].role === m.role) {
                sanitizedMessages[sanitizedMessages.length - 1].content += "\n\n" + m.content;
            } else {
                sanitizedMessages.push({ ...m });
            }
        }

        const payload = {
            model: modelSelect.value,
            messages: sanitizedMessages,
            temperature: parseFloat(tempInput.value),
            max_tokens: parseInt(maxTokensInput.value),
            reasoning_budget: parseInt(reasoningInput.value)
        };

        try {
            const { res: response, data } = await safeFetchJson("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            removeTypingIndicatorUI(indicatorId);

            if (response.ok && data && data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                const msg = choice.message;
                const content = msg.content;
                const reasoning = msg.reasoning_content || msg.reasoning;

                let displayContent = content;
                if (data.fallback_notice) {
                    displayContent = `> ⚡ *${data.fallback_notice}*\n\n` + content;
                }

                // Append assistant reply bubble with citations if genZai
                appendMessageUI("assistant", displayContent, reasoning, data.citations);
                scrollToBottom();

                // Save to history
                conversationHistory.push({
                    "role": "assistant",
                    "content": content
                });
            } else {
                if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === "user") {
                    conversationHistory.pop();
                }
                const errorText = extractErrorText(data) || "Unable to retrieve response from server.";
                appendMessageUI("assistant", `<span class="accent-red">Error: ${errorText}</span>`);
                scrollToBottom();
            }
        } catch (error) {
            removeTypingIndicatorUI(indicatorId);
            if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === "user") {
                conversationHistory.pop();
            }
            appendMessageUI("assistant", `<span class="accent-red">Network Error: Failed to communicate with backend.</span>`);
            scrollToBottom();
        }
    }

    // Append Message Bubble with Action Bar and Citations
    function appendMessageUI(role, text, reasoning = null, citations = null) {
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

        // Prepend reasoning accordion if present
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

        // Prepend citations chips if genZai returned verified source citations
        if (citations && citations.length > 0) {
            const citationsContainer = document.createElement("div");
            citationsContainer.className = "citations-container";

            const label = document.createElement("div");
            label.className = "citations-label";
            label.innerHTML = `<i data-lucide="book-check" style="width:14px;height:14px;"></i><span>genZai Verified Sources (${citations.length})</span>`;
            citationsContainer.appendChild(label);

            const chipsWrap = document.createElement("div");
            chipsWrap.className = "citations-chips";

            citations.forEach(c => {
                const chipItem = document.createElement("div");
                chipItem.style.display = "flex";
                chipItem.style.flexDirection = "column";

                const chip = document.createElement("div");
                chip.className = "citation-chip";
                chip.innerHTML = `
                    <i data-lucide="file-text" style="width:12px;height:12px;"></i>
                    <span>${c.source}</span>
                `;

                const popup = document.createElement("div");
                popup.className = "citation-snippet-popup";
                popup.textContent = c.snippet || "Knowledge chunk referenced by genZai.";

                chip.addEventListener("click", () => {
                    chip.classList.toggle("active");
                });

                chipItem.appendChild(chip);
                chipItem.appendChild(popup);
                chipsWrap.appendChild(chipItem);
            });

            citationsContainer.appendChild(chipsWrap);
            bubble.appendChild(citationsContainer);
        }

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
            `;

            // Action: Copy
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
                const userMessages = conversationHistory.filter(m => m.role === "user");
                if (userMessages.length > 0) {
                    const lastUserText = userMessages[userMessages.length - 1].content;
                    conversationHistory = conversationHistory.slice(0, -2);
                    const domRows = conversationStream.querySelectorAll(".message-row");
                    if (domRows.length >= 2) {
                        domRows[domRows.length - 1].remove();
                        domRows[domRows.length - 2].remove();
                    }
                    composerInput.value = lastUserText;
                    composerInput.style.height = "auto";
                    composerInput.style.height = (composerInput.scrollHeight) + "px";
                    charCounter.textContent = `${lastUserText.length} chars`;
                    sendBtn.disabled = false;
                    sendBtn.classList.add("active");
                    sendMessage();
                }
            });

            // Action: Like/Dislike
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

    // Markdown Parser
    function formatMessageText(text) {
        if (!text) return "";
        let escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/&lt;span class="accent-red"&gt;/g, '<span class="accent-red">')
            .replace(/&lt;\/span&gt;/g, '</span>');

        // Simple code blocks
        escaped = escaped.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<div class="code-block-wrapper"><div class="code-header"><span>${lang || 'code'}</span><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').innerText)"><i data-lucide="copy" style="width:12px;height:12px;"></i> Copy</button></div><pre><code class="language-${lang}">${code.trim()}</code></pre></div>`;
        });

        // Inline code
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Bold & Italic
        escaped = escaped.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Blockquotes
        escaped = escaped.replace(/^>\s*(.+)$/gm, '<blockquote class="quote-block">$1</blockquote>');

        // Paragraph line breaks
        escaped = escaped.replace(/\n\n+/g, '<br><br>');
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

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
