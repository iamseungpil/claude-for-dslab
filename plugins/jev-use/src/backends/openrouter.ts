/**
 * OpenRouter backend. Jev is NOT on /v1/chat/completions there — it lives
 * on the alpha Decisions endpoint, which speaks the native dialect:
 * POST https://openrouter.ai/api/alpha/decisions, Bearer OPENROUTER_API_KEY.
 * (Alpha: OpenRouter may move this path.)
 */

import { parseNativeAnswers, toNativeBody } from "./native.js";
import { postJson, type HttpOptions } from "./http.js";
import type {
  BackendRequest,
  BackendResponse,
  JevBackend,
} from "./types.js";

export const OPENROUTER_BASE_URL = "https://openrouter.ai";
export const OPENROUTER_DEFAULT_MODEL = "typesafe/jev-latest";

/** How to reach OpenRouter's decisions endpoint. */
export interface OpenRouterOptions extends HttpOptions {
  apiKey: string;
  /** Override the API origin (proxy, test server). */
  baseUrl?: string;
  /** Model used when a call names none. Default "typesafe/jev-latest". */
  defaultModel?: string;
}

interface DecisionsResponse {
  model?: string;
  answers?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number; cost?: number };
}

export class OpenRouterBackend implements JevBackend {
  readonly name = "openrouter";

  constructor(private readonly options: OpenRouterOptions) {}

  async judge(request: BackendRequest): Promise<BackendResponse> {
    const model =
      request.model ?? this.options.defaultModel ?? OPENROUTER_DEFAULT_MODEL;
    const body = toNativeBody(request.state, request.questions, model);
    const started = Date.now();
    const response = (await postJson(
      this.name,
      `${this.options.baseUrl ?? OPENROUTER_BASE_URL}/api/alpha/decisions`,
      { Authorization: `Bearer ${this.options.apiKey}` },
      body,
      this.options,
    )) as DecisionsResponse;
    return {
      answers: parseNativeAnswers(this.name, response.answers, request.questions),
      model: response.model ?? model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  }
}
