# OpenAI Codex CLI

## MCP tools

```bash
npx -y jev-use install codex    # runs `codex mcp add` for you, pinned
```

Equivalent by hand:

```bash
codex mcp add jev -- npx -y "jev-use@0.7.1" serve
```

or in `~/.codex/config.toml` (project-scoped: `.codex/config.toml`):

```toml
[mcp_servers.jev]
command = "npx"
args = ["-y", "jev-use@0.7.1", "serve"]
# pass your backend credential through to the server:
env_vars = ["TYPESAFE_API_KEY", "OPENROUTER_API_KEY", "AI_GATEWAY_API_KEY"]
```

Codex discovers `jev_judge` and `jev_gate` via the standard tools/list call.
Since Codex has no plugin skill mechanism, paste the routing table from
[`skills/jev-use/SKILL.md`](../../skills/jev-use/SKILL.md) into your
`AGENTS.md` so the model knows when to pass the baton.

## Optional: PreToolUse gate hook

Codex hooks are Claude-shaped, so the same adapter works. In
`~/.codex/hooks.json` (or `<repo>/.codex/hooks.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y jev-use@0.7.1 hook gate",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Codex requires you to review and trust non-managed hooks via `/hooks`
before they run.

The adapter reads the same two env vars here — `JEV_GATE_THRESHOLD` and
`JEV_GATE_STATE` (facts the hook event cannot carry, appended to every judged
state) — exported in the environment Codex runs in. See
[the Claude Code notes](../claude-code/README.md#optional-zero-token-pretooluse-gate).
