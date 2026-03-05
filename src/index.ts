
import { Hono } from "hono";
import { OpenAICompatProvider } from "./provider";
import { AnthropicRequest } from "./types";

type Bindings = {
  DEFAULT_API_KEY: string;
  DEFAULT_BASE_URL: string;
  MODEL: string;
  // Legacy support
  NVIDIA_NIM_API_KEY: string;
  NVIDIA_NIM_BASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.text("Universal OpenAI-to-Anthropic Proxy is running!\n\nUsage: Set ANTHROPIC_BASE_URL to https://<this-worker>/<target-api-base-url>\nExample: ANTHROPIC_BASE_URL=https://your-worker.dev/https://api.openai.com/v1"));

/**
 * Extract API key from request headers.
 * Supports: Authorization: Bearer <key>, x-api-key: <key>
 */
function extractApiKey(c: any, fallbackKey: string): string {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  const xApiKey = c.req.header("x-api-key");
  if (xApiKey) {
    return xApiKey;
  }
  return fallbackKey || "";
}

/**
 * Parse the request URL to extract the target base URL.
 *
 * Pattern: /<target-base-url>/v1/messages
 * Example: /https://api.openai.com/v1/v1/messages
 *   → targetBaseURL = "https://api.openai.com/v1"
 *
 * Also supports the legacy /v1/messages route (uses env DEFAULT_BASE_URL).
 */
function parseTargetBaseURL(pathname: string): { targetBaseURL: string | null; isLegacy: boolean } {
  // Legacy route: /v1/messages
  if (pathname === "/v1/messages") {
    return { targetBaseURL: null, isLegacy: true };
  }

  // Universal route: /<anything>/v1/messages
  // We need to find the last occurrence of "/v1/messages" and treat everything before it as target base URL
  const suffix = "/v1/messages";
  if (pathname.endsWith(suffix)) {
    let target = pathname.slice(1, pathname.length - suffix.length); // remove leading "/" and trailing "/v1/messages"
    // Handle cases where target might not have protocol
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = "https://" + target;
    }
    // Remove trailing slash if present
    target = target.replace(/\/+$/, "");
    return { targetBaseURL: target, isLegacy: false };
  }

  return { targetBaseURL: null, isLegacy: false };
}

/**
 * Handle the /v1/messages endpoint (both legacy and universal).
 */
async function handleMessages(c: any, targetBaseURL: string) {
  const fallbackKey = c.env.DEFAULT_API_KEY || c.env.NVIDIA_NIM_API_KEY || "";
  const apiKey = extractApiKey(c, fallbackKey);

  if (!apiKey) {
    return c.json({
      error: {
        type: "authentication_error",
        message: "Missing API Key. Provide via 'Authorization: Bearer <key>' or 'x-api-key' header.",
      },
    }, 401);
  }

  try {
    const body = await c.req.json<AnthropicRequest>();

    // Use env MODEL if set, otherwise pass through the request model
    const targetModel = c.env.MODEL || body.model;

    const provider = new OpenAICompatProvider(apiKey, targetBaseURL, targetModel);

    const isStream = (body as any).stream === true;

    if (isStream) {
      const stream = await provider.streamResponse(body, c.req.raw.signal);
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
        message: e.message || "Internal Server Error",
      },
    }, 500);
  }
}

// Legacy route: /v1/messages (uses DEFAULT_BASE_URL or NVIDIA_NIM_BASE_URL from env)
app.post("/v1/messages", async (c) => {
  const baseURL = c.env.DEFAULT_BASE_URL || c.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
  return handleMessages(c, baseURL);
});

// Universal route: /**/v1/messages
// Catches any path ending with /v1/messages
app.post("*", async (c) => {
  const url = new URL(c.req.url);
  const { targetBaseURL, isLegacy } = parseTargetBaseURL(url.pathname);

  if (isLegacy) {
    // Should have been handled by the route above, but just in case
    const baseURL = c.env.DEFAULT_BASE_URL || c.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
    return handleMessages(c, baseURL);
  }

  if (!targetBaseURL) {
    return c.json({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: `Invalid path. Expected: /<target-api-base-url>/v1/messages. Got: ${url.pathname}`,
      },
    }, 404);
  }

  return handleMessages(c, targetBaseURL);
});

export default app;
