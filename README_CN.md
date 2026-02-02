# Claude Code NIM Worker

[English](README.md) | [中文](README_CN.md)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/doctoroyy/cc-nim-worker)

本项目允许你使用 **NVIDIA NIM** 模型（如 `moonshotai/kimi-k2-thinking`、`deepseek-r1` 等）作为 **Claude Code** (Anthropic CLI) 的后端。

它作为一个无状态的 Cloudflare Worker 运行。API Key 由客户端传递，这意味着你不需要在服务端管理密钥（尽管你也可以设置一个默认密钥）。

## 功能特性

- **无状态代理**: 通过请求头传递你的 NVIDIA NIM API Key。
- **流式支持**: 完整的 SSE 支持，实现实时响应。
- **思考标签**: 正确处理推理模型（如 Kimi k2, DeepSeek R1）的 `<think>` 标签，并将其转换为 Claude Code 可识别的格式。
- **工具调用**: 支持工具调用循环。

## 部署

### 一键部署

点击上方的 "Deploy to Cloudflare Workers" 按钮即可一键部署到你的 Cloudflare 账户。

### 手动部署

1. **克隆与安装**
   ```bash
   git clone https://github.com/doctoroyy/cc-nim-worker.git
   cd cc-nim-worker
   pnpm install
   ```

2. **部署**
   ```bash
   pnpm run deploy
   ```
   
   记下部署后的 URL，例如：`https://your-worker.workers.dev`。

## 使用方法

配置 Claude Code 使用你的 Worker URL。

由于 Claude Code CLI 默认期望与 Anthropic 通信，它会发送 `x-api-key`（Anthropic 密钥）。
我们的 Worker 支持接收 `Authorization: Bearer <NVIDIA_KEY>` 或 `x-api-key`。
如果你设置 `ANTHROPIC_API_KEY=nvapi-...`，`claude` CLI 会将其发送到 `x-api-key`头中。
**本 Worker 支持通过 `x-api-key` 头接收密钥！**

简单用法：

```bash
export ANTHROPIC_BASE_URL=https://your-worker.workers.dev
export ANTHROPIC_API_KEY=nvapi-your-key-here

claude
```

## 配置 (可选)

你可以在 `wrangler.toml` 或 Cloudflare Secrets 中设置这些默认值：

- `MODEL`: 默认使用的模型（例如 `moonshotai/kimi-k2-thinking`）。
- `NVIDIA_NIM_BASE_URL`: 如果你想指向其他的 NIM 兼容端点。
- `NVIDIA_NIM_API_KEY`: 服务端回退密钥（如果客户端未提供）。

## 许可证

MIT
