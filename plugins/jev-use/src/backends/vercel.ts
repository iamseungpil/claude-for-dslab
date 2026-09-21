/**
 * Vercel AI Gateway backend. A genuinely different dialect:
 * POST https://ai-gateway.vercel.sh/v4/ai/evaluation-model with the model
 * in a HEADER (ai-model-id), `noul` renamed to `boolean` (answer field
 * `probability`), camelCase usage, no legend echo, and Jev's confidence head
 * relayed out-of-band in `providerMetadata.typesafe.confidence` — a map keyed
 * by question id that carries `choice` and `score` answers and omits `boolean`
 * ones, so a mixed batch comes back part reported, part estimated.
 * Wire shapes verified against @ai-sdk/gateway dist source and 283 live
 * responses (2026-09-19).
 */

import { optionEntries, type Question, type State } from "../protocol.js";
import { postJson, type HttpOptions } from "./http.js";
import {
  BackendError,
  type BackendRequest,
  type BackendResponse,
  type JevBackend,
  type RawAnswer,
} from "./types.js";

export const VERCEL_BASE_URL = "https://ai-gateway.vercel.sh";
export const VERCEL_DEFAULT_MODEL = "typesafe-ai/jev";

/** How to reach the Vercel AI Gateway. */
export interface VercelOptions extends HttpOptions {
  apiKey: string;
  /** Override the gateway origin (proxy, test server). */
  baseUrl?: string;
  /** Model used when a call names none. Default "typesafe-ai/jev". */
  defaultModel?: string;
}

type GatewayQuestion =
  | { type: "boolean"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

function toGatewayQuestion(question: Question): GatewayQuestion {
  switch (question.type) {
    case "noul":
      return {
        type: "boolean",
        instructions: question.question,
        ...(question.criteria ? { criteria: question.criteria } : {}),
      };
    case "choice":
      return {
        type: "choice",
        instructions: question.question,
        criteria: Object.fromEntries(
          optionEntries(question.options ?? []).map(([label, meaning]) => [
            label,
            meaning || label,
          ]),
        ),
      };
    case "score":
      return {
        type: "score",
        instructions: question.question,
        criteria: question.levels ?? [],
      };
  }
}

interface GatewayAnswer {
  type: string;
  probability?: number;
  choice?: string;
  score?: number;
  probabilities?: Record<string, number>;
}

interface GatewayResponse {
  answers?: Record<string, GatewayAnswer>;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Provider-namespaced extras; Jev's confidence head arrives here. */
  providerMetadata?: { typesafe?: { confidence?: Record<string, number> } };
}

export class VercelBackend implements JevBackend {
  readonly name = "vercel";

  constructor(private readonly options: VercelOptions) {}

  async judge(request: BackendRequest): Promise<BackendResponse> {
    const model = request.model ?? this.options.defaultModel ?? VERCEL_DEFAULT_MODEL;
    const body: { state: State; questions: Record<string, GatewayQuestion> } = {
      state: request.state,
      questions: Object.fromEntries(
        request.questions.map((question) => [question.id, toGatewayQuestion(question)]),
      ),
    };
    const started = Date.now();
    const response = (await postJson(
      this.name,
      `${this.options.baseUrl ?? VERCEL_BASE_URL}/v4/ai/evaluation-model`,
      {
        Authorization: `Bearer ${this.options.apiKey}`,
        "ai-gateway-protocol-version": "0.0.1",
        "ai-evaluation-model-specification-version": "4",
        "ai-model-id": model,
      },
      body,
      this.options,
    )) as GatewayResponse;

    const reported = response.providerMetadata?.typesafe?.confidence ?? {};
    /** Only a number counts as reported; a missing id means "estimate it". */
    const confidenceOf = (id: string): number | undefined =>
      typeof reported[id] === "number" ? reported[id] : undefined;

    const answers: RawAnswer[] = request.questions.map((question) => {
      const answer = response.answers?.[question.id];
      if (!answer) {
        throw new BackendError(
          this.name,
          `response missing answer for question "${question.id}"`,
        );
      }
      switch (question.type) {
        case "noul":
          if (typeof answer.probability !== "number") {
            throw new BackendError(
              this.name,
              `answer "${question.id}" has no probability`,
            );
          }
          // The confidence map omits boolean answers: nothing to read here.
          return { answer: answer.probability };
        case "choice":
          if (typeof answer.choice !== "string") {
            throw new BackendError(this.name, `answer "${question.id}" has no choice`);
          }
          return {
            answer: answer.choice,
            distribution: answer.probabilities,
            confidence: confidenceOf(question.id),
          };
        case "score":
          if (typeof answer.score !== "number") {
            throw new BackendError(this.name, `answer "${question.id}" has no score`);
          }
          return {
            answer: answer.score,
            distribution: answer.probabilities,
            confidence: confidenceOf(question.id),
          };
      }
    });

    return {
      answers,
      model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
      },
    };
  }
}
