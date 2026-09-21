/**
 * End-to-end smoke: drives the BUILT dist/cli.js over real stdio with a
 * real MCP client — the exact process a harness will spawn. Run via
 * `npm run smoke` (which builds first). Uses the mock backend, no key.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(root, "dist/cli.js"), "serve", "--backend", "mock"],
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
assertEqual(JSON.stringify(names), JSON.stringify(["jev_gate", "jev_judge"]), "tool list");

const res = await client.callTool({
  name: "jev_judge",
  arguments: {
    state: "make test: 37 passed, 0 failed; typecheck clean",
    questions: [
      { id: "green", type: "noul", question: "Is the build green?" },
      { id: "next", type: "choice", question: "Next action?", options: ["ship", "debug"] },
      { id: "risk", type: "score", question: "Risk of shipping now?", levels: ["trivial", "moderate", "severe"] },
    ],
  },
});
const parsed = JSON.parse(res.content[0].text);
assertEqual(parsed.backend, "mock", "backend name");
assertEqual(parsed.verdicts.length, 3, "verdict count");
// The tool payload is the engine's ordered result and nothing else: the
// client's by-name `answers` map would duplicate every verdict here.
assertEqual(
  JSON.stringify(Object.keys(parsed).sort()),
  JSON.stringify(["backend", "escalated", "latencyMs", "model", "verdicts"]),
  "tool result keys",
);
for (const v of parsed.verdicts) {
  if (typeof v.confidence !== "number" || typeof v.escalate !== "boolean") {
    throw new Error(`malformed verdict: ${JSON.stringify(v)}`);
  }
}

const gateRes = await client.callTool({
  name: "jev_gate",
  arguments: { state: "smoke", tool: "Bash", input: "git status" },
});
const gateParsed = JSON.parse(gateRes.content[0].text);
if (!["allow", "deny", "escalate"].includes(gateParsed.decision)) {
  throw new Error(`malformed gate decision: ${JSON.stringify(gateParsed)}`);
}

await client.close();
console.log("smoke OK — stdio handshake, jev_judge x3 primitives, jev_gate");

function assertEqual(a, b, what) {
  if (a !== b) throw new Error(`smoke failed on ${what}: ${a} !== ${b}`);
}
