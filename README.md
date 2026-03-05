# Claude Code OpenAI Proxy

[English](README.md) | [中文](README_CN.md)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/doctoroyy/cc-nim-worker)

Convert **any OpenAI-compatible API** into the **Anthropic Messages API**, so you can use Claude Code (Anthropic CLI) with any OpenAI-compatible backend.

Just append the target API's base URL to the Worker URL — no code changes needed.

## Features

- **Universal Proxy**: Works with any OpenAI-compatible API (NVIDIA NIM, OpenAI, DeepSeek, Kimi, local Ollama, etc.).
- **Zero Config**: Just concatenate the target API domain — no Worker code changes required.
- **Stateless**: API Key is passed via headers, no server-side secret management needed.
- **Streaming**: Full SSE support for real-time responses.
- **Thinking Tags**: Handles `<think>` tags and `reasoning_content` from reasoning models.
- **Tool Calling**: Supports tool usage loop.

## Deployment

### One-Click Deploy

Click the "Deploy to Cloudflare Workers" button above.

### Manual Deploy

1. **Clone & Install**
   ```bash
   git clone https://github.com/doctoroyy/cc-nim-worker.git
   cd cc-nim-worker
   pnpm install
   ```

2. **Deploy**
   ```bash
   pnpm run deploy
   ```

   Note the URL, e.g., `https://your-worker.workers.dev`.

## Usage

### Core: Append Any API Domain

Format: `https://<worker-domain>/<target-API-base-URL>`

```bash
# NVIDIA NIM
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://integrate.api.nvidia.com/v1
export ANTHROPIC_API_KEY=nvapi-your-key-here

# OpenAI
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://api.openai.com/v1
export ANTHROPIC_API_KEY=sk-your-openai-key

# DeepSeek
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://api.deepseek.com/v1
export ANTHROPIC_API_KEY=your-deepseek-key

# Local Ollama (must be publicly accessible)
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/http://your-server:11434/v1
export ANTHROPIC_API_KEY=ollama

# Any OpenAI-compatible API
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://any-openai-api.com/v1
export ANTHROPIC_API_KEY=your-api-key

claude
```

### How It Works

Claude Code sends requests to `${ANTHROPIC_BASE_URL}/v1/messages`. For example:

```
Request URL: https://your-worker.workers.dev/https://api.openai.com/v1/v1/messages
                                            ↑ Target Base URL         ↑ Appended by Claude Code
```

The Worker will:
1. Extract the target API base URL from the path (`https://api.openai.com/v1`)
2. Convert the Anthropic Messages request body to OpenAI Chat Completions format
3. Forward to `https://api.openai.com/v1/chat/completions`
4. Convert the OpenAI response back to Anthropic Messages format

### Legacy Mode

Use `/v1/messages` directly without a target domain. The Worker falls back to `DEFAULT_BASE_URL` from environment:

```bash
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev
export ANTHROPIC_API_KEY=nvapi-your-key-here

claude
```

## Configuration (Optional)

Set in `wrangler.toml` or Cloudflare Secrets:

- `MODEL`: Force override the model name in all requests (e.g., `moonshotai/kimi-k2-thinking`). If unset, the client's model name is passed through.
- `DEFAULT_BASE_URL`: Default API base URL for legacy mode.
- `DEFAULT_API_KEY`: Server-side fallback key if the client doesn't provide one.

> Legacy env vars `NVIDIA_NIM_BASE_URL` and `NVIDIA_NIM_API_KEY` are still supported.

## License

MIT
