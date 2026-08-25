import os
from langchain_nvidia_ai_endpoints import ChatNVIDIA

# Load from .env into os.environ if NVIDIA_API_KEY not already set
if "NVIDIA_API_KEY" not in os.environ:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("NVIDIA_API_KEY="):
                    os.environ["NVIDIA_API_KEY"] = line.strip().split("=", 1)[1].strip('"\' ')

if not os.getenv("NVIDIA_API_KEY"):
    raise RuntimeError("NVIDIA_API_KEY is not set in environment or local .env file.")

client = ChatNVIDIA(
  model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  temperature=0.6,
  top_p=0.95,
  max_completion_tokens=1000,
)

lc_messages = [
  {
    "role": "user",
    "content": "Explain black holes in one short sentence.",
  },
]

print("Sending request using LangChain ChatNVIDIA...")
response = client.invoke(lc_messages)
if response.additional_kwargs and "reasoning_content" in response.additional_kwargs:
  print("Reasoning:\n", response.additional_kwargs["reasoning_content"])
print("Content:\n", response.content)
