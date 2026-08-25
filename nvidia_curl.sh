#!/bin/bash

# Parse NVIDIA_API_KEY from environment or local .env file
if [ -z "$NVIDIA_API_KEY" ]; then
  if [ -f .env ]; then
    export NVIDIA_API_KEY=$(grep -E "^NVIDIA_API_KEY=" .env | cut -d '=' -f 2- | tr -d '"'\'' ')
  fi
fi

if [ -z "$NVIDIA_API_KEY" ]; then
  echo "Error: NVIDIA_API_KEY is not set in environment or local .env file."
  exit 1
fi

stream=false
if [ "$stream" = true ]; then
    accept_header='Accept: text/event-stream'
else
    accept_header='Accept: application/json'
fi

cat > payload.json <<JSON
{
  "messages": [
    {
      "role": "user",
      "content": "Explain black holes in one short sentence."
    }
  ],
  "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "max_tokens": 1000,
  "reasoning_budget": 500,
  "stream": false,
  "temperature": 0.6,
  "top_p": 0.95
}
JSON

curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "$accept_header" \
  -d @payload.json
