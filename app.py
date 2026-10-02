import os
import re
import json
import requests
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
from genzai_engine import engine, DOCS_DIR

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload

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

# ==========================================
# genZai Knowledge & Training APIs
# ==========================================
@app.route("/api/genzai/status", methods=["GET"])
def genzai_status():
    return jsonify(engine.get_status())

@app.route("/api/genzai/train", methods=["POST"])
def genzai_train():
    try:
        res = engine.train_model()
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

@app.route("/api/genzai/upload", methods=["POST"])
def genzai_upload():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "Empty filename"}), 400
        
        # Allowed extensions
        allowed_extensions = {".pdf", ".txt", ".md", ".json", ".csv", ".py", ".html"}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            return jsonify({"error": f"Unsupported file type '{ext}'. Supported: PDF, TXT, MD, JSON, CSV"}), 400

        filename = secure_filename(file.filename)
        os.makedirs(DOCS_DIR, exist_ok=True)
        filepath = os.path.join(DOCS_DIR, filename)
        file.save(filepath)
        
        train_res = engine.train_model()
        return jsonify({
            "message": f"Successfully uploaded and trained '{filename}' into genZai!",
            "filename": filename,
            "training": train_res,
            "status": engine.get_status()
        })
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route("/api/genzai/note", methods=["POST"])
def genzai_add_note():
    try:
        data = request.json or {}
        title = data.get("title", "").strip() or "Custom Knowledge Note"
        content = data.get("content", "").strip()
        if not content:
            return jsonify({"error": "Note content cannot be empty"}), 400
        
        filename = engine.add_text_note(title, content)
        return jsonify({
            "message": f"Successfully trained knowledge note '{title}' into genZai!",
            "filename": filename,
            "status": engine.get_status()
        })
    except Exception as e:
        return jsonify({"error": f"Failed to train note: {str(e)}"}), 500

@app.route("/api/genzai/document/<path:filename>", methods=["DELETE"])
def genzai_delete_doc(filename):
    try:
        success = engine.delete_document(filename)
        if success:
            return jsonify({
                "message": f"Document '{filename}' deleted. genZai knowledge store retrained.",
                "status": engine.get_status()
            })
        return jsonify({"error": f"Document '{filename}' not found or cannot be deleted."}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to delete document: {str(e)}"}), 500

@app.route("/api/genzai/generate-dataset", methods=["POST"])
def genzai_generate_dataset():
    if not API_KEY:
        return jsonify({"error": "NVIDIA_API_KEY is not set on the server."}), 500
    
    data = request.json or {}
    topic = data.get("topic", "").strip()
    count = min(int(data.get("count", 5)), 10)
    auto_train = data.get("auto_train", True)
    
    if not topic:
        return jsonify({"error": "Topic or source content is required."}), 400

    prompt = (
        f"Generate exactly {count} realistic, informative question-and-answer training pairs about the following topic:\n\n"
        f"Topic / Subject: {topic}\n\n"
        "Return STRICTLY a JSON array of objects with keys 'question' and 'answer'. "
        "Do not include any intro, outro, markdown ticks, or explanation. ONLY raw JSON."
    )

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "meta/llama-3.2-11b-vision-instruct",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.6,
            "max_tokens": 1500
        }
        resp = requests.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers, timeout=60)
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            match = re.search(r'\[.*\]', content, re.DOTALL)
            json_text = match.group(0) if match else content
            pairs = json.loads(json_text)

            # Auto-save and train into genZai if requested
            saved_filename = None
            if auto_train:
                safe_title = re.sub(r'[^a-zA-Z0-9_\- ]', '', topic)[:30].strip().replace(" ", "_")
                saved_filename = f"dataset_{safe_title}.json"
                os.makedirs(DOCS_DIR, exist_ok=True)
                filepath = os.path.join(DOCS_DIR, saved_filename)
                try:
                    with open(filepath, "w", encoding="utf-8") as f:
                        json.dump(pairs, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    engine.virtual_documents[saved_filename] = {
                        "title": f"Dataset: {topic}",
                        "content": json.dumps(pairs, ensure_ascii=False),
                        "size": len(json.dumps(pairs).encode("utf-8"))
                    }
                engine.train_model()

            return jsonify({
                "message": f"Generated {len(pairs)} training pairs.",
                "pairs": pairs,
                "saved_filename": saved_filename,
                "status": engine.get_status()
            })
        else:
            return jsonify({"error": f"NVIDIA API responded with status {resp.status_code}"}), resp.status_code
    except Exception as e:
        return jsonify({"error": f"Dataset generation error: {str(e)}"}), 500

@app.route("/api/genzai/export-dataset", methods=["GET"])
def genzai_export_dataset():
    lines = []
    for c in engine.chunks:
        lines.append(json.dumps({"text": c["text"], "source": c["source"]}, ensure_ascii=False))
    return "\n".join(lines), 200, {
        "Content-Type": "application/x-jsonlines",
        "Content-Disposition": "attachment; filename=genzai_training_data.jsonl"
    }

# ==========================================
# Models and Chat Execution
# ==========================================
@app.route("/api/models", methods=["GET"])
def list_models():
    if not API_KEY:
        return jsonify({"error": "NVIDIA_API_KEY is not set on the server."}), 500
    
    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Accept": "application/json"
        }
        response = requests.get(f"{BASE_URL}/models", headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            UNENTITLED_NAMESPACES = {
                "01-ai", "adept", "ai21labs", "aisingapore", "bigcode", "databricks",
                "microsoft", "mistralai", "nv-mistralai", "writer", "zyphra"
            }
            NON_CHAT_OR_UNAVAILABLE = [
                "embed", "clip", "reward", "parse", "detector", "deplot", "kosmos",
                "codegemma", "gemma-2b", "gemma-3", "recurrentgemma", "granite",
                "llama2", "codellama", "vila", "neva", "chatqa", "minitron"
            ]
            
            model_ids = []
            for m in data.get("data", []):
                mid = m["id"]
                org = mid.split("/")[0] if "/" in mid else ""
                if org in UNENTITLED_NAMESPACES:
                    continue
                if any(kw in mid.lower() for kw in NON_CHAT_OR_UNAVAILABLE):
                    continue
                model_ids.append(mid)
            
            # Prioritize verified online models
            VERIFIED_MODELS = [
                "meta/llama-3.2-11b-vision-instruct",
                "moonshotai/kimi-k3",
                "nvidia/nemotron-3-ultra-550b-a55b",
                "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
                "nvidia/riva-translate-4b-instruct-v2",
                "openai/gpt-oss-20b"
            ]
            verified = [m for m in VERIFIED_MODELS if m in model_ids]
            remaining = sorted([m for m in model_ids if m not in VERIFIED_MODELS])
            
            # genZai is the primary custom model at the absolute top!
            ordered_models = ["genZai (Custom Trained Model)"] + verified + remaining
            
            return jsonify({"models": ordered_models})
        else:
            return jsonify({"models": ["genZai (Custom Trained Model)", "meta/llama-3.2-11b-vision-instruct"]})
    except Exception as e:
        return jsonify({"models": ["genZai (Custom Trained Model)", "meta/llama-3.2-11b-vision-instruct"]})

@app.route("/api/chat", methods=["POST"])
def chat():
    if not API_KEY:
        return jsonify({"error": "NVIDIA_API_KEY is not set on the server."}), 500
    
    data = request.json
    selected_model = data.get("model", "genZai (Custom Trained Model)")
    raw_messages = data.get("messages", [])
    temperature = data.get("temperature", 0.7)
    max_tokens = data.get("max_tokens", 1024)
    reasoning_budget = data.get("reasoning_budget", 1024)

    is_genzai = "genzai" in selected_model.lower()
    citations = []

    # Sanitize messages to strictly ensure alternating roles
    sanitized_messages = []
    for msg in raw_messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if not content:
            continue
        
        if role == "system" and not sanitized_messages:
            sanitized_messages.append({"role": "system", "content": content})
            continue

        if sanitized_messages and sanitized_messages[-1]["role"] == role:
            sanitized_messages[-1]["content"] += "\n\n" + content
        else:
            sanitized_messages.append({"role": role, "content": content})

    if not sanitized_messages:
        sanitized_messages = [{"role": "user", "content": "Hello"}]

    # RAG Retrieval and Custom Prompting for genZai
    if is_genzai:
        last_user_query = ""
        for m in reversed(sanitized_messages):
            if m["role"] == "user":
                last_user_query = m["content"]
                break

        retrieved = []
        if last_user_query:
            retrieved = engine.retrieve_context(last_user_query, top_k=4)
            citations = [
                {
                    "source": c["source"],
                    "page": c.get("page", 1),
                    "snippet": (c["text"][:140] + "...") if len(c["text"]) > 140 else c["text"],
                    "score": c["score"]
                }
                for c in retrieved
            ]

        genzai_prompt = engine.build_genzai_prompt(last_user_query, retrieved)

        if sanitized_messages and sanitized_messages[0]["role"] == "system":
            sanitized_messages[0]["content"] = f"{genzai_prompt}\n\nAdditional directives:\n{sanitized_messages[0]['content']}"
        else:
            sanitized_messages.insert(0, {"role": "system", "content": genzai_prompt})

        # genZai uses verified high-performance meta/llama-3.2-11b-vision-instruct as neural backbone
        actual_model = "meta/llama-3.2-11b-vision-instruct"
    else:
        actual_model = selected_model

    payload = {
        "model": actual_model,
        "messages": sanitized_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": 0.95,
        "stream": False
    }

    if "reasoning" in actual_model or "gpt-oss" in actual_model:
        payload["reasoning_budget"] = reasoning_budget

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        response = requests.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers, timeout=90)
        
        if response.status_code == 200:
            resp_data = response.json()
            if is_genzai:
                resp_data["is_genzai"] = True
                resp_data["citations"] = citations
            return jsonify(resp_data)
        
        # Auto-fallback if overloaded or unentitled
        if response.status_code in [404, 503] and actual_model != "meta/llama-3.2-11b-vision-instruct":
            fallback_payload = dict(payload)
            fallback_payload["model"] = "meta/llama-3.2-11b-vision-instruct"
            fallback_payload.pop("reasoning_budget", None)
            
            fb_response = requests.post(f"{BASE_URL}/chat/completions", json=fallback_payload, headers=headers, timeout=60)
            if fb_response.status_code == 200:
                fb_data = fb_response.json()
                reason = "worker capacity limit (16/16)" if response.status_code == 503 else "unsupported account entitlement"
                fb_data["fallback_notice"] = f"Model '{actual_model}' was unavailable due to {reason}. Automatically routed to meta/llama-3.2-11b-vision-instruct."
                if is_genzai:
                    fb_data["is_genzai"] = True
                    fb_data["citations"] = citations
                return jsonify(fb_data)

        try:
            return jsonify(response.json()), response.status_code
        except Exception:
            return jsonify({"error": response.text or f"NVIDIA API responded with status {response.status_code}"}), response.status_code
            
    except requests.exceptions.Timeout:
        return jsonify({"error": "The model took too long to respond (>90s). Server queue may be full."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# Global JSON Error Handlers
# ==========================================
@app.errorhandler(400)
def handle_bad_request(e):
    return jsonify({"error": str(getattr(e, "description", e))}), 400

@app.errorhandler(404)
def handle_not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": f"API endpoint '{request.path}' not found."}), 404
    return send_from_directory("templates", "index.html")

@app.errorhandler(500)
def handle_server_error(e):
    return jsonify({"error": f"Internal server error: {str(getattr(e, 'description', e))}"}), 500

@app.errorhandler(Exception)
def handle_unexpected_exception(e):
    return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

