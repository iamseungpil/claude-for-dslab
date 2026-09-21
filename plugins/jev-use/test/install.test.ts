import { describe, expect, it } from "vitest";
import { installPlan } from "../src/install.js";

describe("installPlan", () => {
  it("drives each harness's own config command, pinned to this version", () => {
    const plan = installPlan("9.9.9");
    expect(plan.map((s) => s.harness)).toEqual(["claude", "codex", "pi"]);

    const claude = plan[0];
    expect(claude.command).toBe("claude");
    expect(claude.args).toEqual([
      "mcp", "add", "--scope", "user", "jev", "--",
      "npx", "-y", "jev-use@9.9.9", "serve",
    ]);

    const codex = plan[1];
    expect(codex.args).toEqual(["mcp", "add", "jev", "--", "npx", "-y", "jev-use@9.9.9", "serve"]);

    const pi = plan[2];
    expect(pi.args).toEqual(["install", "git:github.com/shitianfang/jev-use"]);
  });
});
