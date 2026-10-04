import os
import sys
import re
import time
import subprocess
import threading
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLOUDFLARED_PATH = os.path.join(BASE_DIR, "cloudflared.exe")

def is_server_running(url="http://127.0.0.1:5000/api/models"):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GenZAI-Check"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False

def ensure_cloudflared():
    if os.path.exists(CLOUDFLARED_PATH):
        return True
    print("⏳ Downloading cloudflared for public HTTPS tunnel...")
    download_url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    try:
        urllib.request.urlretrieve(download_url, CLOUDFLARED_PATH)
        print("✅ cloudflared downloaded successfully.")
        return True
    except Exception as e:
        print(f"❌ Failed to download cloudflared: {e}")
        return False

def main():
    print("=====================================================")
    print("      🚀 Starting GenZ AI Online Server & Tunnel     ")
    print("=====================================================")

    # 1. Start app.py if not already running
    flask_proc = None
    if not is_server_running():
        print("▶️  Starting local Flask server (python app.py)...")
        flask_proc = subprocess.Popen(
            [sys.executable, "app.py"],
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        # Wait up to 10s for server to start
        for _ in range(20):
            time.sleep(0.5)
            if is_server_running():
                print("✅ Flask server is running on http://127.0.0.1:5000")
                break
        else:
            print("⚠️ Flask is taking longer to start, continuing to tunnel...")
    else:
        print("✅ Local Flask server is already running on http://127.0.0.1:5000")

    # 2. Ensure cloudflared is present
    if not ensure_cloudflared():
        print("❌ Cannot start tunnel without cloudflared.")
        return

    # 3. Launch cloudflared tunnel
    print("🌐 Creating secure public HTTPS tunnel...")
    cf_proc = subprocess.Popen(
        [CLOUDFLARED_PATH, "tunnel", "--url", "http://127.0.0.1:5000"],
        cwd=BASE_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    tunnel_url = None
    tunnel_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    # Read output to capture tunnel URL
    def monitor_stream():
        nonlocal tunnel_url
        for line in cf_proc.stdout:
            match = tunnel_regex.search(line)
            if match and not tunnel_url:
                tunnel_url = match.group(0)
                print("\n" + "=" * 68)
                print("  🎉 YOUR GENZ AI IS NOW ONLINE & ACCESSIBLE WORLDWIDE! 🎉")
                print("=" * 68)
                print("  👑 FOR YOU (HOST / MADHAV):")
                print("     Your browser extension connects directly to your own server:")
                print("     👉 http://127.0.0.1:5000 (fastest, direct, no external tunnel needed)")
                print("=" * 68)
                print("  👥 FOR YOUR FRIENDS (REMOTE ACCESS):")
                print(f"     👉 Share this Public HTTPS URL: \033[1;32m{tunnel_url}\033[0m")
                print("     Steps for your friend:")
                print("     1. Open any webpage in Chrome / Edge with GenZ AI Extension")
                print("     2. Click the server address at bottom right of the chat")
                print("        (or click the extension icon in the toolbar)")
                print(f"     3. Enter: {tunnel_url}")
                print("     4. Done! They can now access your server and all AI models!")
                print("=" * 68)
                print("  [Press Ctrl+C to stop the online server & tunnel]\n")

    t = threading.Thread(target=monitor_stream, daemon=True)
    t.start()

    try:
        while True:
            time.sleep(1)
            if cf_proc.poll() is not None:
                print("⚠️ Cloudflare tunnel terminated.")
                break
    except KeyboardInterrupt:
        print("\n🛑 Stopping GenZ AI online tunnel...")
    finally:
        if cf_proc and cf_proc.poll() is None:
            cf_proc.terminate()
        if flask_proc and flask_proc.poll() is None:
            flask_proc.terminate()
        print("👋 Shutdown complete.")

if __name__ == "__main__":
    main()
