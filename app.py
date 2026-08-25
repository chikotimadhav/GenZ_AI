import os
import requests
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", template_folder="templates")

# Load API key from environment or local .env file
def get_api_key():
    key = os.getenv("NVIDIA_API_KEY")
    if key:
        return key
    
    # Fallback to local .env file
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("NVIDIA_API_KEY="):
                    return line.strip().split("=", 1)[1].strip('"\' ')
    return None

API_KEY = get_api_key()
BASE_URL = "https://integrate.api.nvidia.com/v1"

@app.route("/")
def index():
    return send_from_directory("templates", "index.html")

@app.route("/api/models", methods=["GET"])
def list_models():
    if not API_KEY:
        return jsonify({"error": "NVIDIA_API_KEY is not set on the server."}), 500
    
    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Accept": "application/json"
        }
        response = requests.get(f"{BASE_URL}/models", headers=headers)
        if response.status_code == 200:
            data = response.json()
            # Extract model IDs and sort them
            model_ids = [m["id"] for m in data.get("data", [])]
            model_ids.sort()
            return jsonify({"models": model_ids})
        else:
            return jsonify({"error": f"NVIDIA API responded with status {response.status_code}"}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    if not API_KEY:
        return jsonify({"error": "NVIDIA_API_KEY is not set on the server."}), 500
    
    data = request.json
    model = data.get("model", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
    messages = data.get("messages", [])
    temperature = data.get("temperature", 0.7)
    max_tokens = data.get("max_tokens", 1024)
    reasoning_budget = data.get("reasoning_budget", 1024)

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": 0.95,
        "stream": False
    }

    # Add reasoning_budget if it is a reasoning model
    if "reasoning" in model or "gpt-oss" in model:
        payload["reasoning_budget"] = reasoning_budget

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        response = requests.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers)
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify(response.json()), response.status_code
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Start the server on port 5000
    app.run(host="127.0.0.1", port=5000, debug=True)
