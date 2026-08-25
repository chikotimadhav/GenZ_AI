# Parse NVIDIA_API_KEY from environment or local .env file
$apiKey = $env:NVIDIA_API_KEY
if (-not $apiKey) {
    if (Test-Path .env) {
        $envContent = Get-Content .env
        foreach ($line in $envContent) {
            if ($line.Trim().StartsWith("NVIDIA_API_KEY=")) {
                $apiKey = $line.Split("=", 2)[1].Trim().Trim("'").Trim('"')
                break
            }
        }
    }
}

if (-not $apiKey) {
    Write-Error "NVIDIA_API_KEY is not set in environment or local .env file."
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

$body = @{
    "messages" = @(
        @{
            "role" = "user"
            "content" = "Explain black holes in one short sentence."
        }
    )
    "model" = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    "max_tokens" = 1000
    "reasoning_budget" = 500
    "stream" = $false
    "temperature" = 0.6
    "top_p" = 0.95
} | ConvertTo-Json -Depth 5

Write-Host "Sending request using Invoke-RestMethod..."
$response = Invoke-RestMethod -Uri "https://integrate.api.nvidia.com/v1/chat/completions" -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 5
