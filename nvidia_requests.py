import os
import requests

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

api_key = get_api_key()
if not api_key:
    raise RuntimeError("NVIDIA_API_KEY is not set in environment or local .env file.")

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "text/event-stream" if stream else "application/json",
}

payload = {
  "messages": [
    {
      "role": "user",
      "content": "Explain black holes in one short sentence."
    }
  ],
  "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "max_tokens": 1024,
  "reasoning_budget": 500,
  "stream": stream,
  "temperature": 0.6,
  "top_p": 0.95
}

print("Sending request using requests library...")
response = requests.post(invoke_url, headers=headers, json=payload, stream=stream)
if stream:
    for line in response.iter_lines():
        if line:
            print(line.decode("utf-8"))
else:
    import json
    print(json.dumps(response.json(), indent=2))
