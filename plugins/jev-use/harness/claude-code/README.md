# Claude Code

## MCP tools

```bash
npx -y jev-use install claude    # runs `claude mcp add` for you, pinned
```

## Plugin form: tools + routing skill

The repo root is a Claude Code plugin: installing it adds a skill teaching
the routing rules on top of the tools.

```bash
git clone https://github.com/shitianfang/jev-use && cd jev-use && npm install
claude --plugin-dir .
```

(`/plugin install jev-use` also works from a marketplace that lists it.)

Manual wiring, in any project's `.mcp.json`:

```json
{
  "mcpServers": {
    "jev": { "command": "npx", "args": ["-y", "jev-use@0.7.1", "serve"] }
  }
}
```

Set one backend credential in the environment: `TYPESAFE_API_KEY`,
`OPENROUTER_API_KEY`, or `AI_GATEWAY_API_KEY` (see the root README).

## Allow the two tools once

No permission mode auto-allows an MCP tool — `acceptEdits` covers file edits
only — so a jev call goes to "ask". Interactively you approve it once; in
headless `claude -p` there is nobody to ask, and the call comes back as
`Claude requested permissions to use mcp__jev__jev_judge, but you haven't
granted it yet` (measured on Claude Code 2.1.257: two `claude -p` runs
identical but for the rules below — refused without them, answered with them).

```json
{
  "permissions": {
    "allow": ["mcp__jev__jev_judge", "mcp__jev__jev_gate"]
  }
}
```

in `~/.claude/settings.json`, or a project's `.claude/settings.json`;
`"mcp__jev"` allows the whole server in one rule.
`--dangerously-skip-permissions` also gets a headless run through, but it
switches off every check, not these two.

`npx -y jev-use doctor` reports whether the rules are in place and prints that
snippet when they are not. Installing does NOT write them: pre-authorizing a
tool that sends your state to a third party is your decision, not the
installer's.

## Optional: zero-token PreToolUse gate

`jev-use hook gate` risk-checks every tool call through Jev *before* it
runs, without spending any Claude tokens. It only ever tightens: `deny` →
deny with a reason, unsure → ask, `allow` → stays silent so your normal
permission flow decides; if Jev is unreachable it fails open.

This is deliberately NOT enabled by installing the plugin. To turn it on,
merge [`gate.hooks.json`](./gate.hooks.json) into your `settings.json` (or
`.claude/settings.json` per project) — it is a settings fragment: just a
`"hooks"` key. The optional `"env"` line below is yours to add, or not.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
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

Tune with `JEV_GATE_THRESHOLD`: higher = more actions get routed to a
human/Claude for review. Unset, the threshold follows where the confidence came
from — `0.5` when Jev reported it, `0.4` when jev-use estimated it from the
answer's distribution — and `npx -y jev-use doctor` prints both in effect.

A hook event tells Jev only the cwd and the permission mode. Anything else that
changes the answer — what this checkout is, what is reachable from it — you say
in `JEV_GATE_STATE`, which is appended to every state the hook judges:

```json
{
  "env": {
    "JEV_GATE_STATE": "production credentials exist in the environment"
  }
}
```

Claude Code passes `env` through to hook processes (measured), so the same line
works exported in the shell your harness runs in. Unset, the hook sends exactly
what it sent before this existed.
