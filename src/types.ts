
export interface AnthropicMessage {
  role: string;
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: any;
  content?: any;
  tool_use_id?: string;
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string | ContentBlock[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: any[];
  thinking?: {
    enabled: boolean;
    budget_tokens: number;
    type: string;
  };
  extra_body?: any;
}

export interface OpenAIMessage {
  role: string;
  content: string | any[];
  tool_calls?: any[];
  name?: string;
  tool_call_id?: string;
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: any;
  };
}
