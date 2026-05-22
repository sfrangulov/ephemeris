#!/usr/bin/env bash
set -euo pipefail
OUT=/tmp/npmsit
mkdir -p "$OUT"

PKGS=(
  "n8n-nodes-docx-to-md"
  "n8n-nodes-url-to-md"
  "skill-graveyard"
  "@skill-graveyard/core"
  "npm-pets"
  "@sfrangulov/shared-memory-mcp"
)

FROM=$(date -v-91d +%Y-%m-%d)
TO=$(date -v-1d +%Y-%m-%d)
echo "range $FROM..$TO" >&2

: > "$OUT/raw.ndjson"

for p in "${PKGS[@]}"; do
  enc=${p//\//%2F}
  echo "== $p ==" >&2
  # downloads range (daily)
  dl=$(curl -s "https://api.npmjs.org/downloads/range/$FROM:$TO/$enc" || echo '{}')
  # npm metadata -> repo url + latest version
  meta=$(curl -s "https://registry.npmjs.org/$enc" || echo '{}')
  repo=$(echo "$meta" | jq -r '(.repository.url // .repository // "") | tostring' 2>/dev/null | sed -E 's#git\+##; s#\.git$##; s#git://#https://#; s#git@github.com:#https://github.com/#')
  latest=$(echo "$meta" | jq -r '."dist-tags".latest // ""' 2>/dev/null)
  pub=$(echo "$meta" | jq -r --arg v "$latest" '.time[$v] // .time.modified // ""' 2>/dev/null)
  # extract owner/repo
  slug=$(echo "$repo" | sed -nE 's#.*github.com[/:]([^/]+/[^/#]+).*#\1#p')
  stars=""; forks=""; created=""
  if [ -n "$slug" ]; then
    gj=$(gh api "repos/$slug" 2>/dev/null || echo '{}')
    stars=$(echo "$gj" | jq -r '.stargazers_count // ""')
    forks=$(echo "$gj" | jq -r '.forks_count // ""')
    created=$(echo "$gj" | jq -r '.created_at // ""')
  fi
  jq -nc --arg p "$p" --arg slug "$slug" --arg latest "$latest" --arg pub "$pub" \
         --arg stars "$stars" --arg forks "$forks" --arg created "$created" \
         --argjson dl "$dl" \
    '{pkg:$p, slug:$slug, latest:$latest, pub:$pub, stars:($stars|tonumber? // null), forks:($forks|tonumber? // null), created:$created, downloads:($dl.downloads // [])}' \
    >> "$OUT/raw.ndjson"
done

echo "--- summary ---" >&2
jq -rc '{pkg, slug, latest, stars, days:(.downloads|length), total:(.downloads|map(.downloads)|add)}' "$OUT/raw.ndjson" >&2
echo "wrote $OUT/raw.ndjson" >&2
