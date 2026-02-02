
import OpenAI from "openai";
import { AnthropicRequest, AnthropicMessage } from "./types";
import { AnthropicToOpenAIConverter, SSEBuilder, ThinkTagParser, ContentType, extractThinkContent } from "./utils";

export class NvidiaNimProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL: string, model: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });
    this.model = model;
  }

  async complete(request: AnthropicRequest): Promise<any> {
    const body = this.buildRequestBody(request, false);
    
    try {
      const response = await this.client.chat.completions.create(body as any);
      return this.convertResponse(response, request);
    } catch (e: any) {
      console.error("NIM_ERROR", e);
      throw e;
    }
  }

  async streamResponse(request: AnthropicRequest): Promise<ReadableStream> {
    const messageId = `msg_${crypto.randomUUID()}`;
    const sse = new SSEBuilder(messageId, request.model);
    const body = this.buildRequestBody(request, true);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const push = async (event: string) => {
        await writer.write(encoder.encode(event));
    };

    // Background processing of the stream
    (async () => {
        try {
            // Push message start
            await push(sse.messageStart());

            const stream = await this.client.chat.completions.create({ ...body, stream: true } as any);
            
            const thinkParser = new ThinkTagParser();
            let finishReason: string | null = null;
            let usageInfo: any = null;

            for await (const chunk of (stream as unknown as AsyncIterable<any>)) {
                if ((chunk as any).usage) {
                    usageInfo = (chunk as any).usage;
                }
                
                if (chunk.choices && chunk.choices.length > 0) {
                    const choice = chunk.choices[0];
                    const delta = choice.delta;
                    
                    if (choice.finish_reason) {
                        finishReason = choice.finish_reason;
                    }

                    // Handle reasoning content (DeepSeek/R1 style)
                    const reasoning = (delta as any).reasoning_content;
                    if (reasoning) {
                        // Compatibility: Convert thinking to text for standard clients
                        for (const event of sse.ensureTextBlock()) await push(event);
                        await push(sse.emitTextDelta(reasoning));
                    }

                    // Handle text content
                    if (delta.content) {
                        for (const part of thinkParser.feed(delta.content)) {
                            if (part.type === ContentType.THINKING) {
                                // Compatibility: Convert parsed thinking to text
                                for (const event of sse.ensureTextBlock()) await push(event);
                                await push(sse.emitTextDelta(part.content));
                            } else {
                                // Simple text passthrough
                                for (const event of sse.ensureTextBlock()) await push(event);
                                await push(sse.emitTextDelta(part.content));
                            }
                        }
                    }

                    // Handle tool calls
                    if (delta.tool_calls) {
                        for (const event of sse.closeContentBlocks()) await push(event);
                        
                        for (const tc of delta.tool_calls) {
                            const index = tc.index;
                            
                            // Ensure tool block started
                            if (sse.blocks.toolIndices[index] === undefined) {
                                const toolId = tc.id || `tool_${crypto.randomUUID()}`;
                                const fnName = tc.function?.name || "tool_call";
                                // Update name registry
                                if (tc.function?.name) {
                                    sse.blocks.toolNames[index] = (sse.blocks.toolNames[index] || "") + tc.function.name;
                                }
                                await push(sse.startToolBlock(index, toolId, sse.blocks.toolNames[index] || fnName));
                            } else {
                                // Update name if present in later chunks (unlikely for OpenAI but possible)
                                if (tc.function?.name) {
                                     sse.blocks.toolNames[index] = (sse.blocks.toolNames[index] || "") + tc.function.name;
                                }
                            }

                            if (tc.function?.arguments) {
                                await push(sse.emitToolDelta(index, tc.function.arguments));
                            }
                        }
                    }
                }
            }

            // Flush parsers
            const remaining = thinkParser.flush();
            if (remaining) {
                 if (remaining.type === ContentType.THINKING) {
                    for (const event of sse.ensureTextBlock()) await push(event);
                    await push(sse.emitTextDelta(remaining.content));
                } else {
                    for (const event of sse.ensureTextBlock()) await push(event);
                    await push(sse.emitTextDelta(remaining.content));
                }
            }
            
            // Close blocks
            for (const event of sse.closeAllBlocks()) await push(event);

            // Output tokens estimation
            const outputTokens = usageInfo?.completion_tokens || sse.estimateOutputTokens(); 

            await push(sse.messageDelta(SSEBuilder.mapStopReason(finishReason), outputTokens || 0));
            await push(sse.messageStop());

        } catch (error: any) {
            console.error("Stream Error", error);
            // close blocks
            for (const event of sse.closeAllBlocks()) await push(event);
            for (const event of sse.emitError(String(error))) await push(event);
        } finally {
            await writer.close();
        }
    })();

    return readable;
  }

  private buildRequestBody(request: AnthropicRequest, stream: boolean): any {
    const messages = AnthropicToOpenAIConverter.convertMessages(request.messages);
    const system = AnthropicToOpenAIConverter.convertSystemPrompt(request.system);
    
    if (system) {
        messages.unshift(system);
    }

    const body: any = {
        model: this.model || request.model, // Allow override or use request model
        messages: messages,
        max_tokens: request.max_tokens,
        stream: stream
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.top_p !== undefined) body.top_p = request.top_p;
    if (request.tools) {
        body.tools = AnthropicToOpenAIConverter.convertTools(request.tools);
    }
    
    // Extra body handling (thinking, etc)
    if (request.thinking && request.thinking.enabled) {
        // R1 / NIM specific
         body.extra_body = {
            ...(request.extra_body || {}),
            thinking: { type: "enabled" }
         };
    }

    return body;
  }

  private convertResponse(response: any, originalRequest: AnthropicRequest): any {
      // Simplified conversion for non-streaming
      const choice = response.choices[0];
      const message = choice.message;
      const content: any[] = [];
      
      let reasoning = message.reasoning_content;
      
      if (reasoning) {
          content.push({ type: "thinking", thinking: reasoning });
      }
      
      if (message.content) {
          if (!reasoning) {
              const { thinking, remaining } = extractThinkContent(message.content);
              if (thinking) content.push({ type: "thinking", thinking: thinking });
              if (remaining) content.push({ type: "text", text: remaining });
          } else {
              content.push({ type: "text", text: message.content });
          }
      } else if (!message.tool_calls && content.length === 0) {
           content.push({ type: "text", text: " " });
      }

      const msg: any = {
          id: response.id,
          type: "message",
          role: "assistant",
          model: originalRequest.model,
          content: content,
          stop_reason: choice.finish_reason,
          usage: {
              input_tokens: response.usage?.prompt_tokens || 0,
              output_tokens: response.usage?.completion_tokens || 0
          }
      };
      return msg;
  }
}
