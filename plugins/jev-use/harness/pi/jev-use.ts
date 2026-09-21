/**
 * pi extension (github.com/badlogic/pi-mono): pi has no MCP support, so
 * this registers jev_judge / jev_gate as native pi tools, importing the
 * dependency-free engine directly (no MCP round trip, no node_modules —
 * the judge path uses only Node built-ins).
 *
 * Like the MCP server, these tools return the engine's ordered result as
 * their payload, so they call the engine rather than the `Jev` client: the
 * client's `answers` map would duplicate every verdict in text the model
 * pays for.
 *
 * Install: `pi install git:github.com/shitianfang/jev-use`
 * or copy this file into ~/.pi/agent/extensions/.
 */

import { createBackend } from "../../src/backends/index.js";
import type { JevBackend } from "../../src/backends/types.js";
import { gate, judge } from "../../src/judge.js";
import {
  ESTIMATED_CONFIDENCE_THRESHOLD,
  REPORTED_CONFIDENCE_THRESHOLD,
  type Question,
} from "../../src/protocol.js";

// Structural slice of pi's ExtensionAPI — avoids a hard dependency on the
// pi package name from inside an extension file.
interface PiToolResult {
  content: { type: "text"; text: string }[];
  details: Record<string, unknown>;
}
interface PiExtensionAPI {
  registerTool(tool: {
    name: string;
    label: string;
    description: string;
    parameters: unknown;
    execute(
      toolCallId: string,
      params: Record<string, unknown>,
      signal?: unknown,
      onUpdate?: unknown,
      ctx?: unknown,
    ): Promise<PiToolResult>;
  }): void;
}

let resolved: JevBackend | undefined;

/** The backend, resolved from the environment on first use and kept. */
function backend(): JevBackend {
  resolved ??= createBackend().backend;
  return resolved;
}

/** Every pi tool result is the JSON of one jev-use result. */
function text(value: unknown): PiToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    details: {},
  };
}

/** No backend, no network: say so in the escalation vocabulary and move on. */
function failOpen(error: unknown): PiToolResult {
  return text({
    escalated: true,
    reason: "unreachable",
    hint: `Jev unavailable (${error instanceof Error ? error.message : String(error)}); handle this yourself.`,
  });
}

const questionSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Echoed back in the verdict." },
    type: {
      type: "string",
      enum: ["noul", "choice", "score"],
      description:
        "noul = probability true; choice = pick an enumerated option; score = ordered levels.",
    },
    question: { type: "string", description: "The question, about the state." },
    options: {
      type: "array",
      items: { type: "string" },
      description: "choice only: >= 2 distinct option labels.",
    },
    levels: {
      type: "array",
      items: { type: "string" },
      description: "score only: >= 2 ORDERED level descriptions; the answer indexes into them.",
    },
  },
  required: ["type", "question"],
} as const;

export default function (pi: PiExtensionAPI): void {
  pi.registerTool({
    name: "jev_judge",
    label: "Jev judge",
    description:
      "Batch quick judgment questions (noul/choice/score) about one state to Jev — " +
      "~100ms, calibrated probabilities. Batch everything about one state into one call. " +
      "Verdicts with escalate:true are handed back to you (reason: writing | " +
      "open_ended | oversized | unsure | unreachable).",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "The context/environment to judge against (< ~30k tokens).",
        },
        questions: { type: "array", items: questionSchema, minItems: 1 },
        confidence_threshold: {
          type: "number",
          description:
            `Escalate below this confidence. Unset: ${REPORTED_CONFIDENCE_THRESHOLD} for a ` +
            `confidence the model reported, ${ESTIMATED_CONFIDENCE_THRESHOLD} for one jev-use ` +
            "estimated from the answer's distribution (each verdict says which, in confidenceFrom).",
        },
      },
      required: ["state", "questions"],
    },
    async execute(_id, params) {
      try {
        const result = await judge(backend(), {
          state: String(params.state),
          questions: params.questions as Question[],
          confidenceThreshold: params.confidence_threshold as number | undefined,
        });
        return text(result);
      } catch (error) {
        return failOpen(error);
      }
    },
  });

  pi.registerTool({
    name: "jev_gate",
    label: "Jev gate",
    description:
      "Risk-check one proposed action against the current state in ~100ms. " +
      "Returns {decision: allow|deny|escalate, confidence, confidenceFrom, hint}.",
    parameters: {
      type: "object",
      properties: {
        state: { type: "string", description: "Current task context." },
        tool: { type: "string", description: "Tool/command about to run." },
        input: { type: "string", description: "The action's input, verbatim." },
        description: { type: "string", description: "What the action is meant to do." },
      },
      required: ["state", "tool", "input"],
    },
    async execute(_id, params) {
      try {
        const result = await gate(backend(), {
          state: String(params.state),
          action: {
            tool: String(params.tool),
            input: String(params.input),
            description: params.description as string | undefined,
          },
        });
        return text(result);
      } catch (error) {
        return failOpen(error);
      }
    },
  });
}
