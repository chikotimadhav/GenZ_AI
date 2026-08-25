import os
from openai import OpenAI

# Retrieve the API key from environment variable or local .env file
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
    raise RuntimeError("NVIDIA_API_KEY is not set in environment variables or a local .env file.")

# Initialize the OpenAI client pointing to NVIDIA's NIM API base URL
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=api_key
)

# You can change this to any model from NVIDIA Build, e.g., "nvidia/llama-3.1-nemotron-70b-instruct"
MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"

print("NVIDIA AI Chatbot")
print("Type 'exit' to quit.\n")

messages = [
    {
        "role": "system",
        "content": "You are a helpful, friendly AI assistant."
    }
]

while True:
    user_input = input("You: ")

    if user_input.lower() == "exit":
        print("Goodbye!")
        break

    # Skip empty input
    if not user_input.strip():
        continue

    messages.append({
        "role": "user",
        "content": user_input
    })

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )

        answer = response.choices[0].message.content

        print(f"\nAI: {answer}\n")

        messages.append({
            "role": "assistant",
            "content": answer
        })

    except Exception as e:
        print(f"\nAPI Error: {e}\n")
