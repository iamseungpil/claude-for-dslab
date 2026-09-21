/**
 * Demo: a deterministic executor drives a small triage loop — it
 * enumerates candidate actions per work item, Jev picks one per step, and
 * only items that hit a handoff boundary (writing / open_ended / oversized /
 * unsure / unreachable) land in the LLM inbox.
 * High-confidence work never wakes the LLM at all.
 *
 * Run:  npm install && node examples/demo.mjs
 *
 * With no API key it uses the mock backend with SCRIPTED answers (labeled
 * below), so the demo shows the three handoff paths deterministically;
 * with a key, the verdicts come from Jev.
 */

import { Jev, MockBackend, pick, rate, route } from "../dist/index.js";

let live;
try {
  live = new Jev();
} catch {
  console.log("(no API key found — mock backend with scripted demo answers; set a key for live judgments)\n");
}

// A queue of incoming CI events. Each item carries the enumerable actions
// the executor knows how to perform on it — and, for the keyless demo, the
// scripted mock answers standing in for Jev.
const queue = [
  {
    id: "ci-142",
    state:
      "CI run #142 on branch fix/login: build ok, 214 tests passed, 0 failed, lint clean. " +
      "Branch is 2 commits ahead of main, no conflicts.",
    actions: {
      merge: "Merge the branch: everything is green and up to date.",
      rerun: "Re-run CI: results look flaky or incomplete.",
      hold: "Hold: something in the state needs human/LLM attention first.",
    },
    demoScript: {
      action: { answer: "merge", confidence: 0.95, distribution: { merge: 0.96, rerun: 0.03, hold: 0.01 } },
      sev: { answer: 0.1, confidence: 0.9, distribution: { 0: 0.9, 1: 0.1, 2: 0 } },
    },
  },
  {
    id: "ci-143",
    state:
      "CI run #143 on branch feat/payments: build ok, 198 passed, 1 FAILED " +
      "(test_refund_rounding: expected 10.00, got 9.99). First failure of this test in 30 runs.",
    actions: {
      merge: "Merge the branch: everything is green and up to date.",
      rerun: "Re-run CI: results look flaky or incomplete.",
      hold: "Hold: something in the state needs human/LLM attention first.",
    },
    // Genuinely ambiguous (flaky test vs real rounding bug): the scripted
    // distribution is flat, so the confidence threshold hands it back.
    demoScript: {
      action: { answer: "rerun", confidence: 0.14, distribution: { rerun: 0.48, hold: 0.42, merge: 0.1 } },
      sev: { answer: 1.2, confidence: 0.6, distribution: { 0: 0.1, 1: 0.6, 2: 0.3 } },
    },
  },
  {
    id: "ci-144",
    state:
      "CI run #144 on branch chore/deps: build FAILED — 'error TS2307: cannot find module @acme/core'. " +
      "A fix requires editing package.json and possibly the import sites.",
    // Writing a dependency fix is generation — no enumerable action covers it.
    producesContent: true,
  },
];

const llmInbox = [];

for (const item of queue) {
  // The deterministic router first: does this step belong to Jev at all?
  const step = route({
    producesContent: item.producesContent ?? false,
    enumerable: Boolean(item.actions),
  });
  if (step.to === "llm") {
    llmInbox.push({ item: item.id, reason: step.reason, state: item.state });
    console.log(`${item.id}: -> LLM (${step.reason})`);
    continue;
  }

  // Jev picks the next action; a flat distribution escalates automatically.
  const jev = live ?? new Jev({ backend: new MockBackend(item.demoScript) });
  const { answers } = await jev.judge(item.state, {
    action: pick("Which action should the executor take?", item.actions),
    sev: rate("How serious is the situation?", ["routine", "worth a look", "incident"]),
  });
  const { action, sev } = answers;

  if (action.escalate) {
    llmInbox.push({ item: item.id, reason: action.reason, prior: action.answer, state: item.state });
    console.log(`${item.id}: -> LLM (${action.reason}, prior=${action.answer ?? "none"})`);
  } else {
    const level = sev.legend?.[String(Math.round(Number(sev.answer)))] ?? sev.answer;
    console.log(
      `${item.id}: ${action.answer} (confidence ${action.confidence.toFixed(2)}, severity: ${level}) — no LLM tokens spent`,
    );
  }
}

console.log(`\nLLM inbox: ${llmInbox.length} item(s) actually need generation/reasoning:`);
for (const entry of llmInbox) {
  console.log(`  - ${entry.item}: ${entry.reason}${entry.prior ? ` (Jev's prior: ${entry.prior})` : ""}`);
}
