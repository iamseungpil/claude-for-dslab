/**
 * Jev's native wire dialect, shared verbatim by the TypeSafe direct API
 * and OpenRouter's /api/alpha/decisions: questions are a map keyed by
 * answer name; choice options are label → description; score criteria is
 * an ordered list indexed from 0.
 */

import { optionEntries, type Question, type State } from "../protocol.js";
import { BackendError, type RawAnswer } from "./types.js";

/** One question in the native dialect. */
export type NativeWireQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

/** One request body in the native dialect. */
export interface NativeBody {
  model: string;
  state: State;
  questions: Record<string, NativeWireQuestion>;
}

/** Translate one question into the native dialect. */
export function toNativeQuestion(question: Question): NativeWireQuestion {
  switch (question.type) {
    case "noul":
      return {
        type: "noul",
        instructions: question.question,
        ...(question.criteria ? { criteria: question.criteria } : {}),
      };
    case "choice":
      return {
        type: "choice",
        instructions: question.question,
        // Label-only options get the label as its own description.
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

/** Build the whole request body: model, state, and the questions by id. */
export function toNativeBody(
  state: State,
  questions: (Question & { id: string })[],
  model: string,
): NativeBody {
  return {
    model,
    state,
    questions: Object.fromEntries(
      questions.map((question) => [question.id, toNativeQuestion(question)]),
    ),
  };
}

interface NativeAnswer {
  type: string;
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
  legend?: Record<string, string>;
}

/**
 * Read the provider's answer map back into raw answers, in question order.
 * Anything missing or mistyped is a `BackendError` — a silently dropped
 * answer would read as a low-confidence judgment.
 */
export function parseNativeAnswers(
  backend: string,
  answers: unknown,
  questions: (Question & { id: string })[],
): RawAnswer[] {
  if (!answers || typeof answers !== "object") {
    throw new BackendError(backend, "response has no answers object");
  }
  const byId = answers as Record<string, NativeAnswer>;
  return questions.map((question) => {
    const answer = byId[question.id];
    if (!answer) {
      throw new BackendError(
        backend,
        `response missing answer for question "${question.id}"`,
      );
    }
    switch (question.type) {
      case "noul":
        // No noul answer observed so far carries a confidence — Jev's head is
        // reported for choice/score only. Pass one through if it ever appears
        // rather than silently estimating over it.
        return {
          answer: numberOrThrow(backend, question.id, answer.noul),
          confidence: answer.confidence,
        };
      case "choice":
        return {
          answer: stringOrThrow(backend, question.id, answer.choice),
          confidence: answer.confidence,
          distribution: answer.probabilities,
        };
      case "score":
        return {
          answer: numberOrThrow(backend, question.id, answer.score),
          confidence: answer.confidence,
          distribution: answer.probabilities,
          legend: answer.legend,
        };
    }
  });
}

function numberOrThrow(backend: string, id: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BackendError(backend, `answer "${id}" has no numeric value`);
  }
  return value;
}

function stringOrThrow(backend: string, id: string, value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new BackendError(backend, `answer "${id}" has no choice value`);
  }
  return value;
}
