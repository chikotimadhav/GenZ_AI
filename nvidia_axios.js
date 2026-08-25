const fs = require('fs');
const path = require('path');
const axios = require('axios');

function getApiKey() {
  if (process.env.NVIDIA_API_KEY) {
    return process.env.NVIDIA_API_KEY;
  }
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('NVIDIA_API_KEY=')) {
        const parts = line.split('=', 2);
        return parts[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return null;
}

const apiKey = getApiKey();
if (!apiKey) {
  console.error("Error: NVIDIA_API_KEY is not set in environment or local .env file.");
  process.exit(1);
}

const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const stream = false;

const headers = {
  "Authorization": `Bearer ${apiKey}`,
  "Accept": stream ? "text/event-stream" : "application/json"
};

async function main() {
  const payload = {
    "messages": [
      {
        "role": "user",
        "content": "Explain black holes in one short sentence."
      }
    ],
    "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "max_tokens": 1000,
    "reasoning_budget": 500,
    "stream": stream,
    "temperature": 0.6,
    "top_p": 0.95
  };

  console.log("Sending request using Axios...");
  const response = await axios.post(invokeUrl, payload, {
    headers: headers,
    responseType: stream ? 'stream' : 'json'
  });

  if (stream) {
    response.data.on('data', (chunk) => {
      console.log(chunk.toString());
    });
  } else {
    console.log(JSON.stringify(response.data, null, 2));
  }
}

main().catch(error => {
  if (error.response) {
    console.error(`HTTP ${error.response.status}`);
    if (error.response.data?.on) {
      error.response.data.on('data', (chunk) => console.error(chunk.toString()));
    } else {
      console.error(error.response.data);
    }
  } else {
    console.error(error);
  }
});
