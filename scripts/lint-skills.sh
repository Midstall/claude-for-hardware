#!/usr/bin/env sh
# Lints every skill markdown file against the shared house-style checks.
# Exits non-zero if any file has a violation. Run in CI and locally.
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
. "$here/skill-checks.sh"

fail=0
checked=0
for f in $(find "$root/skills" -name '*.md' | sort); do
  checked=$((checked + 1))
  out=$(check_skill_file "$f")
  rel=${f#"$root"/}
  if [ -n "$out" ]; then
    fail=$((fail + 1))
    echo "FAIL $rel"
    printf '%s\n' "$out" | sed 's/^/     - /'
  else
    echo "ok   $rel"
  fi
done

echo
echo "$((checked - fail))/$checked skill files clean"
[ "$fail" -eq 0 ] || exit 1
