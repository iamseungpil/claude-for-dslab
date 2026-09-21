/**
 * TypeSafe direct API — the primary backend.
 * POST https://api.typesafe.ai/v1/systemone, Bearer TYPESAFE_API_KEY.
 * Wire shapes verified against typesafe-ai/typesafe-sdk-js (2026-09).
 */

import { parseNativeAnswers, toNativeBody } from "./native.js";
import { postJson, type HttpOptions } from "./http.js";
import type {
  BackendRequest,
  BackendResponse,
  JevBackend,
} from "./types.js";

export const TYPESAFE_BASE_URL = "https://api.typesafe.ai";
export const TYPESAFE_DEFAULT_MODEL = "jev-latest";

/** How to reach the TypeSafe API. */
export interface TypeSafeOptions extends HttpOptions {
  apiKey: string;
  /** Override the API origin (self-hosted gateway, test server). */
  baseUrl?: string;
  /** Model used when a call names none. Default "jev-latest". */
  defaultModel?: string;
}

interface NativeResponse {
  model?: string;
  answers?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class TypeSafeBackend implements JevBackend {
  readonly name = "typesafe";

  constructor(private readonly options: TypeSafeOptions) {}

  async judge(request: BackendRequest): Promise<BackendResponse> {
    const model = request.model ?? this.options.defaultModel ?? TYPESAFE_DEFAULT_MODEL;
    const body = toNativeBody(request.state, request.questions, model);
    const started = Date.now();
    const response = (await postJson(
      this.name,
      `${this.options.baseUrl ?? TYPESAFE_BASE_URL}/v1/systemone`,
      { Authorization: `Bearer ${this.options.apiKey}` },
      body,
      this.options,
    )) as NativeResponse;
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
