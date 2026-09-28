"""
Screenshot Error Diagnoser
Web UI accepts screenshot upload → Vision LLM extracts error text,
RAG-matches to knowledge base, replies with fix steps.
Uses OpenRouter API.
"""
import os
import json
import base64
from pathlib import Path
import requests
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv

# Load local environment variables
load_dotenv()

app = Flask(__name__)

KB_PATH = Path("knowledge_base.json")

def load_kb() -> list:
    """Load knowledge base from JSON file, fallback to defaults."""
    if KB_PATH.exists():
        try:
            with open(KB_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    # Default mock entries if file is missing or corrupted
    defaults = [
        {"error": "ECONNREFUSED", "fix": "The service you're connecting to is not running. Start it with `npm start` or `docker-compose up`."},
        {"error": "ModuleNotFoundError", "fix": "Missing Python package. Run `pip install <package-name>`. Check requirements.txt."},
        {"error": "Cannot read properties of undefined", "fix": "JavaScript null reference. Add a null check: `if (obj && obj.prop)` before accessing."},
        {"error": "CORS policy", "fix": "Cross-origin request blocked. Add CORS headers on your server or use a proxy in development."},
        {"error": "ORA-01017", "fix": "Oracle DB invalid credentials. Check username/password in your connection string."},
        {"error": "SSL certificate", "fix": "SSL verification failed. Check certificate expiry. Use `--insecure` only in dev, not production."},
        {"error": "Out of memory", "fix": "Increase heap size: `node --max-old-space-size=4096` or add more RAM to the container."},
        {"error": "permission denied", "fix": "File permissions issue. Run `chmod +x <file>` or check if you need sudo."},
        {"error": "port already in use", "fix": "Another process is using this port. Find it with `lsof -i :<port>` and kill it."},
        {"error": "404 Not Found", "fix": "Endpoint doesn't exist. Check the URL, method (GET/POST), and API version."},
    ]
    save_kb(defaults)
    return defaults

def save_kb(kb_data: list):
    """Save knowledge base data to file."""
    with open(KB_PATH, "w", encoding="utf-8") as f:
        json.dump(kb_data, f, indent=4)

def rag_lookup(error_text: str) -> list:
    """Simple keyword-based RAG matching."""
    kb = load_kb()
    matches = []
    error_lower = error_text.lower()
    for entry in kb:
        if entry["error"].lower() in error_lower:
            matches.append(entry)
    return matches[:3]

def call_openrouter(api_key: str, api_url: str, model: str, messages: list, max_tokens: int = 1000) -> str:
    """Helper to request completions from OpenRouter."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/vishnu-psvpec/06-screenshot-error-diagnoser",
        "X-Title": "Screenshot Error Diagnoser"
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens
    }
    
    resp = requests.post(f"{api_url}/chat/completions", headers=headers, json=payload)
    if resp.status_code != 200:
        raise Exception(f"OpenRouter Error ({resp.status_code}): {resp.text}")
        
    return resp.json()["choices"][0]["message"]["content"]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/kb", methods=["GET"])
def get_kb():
    return jsonify(load_kb())

@app.route("/api/kb", methods=["POST"])
def add_kb():
    data = request.json
    if not data or "error" not in data or "fix" not in data:
        return jsonify({"error": "Invalid data structure"}), 400
    
    kb = load_kb()
    kb.append({
        "error": data["error"].strip(),
        "fix": data["fix"].strip()
    })
    save_kb(kb)
    return jsonify({"status": "success"})

@app.route("/api/kb/<int:idx>", methods=["DELETE"])
def delete_kb(idx):
    kb = load_kb()
    if 0 <= idx < len(kb):
        kb.pop(idx)
        save_kb(kb)
        return jsonify({"status": "success"})
    return jsonify({"error": "Index out of range"}), 404

@app.route("/diagnose", methods=["POST"])
def diagnose():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    # Read dynamic configuration parameters from front-end request
    client_api_key = request.form.get("api_key")
    client_model = request.form.get("model")
    client_api_url = request.form.get("api_url")

    # Fallback to server side environment variables if not provided by client
    api_key = client_api_key or os.environ.get("OPENROUTER_API_KEY")
    model = client_model or os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o")
    api_url = client_api_url or os.environ.get("OPENROUTER_API_URL", "https://openrouter.ai/api/v1")

    if not api_key:
        return jsonify({"error": "OpenRouter API Key not found. Please set it in Settings or configured server environment variables."}), 400

    img = request.files["image"]
    img_data = base64.b64encode(img.read()).decode()
    media_type = img.content_type or "image/png"

    try:
        # Step 1: Vision LLM extracts error text
        ocr_messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text", 
                        "text": "Extract the exact error message text from this screenshot. Return ONLY the error text, nothing else."
                    },
                    {
                        "type": "image_url", 
                        "image_url": {
                            "url": f"data:{media_type};base64,{img_data}"
                        }
                    }
                ]
            }
        ]
        
        error_text = call_openrouter(api_key, api_url, model, ocr_messages, max_tokens=500).strip()

        # Step 2: RAG lookup
        kb_matches = rag_lookup(error_text)
        kb_context = "\n".join([f"- {m['error']}: {m['fix']}" for m in kb_matches]) if kb_matches else "No direct match found."

        # Step 3: LLM generates fix steps
        fix_messages = [
            {
                "role": "user",
                "content": f"Error text: {error_text}\n\nRelevant knowledge base entries:\n{kb_context}\n\nProvide clear, numbered fix steps for this error. Be specific and actionable."
            }
        ]
        
        fix_steps = call_openrouter(api_key, api_url, model, fix_messages, max_tokens=600).strip()

        return jsonify({
            "error_text": error_text,
            "fix_steps": fix_steps,
            "kb_matches": len(kb_matches)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5001)
