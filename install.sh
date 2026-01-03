#!/bin/bash
# Claude Code Skills & Agents Installer for DSLab
# Usage: ./install.sh

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
CLAUDE_DIR="$HOME/.claude"

echo "Installing Claude Code skills and agents..."

# Create directories if they don't exist
mkdir -p "$CLAUDE_DIR/skills"
mkdir -p "$CLAUDE_DIR/agents"

# Install skills (directories)
for skill_dir in "$SCRIPT_DIR/skills/"*/; do
    skill_name=$(basename "$skill_dir")
    target_dir="$CLAUDE_DIR/skills/$skill_name"

    # Remove existing if it's a symlink
    if [ -L "$target_dir" ]; then
        rm "$target_dir"
    fi

    # Create symlink
    ln -sf "$skill_dir" "$target_dir"
    echo "  Installed skill: $skill_name"
done

# Install agents (individual files)
for agent_file in "$SCRIPT_DIR/agents/"*.md; do
    agent_name=$(basename "$agent_file")
    target_file="$CLAUDE_DIR/agents/$agent_name"

    # Remove existing if it's a symlink
    if [ -L "$target_file" ]; then
        rm "$target_file"
    fi

    # Create symlink
    ln -sf "$agent_file" "$target_file"
    echo "  Installed agent: ${agent_name%.md}"
done

echo ""
echo "Installation complete!"
echo ""
echo "Skills installed:"
ls -1 "$CLAUDE_DIR/skills/" 2>/dev/null | sed 's/^/  - /'
echo ""
echo "Agents installed:"
ls -1 "$CLAUDE_DIR/agents/" 2>/dev/null | sed 's/.md$//' | sed 's/^/  - /'
echo ""
echo "To update, run: cd $SCRIPT_DIR && git pull"
