/**
 * Example: why a TYPED answer beats a free-text one.
 *
 * One frozen state — the 25 in-content links Wikipedia's "Coffee" article
 * actually offers (captured by bench/examples/browse.mjs, hardcoded here so the
 * comparison is identical on every run) — and one question: which link leads
 * toward "Ethiopia"? "Ethiopia" is itself in the list, so a correct in-set
 * answer exists and is unambiguous.
 *
 * The same question goes to four models:
 *   1. Jev, as a typed `choice` question. The answer is an ELEMENT OF THE SET
 *      by construction: Jev scores the 25 options and returns one of them, so
 *      "off-list", "wrapped in prose" and "truncated" are not failure modes
 *      that exist. The caller can index straight into its own array.
 *   2-4. Three text models over the Vercel AI Gateway's OpenAI-compatible
 *      chat-completions endpoint, same key, normal settings, asked in plain
 *      English for exactly one option. Whatever comes back is a string, and
 *      the caller has to parse it.
 *
 * Every raw response is printed verbatim (escaped, one line) before it is
 * validated, so the validation cannot flatter Jev by hiding what was returned.
 *
 * Environment:
 *   AI_GATEWAY_API_KEY  the Vercel AI Gateway key — used for BOTH the Jev
 *                       backend and the three text models
 *
 * Run:    node bench/examples/inset.mjs [--cast out.cast]
 * Render: agg out.cast inset.gif
 */

import { writeFileSync } from "node:fs";
import { Jev, pick } from "../../dist/index.js";

const castIdx = process.argv.indexOf("--cast");
const castPath = castIdx > -1 ? process.argv[castIdx + 1] : null;

const TARGET = "Ethiopia";

/**
 * The frozen state: 25 in-content link texts from en.wikipedia.org/wiki/Coffee,
 * in the order the page renders them, as extracted by browse.mjs's reader.
 * "Ethiopia" is among them, so exactly one option is unambiguously correct.
 */
const LINKS = [
  "Latte", "Yemen", "Coffee bean", "Mug", "Coffee brew", "Bitterness",
  "Stimulant", "Caffeine", "Decaffeinated", "Coffee substitute", "Coffea",
  "Coffee roasting", "Iced coffee", "Coffee preparation", "List of coffee drinks",
  "Espresso", "French press", "Canned coffee", "History of coffee", "Red Sea",
  "Sufi", "South Arabia", "Java", "Americas", "Ethiopia",
];

const QUESTION = `Which link most directly leads toward the article '${TARGET}'?`;
const STATE =
  `Wikipedia article open in the browser: "Coffee"\nTarget article: "${TARGET}"\n` +
  `The article offers these ${LINKS.length} in-content links.`;

const TEXT_MODELS = [
  "anthropic/claude-haiku-4.5",
  "google/gemini-3-flash",
  "openai/gpt-5-nano",
];
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MAX_TOKENS = 1000;

const jev = new Jev();

const t0 = performance.now();
const events = [];
const say = (line = "") => {
  process.stdout.write(line + "\n");
  events.push([(performance.now() - t0) / 1000, "o", line + "\r\n"]);
};

const [B, D, G, Y, R, C, X] = ["1m", "2m", "32m", "33m", "31m", "36m", "0m"]
  .map((c) => `\x1b[${c}`);

/** One line, escaped, so a multi-line or empty answer cannot hide in the output. */
const oneLine = (s, max = 58) => {
  const e = JSON.stringify(s ?? "").slice(1, -1);
  return e.length > max ? e.slice(0, max - 1) + "…" : e;
};

/**
 * Validate a free-text answer against the option set. Four ways to miss:
 * empty, truncated, off-list, or a real option buried in prose/punctuation
 * that the caller would have to unwrap before it can index an array.
 */
const validate = (text, finish) => {
  const raw = text ?? "";
  // Order matters: a reasoning model that spends the whole budget thinking
  // returns "" with finish_reason=length. That is truncation, not emptiness.
  if (finish === "length") {
    return { mark: `${R}✗ truncated${X}`, key: "truncated", ok: false };
  }
  if (!raw.trim()) {
    return { mark: `${R}✗ empty${X}`, key: "empty", ok: false };
  }
  const trimmed = raw.trim();
  if (LINKS.includes(trimmed)) {
    return { mark: `${G}✓ in-set${X}`, key: "in-set", ok: true };
  }
  // Unwrapping the caller would have to write: first line, strip markdown,
  // quotes, a leading "Answer:", and trailing punctuation.
  const unwrapped = trimmed
    .split("\n")[0]
    .replace(/^\s*(the\s+)?(answer|link|option)\s*(is)?\s*[:\-]\s*/i, "")
    .replace(/^[\s*_`"'“‘\[]+|[\s*_`"'”’\].,;!?]+$/g, "")
    .trim();
  if (LINKS.includes(unwrapped)) {
    return { mark: `${Y}⚠ needs unwrapping${X}`, key: "needs unwrapping", ok: false };
  }
  return { mark: `${R}✗ off-list${X}`, key: "off-list", ok: false };
};

const askText = async (model) => {
  const prompt =
    `${STATE}\n\nThe links are:\n${LINKS.map((l) => `- ${l}`).join("\n")}\n\n` +
    `${QUESTION}\nReply with exactly one of the options above and nothing else.`;
  const started = Date.now();
  try {
    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const ms = Date.now() - started;
    if (!r.ok) {
      return { model, ms, raw: `HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`, finish: "http_error" };
    }
    const j = await r.json();
    const choice = j.choices?.[0];
    return {
      model,
      ms,
      raw: choice?.message?.content ?? "",
      finish: choice?.finish_reason,
      inTok: j.usage?.prompt_tokens,
      outTok: j.usage?.completion_tokens,
      reasonTok: j.usage?.completion_tokens_details?.reasoning_tokens,
    };
  } catch (err) {
    return { model, ms: Date.now() - started, raw: `request failed: ${err}`, finish: "error" };
  }
};

say(`${B}jev-use: typed vs free-text${X} ${D}· one 25-option question, 4 models${X}`);
say(`${D}state: Coffee article links (frozen) · "${TARGET}" is option ${LINKS.indexOf(TARGET) + 1}/25${X}`);
say();

// ---- 1. Jev: a typed choice question ---------------------------------------
const typed = await jev.judge(STATE, {
  click: pick(QUESTION, Object.fromEntries(LINKS.map((l) => [l, `opens the article "${l}"`]))),
});
const jv = typed.answers.click;
const jevAnswer = jv.answer === null ? "" : String(jv.answer);
const jevInSet = LINKS.includes(jevAnswer);
const jevRight = jevAnswer === TARGET;

say(`${B}jev${X} ${D}(${jev.backend.name}, typed choice)${X}`);
say(`  ${C}${String(typed.latencyMs).padStart(5)}ms${X} raw ${D}"${oneLine(jevAnswer)}"${X}`);
say(
  `  ${jevInSet ? `${G}✓ in-set${X}` : `${R}✗ off-list${X}`}` +
    `  conf ${jv.confidence.toFixed(2)}${jv.escalate ? ` ${Y}escalate${X}` : ""}` +
    `  ${D}${typed.usage?.inputTokens ?? "?"}/${typed.usage?.outputTokens ?? "?"} tok${X}`,
);
if (jevInSet) say(`  ${D}in-set by construction: a choice answer IS one of the options${X}`);
say();

// ---- 2. Three text models over the same gateway ----------------------------
const textResults = [];
for (const m of TEXT_MODELS) {
  const r = await askText(m);
  const v = validate(r.raw, r.finish);
  textResults.push({ ...r, ...v, correct: v.ok && r.raw.trim() === TARGET });
  const tok =
    r.inTok === undefined
      ? "no usage reported"
      : `${r.inTok}/${r.outTok} tok${r.reasonTok ? ` (${r.reasonTok} reasoning)` : ""}`;
  say(`${B}${m}${X}`);
  say(`  ${C}${String(r.ms).padStart(5)}ms${X} raw ${D}"${oneLine(r.raw)}"${X}`);
  say(`  ${v.mark}  ${D}finish=${r.finish ?? "?"}  ${tok}${X}`);
}

const wall = ((performance.now() - t0) / 1000).toFixed(1);
const clean = textResults.filter((r) => r.ok).length;
say();
say(
  `${B}jev: ${jevInSet ? "in-set" : "off-list"}, ${jevRight ? "correct" : `answered "${jevAnswer}"`}` +
    `, no parsing${X} ${D}· ${typed.latencyMs}ms${X}`,
);
say(
  `${B}text: ${clean}/${TEXT_MODELS.length} usable as-is${X} ` +
    `${D}· ${textResults.map((r) => r.key).join(", ")} · wall ${wall}s${X}`,
);
say(`${D}verbatim, no retries, no repair · all four on one key${X}`);
say(`${D}text budget max_tokens=${MAX_TOKENS}, reasoning tokens billed against it${X}`);
if (textResults.some((r) => r.key === "truncated")) {
  say(`${D}truncated = budget spent reasoning before any content token; a bigger${X}`);
  say(`${D}budget fixes it. A typed choice has no budget to get right.${X}`);
}

if (castPath) {
  writeFileSync(
    castPath,
    [
      JSON.stringify({ version: 2, width: 80, height: 26, title: "jev-use typed vs free-text" }),
      ...events.map((e) => JSON.stringify(e)),
    ].join("\n") + "\n",
  );
  console.error(`cast written: ${castPath} (${jev.via})`);
}

// Exactly one markdown row, last line on stdout (wider than the 80-col cast).
const summary = textResults
  .map((r) => `${r.model.split("/")[1]} ${r.ms}ms ${r.key}`)
  .join(", ");
console.log(
  `| One 25-option question, 4 models | jev ${typed.latencyMs}ms in-set vs ${summary} |`,
);
