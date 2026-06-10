#!/usr/bin/env sh
# PostToolUse hook: when a skill markdown file is written or edited, enforce the
# house style (no em dashes, no emoji, valid SKILL.md frontmatter) at write time.
# Only acts on files under a skills/ directory, so it never blocks ordinary work
# in other repos. Exit 2 with feedback makes Claude fix the file. No node or jq.
dir=$(dirname "$0")
. "$dir/../scripts/skill-checks.sh"

payload=$(cat)
file=$(printf '%s' "$payload" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')

[ -n "$file" ] || exit 0
is_skill_markdown "$file" || exit 0

out=$(check_skill_file "$file")
if [ -n "$out" ]; then
  echo "House-style violations in $file:" >&2
  printf '%s\n' "$out" | sed 's/^/  - /' >&2
  echo 'Fix these before continuing: no em dashes or emoji, and a SKILL.md needs a name matching its directory plus a "Use when" description under 500 chars.' >&2
  exit 2
fi
exit 0
