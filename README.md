# Claude Code NIM Worker

[English](README.md) | [中文](README_CN.md)

This allows you to use **NVIDIA NIM** models (like `moonshotai/kimi-k2-thinking`, `deepseek-r1`, etc.) as a backend for **Claude Code** (the Anthropic CLI).

It runs as a stateless Cloudflare Worker. The API Key is passed from the client, meaning you don't need to manage secrets on the server side (though you can set a default one if you wish).

## Features

- **Stateless Proxy**: Pass your NVIDIA NIM API Key via headers.
- **Streaming Support**: Full SSE support for real-time responses.
- **Thinking Tags**: Correctly handles `<think>` tags from reasoning models (like Kimi k2, DeepSeek R1) and converts them for Claude Code.
- **Tool Calling**: Supports tool usage loop.

## Deployment

1. **Clone & Install**
   ```bash
   git clone <your-repo-url>
   cd cc-nim-worker
   pnpm install
   ```

2. **Deploy**
   ```bash
   pnpm run deploy
   ```
   
   Note the URL you get, e.g., `https://your-worker.workers.dev`.

## Usage

Configure Claude Code to use your worker URL.

```bash
# Set your NVIDIA NIM API Key
export NVIDIA_NIM_API_KEY=nvapi-your-key-here

# Run Claude Code pointing to your worker
# Note: Claude Code doesn't natively support custom headers easily for auth, 
# so we assume you might need a local forwarder OR use the `c.env` fallback if this is for personal use.
# BUT, for pure pass-through:
```

**Wait, Claude Code CLI Auth Limitation**:
The standard `claude` CLI expects to talk to Anthropic. It sends `x-api-key` (Anthropic key).
Our worker expects `Authorization: Bearer <NVIDIA_KEY>` or `x-api-key`.
If you set `ANTHROPIC_API_KEY=nvapi-...`, `claude` CLI will send it in `x-api-key` header.
**This Worker supports receiving the key via `x-api-key` header!**

So simple usage:

```bash
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev
export ANTHROPIC_API_KEY=nvapi-your-key-here

claude
```

## Configuration (Optional)

You can set these defaults in `wrangler.toml` or Cloudflare Secrets:

- `MODEL`: Default model to use (e.g. `moonshotai/kimi-k2-thinking`).
- `NVIDIA_NIM_BASE_URL`: If you want to point to a different NIM compatible endpoint.
- `NVIDIA_NIM_API_KEY`: Server-side fallback key (if client doesn't provide one).

## License

MIT
