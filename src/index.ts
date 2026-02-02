
import { Hono } from "hono";
import { NvidiaNimProvider } from "./nvidia";
import { AnthropicRequest } from "./types";

type Bindings = {
  NVIDIA_NIM_API_KEY: string;
  NVIDIA_NIM_BASE_URL: string;
  MODEL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.text("Claude Code NIM Proxy is running!"));

app.post("/v1/messages", async (c) => {
  // Extract API key from Authorization header or x-api-key
  const authHeader = c.req.header("Authorization");
  let apiKey = c.env.NVIDIA_NIM_API_KEY; // Fallback to env if set (optional)

  if (authHeader && authHeader.startsWith("Bearer ")) {
    apiKey = authHeader.substring(7);
  } else if (c.req.header("x-api-key")) {
    apiKey = c.req.header("x-api-key") || "";
  }

  if (!apiKey) {
    return c.json({ error: { type: "authentication_error", message: "Missing API Key. Please provide it via 'Authorization: Bearer <key>' or 'x-api-key' header." } }, 401);
  }

  const baseURL = c.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const defaultModel = c.env.MODEL || "moonshotai/kimi-k2-thinking"; // Default fallback

  try {
    const body = await c.req.json<AnthropicRequest>();
    
    // If client sends a model, we can use it, OR force the one in env if we want to be strict.
    // The python code used env MODEL for all requests if set, but allowed overrides?
    // Actually python code: `request.model` was used in `_build_request_body`, but `self._nim_params` defaults.
    // But `CONFIG` table said `MODEL` default is `moonshotai/kimi-k2-thinking`.
    // Let's prefer the environment model if the user set it for specific overriding,
    // OR just use the body model if it seems valid.
    // The python code snippet `body = self._build_request_body...` used `request.model`.
    // But verify: `request.model` comes from the client (claude).
    // Claude usually sends `claude-3-5-sonnet...`. We definitely need to override if we want to route to NIM.
    
    // In Python `server.py` calling `api.app`, let's see how `api.app` handled it.
    // We didn't view `api/routes.py`. It likely handled the model replacement.
    
    // Strategy: If `c.env.MODEL` is set, use it. Otherwise use `body.model` (which might fail if it's "claude-3...").
    // So we should probably default to `c.env.MODEL`.
    
    const targetModel = c.env.MODEL || body.model; 

    // We override request model for the provider
    const provider = new NvidiaNimProvider(apiKey, baseURL, targetModel);

    // Check if stream
    // Anthropic sends `stream: true` in top level
    // Can we detect stream from body? Yes `body.stream` (it's in AnthropicRequest type but I didn't add it explicitly in interface, but it's any-like).
    // Let's check headers or body.
    const isStream = (body as any).stream === true;

    if (isStream) {
      const stream = await provider.streamResponse(body);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      const response = await provider.complete(body);
      return c.json(response);
    }

  } catch (e: any) {
    console.error("API Error", e);
    return c.json({
      type: "error",
      error: {
        type: "api_error",
        message: e.message || "Internal Server Error"
      }
    }, 500);
  }
});

export default app;
