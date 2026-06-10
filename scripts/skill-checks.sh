#!/usr/bin/env sh
# Shared house-style checks for skill markdown. Source this file, then call
# check_skill_file <path>, which prints one violation per line to stdout (no
# output means clean). Used by both the write-time hook and the CI linter so the
# rules live in exactly one place. Pure POSIX shell; no node or jq required.

is_skill_markdown() {
  case "$1" in
    */skills/*.md) return 0 ;;
    *) return 1 ;;
  esac
}

check_skill_file() {
  _file="$1"
  [ -f "$_file" ] || return 0

  # em dash: the firm house rule
  grep -n '—' "$_file" 2>/dev/null | while IFS=: read -r _ln _; do
    echo "line $_ln: em dash not allowed, rephrase"
  done

  # emoji, only if this grep understands perl regex (GNU grep / ugrep -P) in a
  # UTF-8 locale. Degrades to skipping the emoji check, never a false failure.
  if printf 'x' | grep -qP 'x' 2>/dev/null; then
    grep -nP '[\x{1F000}-\x{1FAFF}\x{2190}-\x{21FF}\x{FE0F}]' "$_file" 2>/dev/null | while IFS=: read -r _ln _; do
      echo "line $_ln: emoji not allowed"
    done
  fi

  case "$(basename "$_file")" in
    SKILL.md)
      _fm=$(awk 'NR==1 && $0=="---"{f=1;next} f && $0=="---"{exit} f{print}' "$_file")
      _name=$(printf '%s\n' "$_fm" | sed -n 's/^name:[[:space:]]*//p' | head -1)
      _desc=$(printf '%s\n' "$_fm" | sed -n 's/^description:[[:space:]]*//p' | head -1)
      _dir=$(basename "$(dirname "$_file")")
      [ -z "$_fm" ] && echo "missing YAML frontmatter"
      [ -n "$_fm" ] && [ -z "$_name" ] && echo "frontmatter missing name"
      [ -n "$_fm" ] && [ -z "$_desc" ] && echo "frontmatter missing description"
      [ -n "$_name" ] && [ "$_name" != "$_dir" ] && echo "name \"$_name\" does not match directory \"$_dir\""
      if [ -n "$_desc" ]; then
        _len=$(printf '%s' "$_desc" | wc -c | tr -d ' ')
        [ "$_len" -gt 500 ] && echo "description is $_len chars, keep under 500"
        case "$_desc" in
          "Use when"*) : ;;
          *) echo 'description should start with "Use when"' ;;
        esac
      fi
      ;;
  esac
}
