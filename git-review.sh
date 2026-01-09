#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-}"
shift || true

if [[ "$MODE" == "update" ]]; then
  FINAL_COMMIT="${1:-HEAD}"
  PREVIEW_COMMIT="${2:-}"

  FINAL_COMMIT=$(git rev-parse --short "$FINAL_COMMIT")

  if [[ -z "$PREVIEW_COMMIT" && -f .git/review-preview ]]; then
    PREVIEW_COMMIT=$(cat .git/review-preview)
  fi

  if [[ -z "$PREVIEW_COMMIT" ]]; then
    echo "❌ Missing preview commit. Provide it or run a review first."
    exit 1
  fi

  PREVIEW_COMMIT=$(git rev-parse --short "$PREVIEW_COMMIT")

  FILE=$(grep -l "Preview commit (staged): \`$PREVIEW_COMMIT\`" reviews/pre-commit-reviews/*.md 2>/dev/null | head -n 1 || true)

  if [[ -z "$FILE" ]]; then
    echo "❌ No review found for preview commit: $PREVIEW_COMMIT"
    exit 1
  fi

  FINAL_PARENT=$(git rev-parse --short "${FINAL_COMMIT}^")

  python - "$FILE" "$PREVIEW_COMMIT" "$FINAL_COMMIT" "$FINAL_PARENT" <<'PY'
import sys

path, preview, final, final_parent = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(path, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

preview_line = f"- Preview commit (staged): `{preview}`\n"
parent_prefix = "- Parent commit: `"
parent_line = None
final_prefix = "- Final commit: `"
final_line = f"- Final commit: `{final}`\n"

for line in lines:
    if line.startswith(parent_prefix):
        parent_line = line.strip()
        break

expected_parent_line = f"- Parent commit: `{final_parent}`"
if parent_line is None or parent_line != expected_parent_line:
    raise SystemExit(
        f"Parent mismatch. Review has {parent_line or 'no parent'}, expected {expected_parent_line}."
    )

out = []
for line in lines:
    if line.startswith(final_prefix):
        continue
    out.append(line)
    if line == preview_line:
        out.append(final_line)

with open(path, "w", encoding="utf-8") as fh:
    fh.writelines(out)
PY

  echo "✅ Review updated: $FILE"
  exit 0
fi

if [[ "$MODE" == "commit" ]]; then
  COMMIT_MSG="${1:-}"

  if [[ -z "$COMMIT_MSG" ]]; then
    echo "❌ Missing commit message."
    exit 1
  fi

  if git diff --cached --quiet; then
    echo "❌ No staged changes."
    exit 1
  fi

  "$0"
  git commit -m "$COMMIT_MSG"
  "$0" update HEAD
  exit 0
fi

if [[ -n "$MODE" ]]; then
  echo "❌ Unknown mode: $MODE"
  exit 1
fi
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')

echo "📄 Generating pre-commit review..."
mkdir -p reviews/pre-commit-reviews
ls -t reviews/pre-commit-reviews | tail -n +11 | while read f; do rm "reviews/pre-commit-reviews/$f"; done

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
PARENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
PREVIEW_COMMIT=""

if ! git diff --cached --quiet; then
  TREE_HASH=$(git write-tree)
  PREVIEW_COMMIT=$(printf "Pre-commit review\n\nBranch: %s\n" "$BRANCH" | git commit-tree "$TREE_HASH" -p HEAD)
  PREVIEW_COMMIT=$(git rev-parse --short "$PREVIEW_COMMIT")
  echo "$PREVIEW_COMMIT" > .git/review-preview
fi

day=$(date +"%d" | sed 's/^0*//')
case $day in
  1|21|31) suffix="st" ;;
  2|22)    suffix="nd" ;;
  3|23)    suffix="rd" ;;
  *)       suffix="th" ;;
esac

HUMAN_DATE="$(date +"%B") ${day}${suffix}, $(date +"%Y") at $(date +"%I:%M %p")"
FILE="reviews/pre-commit-reviews/${TIMESTAMP}-pre-commit-review.md"

ADDED=$(git --no-pager diff --cached --diff-filter=A)
DELETED=$(git --no-pager diff --cached --name-status --diff-filter=D)
MODIFIED=$(git --no-pager diff --cached --diff-filter=M)
RENAMED=$(git --no-pager diff --cached --name-status --diff-filter=R)

NONE_TEXT="_No files_"
[ -z "$ADDED" ] && ADDED="$NONE_TEXT"
[ -z "$DELETED" ] && DELETED="$NONE_TEXT"
[ -z "$MODIFIED" ] && MODIFIED="$NONE_TEXT"
[ -z "$RENAMED" ] && RENAMED="$NONE_TEXT"

{
  echo "# 📄 Pre-Commit Git Review — $HUMAN_DATE"
  echo ""
  echo "## 🔖 Context"
  echo ""
  echo "- Branch: \`$BRANCH\`"
  echo "- Parent commit: \`$PARENT_COMMIT\`"
  if [ -n "$PREVIEW_COMMIT" ]; then
    echo "- Preview commit (staged): \`$PREVIEW_COMMIT\`"
  else
    echo "- Preview commit (staged): _No staged changes_"
  fi
  echo ""
  echo "## ➕ Added files"
  echo ""
  echo '```bash'
  echo "$ADDED"
  echo '```'
  echo ""
  echo "## ➖ Deleted files"
  echo ""
  echo '```bash'
  echo "$DELETED"
  echo '```'
  echo ""
  echo "## ✏️ Modified files"
  echo ""
  echo '```bash'
  echo "$MODIFIED"
  echo '```'
  echo ""
  echo "## 🔀 Renamed / Moved files"
  echo ""
  echo '```bash'
  echo "$RENAMED"
  echo '```'
} > "$FILE"

echo "💾 Review saved to: $FILE"
echo ""
