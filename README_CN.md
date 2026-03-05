# Claude Code OpenAI Proxy

[English](README.md) | [中文](README_CN.md)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/doctoroyy/openai-to-claude-worker)

将**任意 OpenAI 兼容 API** 转换为 **Anthropic Messages API**，让你可以直接用 Claude Code (Anthropic CLI) 对接任何 OpenAI 兼容的后端服务。

只需在 Worker URL 后面拼接目标 API 的 Base URL，即可自动完成协议转换。

## 功能特性

- **通用代理**: 支持任意 OpenAI 兼容 API（NVIDIA NIM、OpenAI、DeepSeek、Kimi、本地 Ollama 等）。
- **零配置**: 只需拼接目标 API 域名，无需修改 Worker 代码。
- **无状态**: API Key 通过请求头传递，无需在服务端管理密钥。
- **流式支持**: 完整的 SSE 支持，实现实时响应。
- **思考标签**: 正确处理推理模型的 `<think>` 标签和 `reasoning_content` 字段。
- **工具调用**: 支持工具调用循环。

## 部署

### 一键部署

点击上方的 "Deploy to Cloudflare Workers" 按钮即可一键部署到你的 Cloudflare 账户。

### 手动部署

1. **克隆与安装**
   ```bash
   git clone https://github.com/doctoroyy/openai-to-claude-worker.git
   cd openai-to-claude-worker
   pnpm install
   ```

2. **部署**
   ```bash
   pnpm run deploy
   ```

   记下部署后的 URL，例如：`https://your-worker.workers.dev`。

## 使用方法

### 核心用法：拼接任意 API 域名

格式：`https://<worker域名>/<目标API的Base URL>`

```bash
# 使用 NVIDIA NIM
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://integrate.api.nvidia.com/v1
export ANTHROPIC_API_KEY=nvapi-your-key-here

# 使用 OpenAI
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://api.openai.com/v1
export ANTHROPIC_API_KEY=sk-your-openai-key

# 使用 DeepSeek
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://api.deepseek.com/v1
export ANTHROPIC_API_KEY=your-deepseek-key

# 使用本地 Ollama（需要公网可访问）
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/http://your-server:11434/v1
export ANTHROPIC_API_KEY=ollama

# 使用任意 OpenAI 兼容 API
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev/https://any-openai-compatible-api.com/v1
export ANTHROPIC_API_KEY=your-api-key

claude
```

### 工作原理

Claude Code 会向 `${ANTHROPIC_BASE_URL}/v1/messages` 发送请求。例如：

```
请求 URL: https://your-worker.workers.dev/https://api.openai.com/v1/v1/messages
                                       ↑ Worker 域名            ↑ 目标 Base URL  ↑ Claude Code 追加的路径
```

Worker 会：
1. 从 URL 中提取目标 API Base URL (`https://api.openai.com/v1`)
2. 将 Anthropic Messages 格式的请求体转换为 OpenAI Chat Completions 格式
3. 转发到 `https://api.openai.com/v1/chat/completions`
4. 将 OpenAI 格式的响应转换回 Anthropic Messages 格式

### 兼容模式（旧版）

不拼接域名，直接使用 `/v1/messages`，此时会使用环境变量中配置的 `DEFAULT_BASE_URL`：

```bash
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev
export ANTHROPIC_API_KEY=nvapi-your-key-here

claude
```

## 配置 (可选)

你可以在 `wrangler.toml` 或 Cloudflare Secrets 中设置这些默认值：

- `MODEL`: 强制覆盖请求中的模型名称（例如 `moonshotai/kimi-k2-thinking`）。不设置则透传客户端发送的模型名。
- `DEFAULT_BASE_URL`: 兼容模式下使用的默认 API Base URL。
- `DEFAULT_API_KEY`: 服务端回退密钥（如果客户端未提供）。

> 兼容旧版环境变量 `NVIDIA_NIM_BASE_URL` 和 `NVIDIA_NIM_API_KEY`。

## 许可证

MIT
