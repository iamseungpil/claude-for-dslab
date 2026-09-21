import { describe, expect, it } from "vitest";
import {
  certainty,
  escalateIfUnsure,
  margin,
  route,
  screenQuestions,
  whyUnaskable,
} from "../src/dispatch.js";
import type { Question, Verdict } from "../src/protocol.js";

const state = "test suite output: 3 passed, 0 failed";

describe("screenQuestions", () => {
  it("passes well-typed questions through with resolved ids", () => {
    const questions: Question[] = [
      { type: "noul", question: "Did the tests pass?" },
      { type: "choice", question: "Next step?", options: ["commit", "debug"] },
      {
        type: "score",
        question: "Code quality?",
        levels: ["broken", "rough", "solid"],
      },
    ];
    const res = screenQuestions(state, questions);
    expect(res.sendable).toHaveLength(3);
    expect(res.handedBack).toHaveLength(0);
    expect(res.sendable.map((s) => s.question.id)).toEqual(["q0", "q1", "q2"]);
  });

  it("accepts choice options as a label -> meaning map", () => {
    const res = screenQuestions(state, [
      {
        type: "choice",
        question: "Route?",
        options: { jev: "fast judgment", llm: "needs generation" },
      },
    ]);
    expect(res.sendable).toHaveLength(1);
  });

  it("hands back a choice without options as open_ended", () => {
    const res = screenQuestions(state, [
      { type: "choice", question: "What should the commit message be?" },
    ]);
    expect(res.sendable).toHaveLength(0);
    expect(res.handedBack[0].verdict.escalate).toBe(true);
    expect(res.handedBack[0].verdict.reason).toBe("open_ended");
  });

  it("hands back a score without ordered levels", () => {
    const res = screenQuestions(state, [
      { type: "score", question: "How many?", levels: ["only one"] },
    ]);
    expect(res.handedBack[0].verdict.reason).toBe("open_ended");
  });

  it("hands back duplicate question ids", () => {
    const res = screenQuestions(state, [
      { id: "x", type: "noul", question: "a?" },
      { id: "x", type: "noul", question: "b?" },
    ]);
    expect(res.sendable).toHaveLength(1);
    expect(res.handedBack[0].verdict.hint).toContain("Duplicate");
  });

  it("hands back partial noul criteria", () => {
    const res = screenQuestions(state, [
      {
        type: "noul",
        question: "ok?",
        criteria: { true: "it works", false: " " },
      },
    ]);
    expect(res.handedBack[0].verdict.reason).toBe("open_ended");
  });

  it("hands back the whole batch when the state is oversized", () => {
    const huge = "x".repeat(200_000); // ~50k tokens > 30k default
    const res = screenQuestions(huge, [
      { type: "noul", question: "ok?" },
      { type: "choice", question: "pick", options: ["a", "b"] },
    ]);
    expect(res.oversized).toBe(true);
    expect(res.handedBack).toHaveLength(2);
    for (const r of res.handedBack) {
      expect(r.verdict.reason).toBe("oversized");
    }
  });

  it("keeps original indices for mixed batches", () => {
    const res = screenQuestions(state, [
      { type: "choice", question: "no options" },
      { type: "noul", question: "fine" },
    ]);
    expect(res.handedBack[0].index).toBe(0);
    expect(res.sendable[0].index).toBe(1);
  });
});

describe("whyUnaskable", () => {
  it("flags empty question text", () => {
    expect(whyUnaskable({ type: "noul", question: "  " })).toBeTruthy();
  });
  it("flags duplicate choice options", () => {
    expect(
      whyUnaskable({
        type: "choice",
        question: "pick",
        options: ["a", "a"],
      }),
    ).toBeTruthy();
  });
});

describe("escalateIfUnsure", () => {
  const confident: Verdict = {
    id: "q",
    type: "noul",
    answer: 0.97,
    confidence: 0.94,
    escalate: false,
  };

  it("keeps confident verdicts", () => {
    expect(escalateIfUnsure(confident, 0.75).escalate).toBe(false);
  });

  it("escalates low-confidence verdicts with the answer kept as a prior", () => {
    const v = escalateIfUnsure({ ...confident, answer: 0.55, confidence: 0.1 }, 0.75);
    expect(v.escalate).toBe(true);
    expect(v.reason).toBe("unsure");
    expect(v.answer).toBe(0.55); // the prior survives the escalation
    expect(v.hint).toContain("prior");
  });
});

describe("confidence math", () => {
  it("noul certainty is 0 at a coin flip, 1 at the extremes", () => {
    expect(certainty(0.5)).toBe(0);
    expect(certainty(0)).toBe(1);
    expect(certainty(1)).toBe(1);
    expect(certainty(0.75)).toBeCloseTo(0.5);
  });

  it("choice margin is winner minus runner-up", () => {
    expect(margin({ a: 0.7, b: 0.2, c: 0.1 })).toBeCloseTo(0.5);
    expect(margin({ a: 0.5, b: 0.5 })).toBeCloseTo(0);
  });
});

describe("route", () => {
  it("routes generation to the LLM", () => {
    expect(route({ producesContent: true, enumerable: true })).toEqual({
      to: "llm",
      reason: "writing",
    });
  });
  it("routes non-enumerable judgment to the LLM", () => {
    expect(route({ producesContent: false, enumerable: false })).toEqual({
      to: "llm",
      reason: "open_ended",
    });
  });
  it("routes enumerable judgment to Jev", () => {
    expect(route({ producesContent: false, enumerable: true })).toEqual({
      to: "jev",
    });
  });
});
