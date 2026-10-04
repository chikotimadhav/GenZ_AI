# 🚀 GenZ AI — Web Copilot Browser Extension

Run your **genZai** custom AI model and NVIDIA NIM as a floating chat box popup on **any website** you browse!

---

## 📦 How to Install in Chrome, Edge, or Brave (30 Seconds)

1. Open your browser and go to the extensions management page:
   - **Google Chrome**: [`chrome://extensions`](chrome://extensions)
   - **Microsoft Edge**: [`edge://extensions`](edge://extensions)
   - **Brave Browser**: [`brave://extensions`](brave://extensions)
2. In the top-right corner, turn **ON** the switch called **"Developer mode"**.
3. Click the **"Load unpacked"** button (top-left).
4. In the file picker, select this exact folder:
   ```
   c:\Users\Madhav\nvidia\extension
   ```
5. ✨ **Done!** The GenZ AI icon will appear in your browser's toolbar.

---

## 🌟 Features

- **Floating Popup Chatbox**: A floating bubble appears in the bottom right corner of any website you visit. Click it to expand your custom AI chat box!
- **Zero Style Interference**: Encapsulated using isolated **Shadow DOM** so it never breaks the layout or styling of third-party websites.
- **Webpage Context & Summaries**: Click the **"Summarize this page"** button or toggle **"Page Context"** to chat with AI directly about any article, documentation, or site you're reading.
- **Custom genZai Knowledge**: Full access to your custom trained document store, citations, and NVIDIA NIM models.
- **Extension Toolbar Controls**:
  - Turn the on-page floating bubble ON or OFF with a single switch.
  - Test server connection.
  - Quick action: "Summarize Active Page".
  - Change server URL (defaults to `http://127.0.0.1:5000`).

---

## 🔌 Running the Server

Ensure your GenZ AI backend is running:
```bash
python app.py
```
Default server endpoint is `http://127.0.0.1:5000`.
