#!/usr/bin/env bash
# Regenerate src/lib/supabase/types.ts from the live schema.
#
# Run this after every migration. Until 14 Sep 2026 the generated file was
# edited by hand after a schema change, which works but only because the
# build catches a mistake -- this is the real thing.
#
# Needs a Supabase personal access token, which is a credential and so is
# never stored in the repo. Put it in .env.local (already gitignored):
#
#   SUPABASE_ACCESS_TOKEN=sbp_...
#
# Create one at https://supabase.com/dashboard/account/tokens
#
# A token alone is enough. `supabase link` is NOT required and additionally
# wants the database password, so this deliberately uses --project-id.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="hekwdwkocrkcexjorlfv"   # Frankfurt production
OUT="src/lib/supabase/types.ts"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -f .env.local ]; then
  # shellcheck disable=SC2046
  export SUPABASE_ACCESS_TOKEN="$(grep -E '^SUPABASE_ACCESS_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "No SUPABASE_ACCESS_TOKEN." >&2
  echo "Add this line to .env.local, then run again:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_..." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

TMP="$(mktemp)"
npx supabase gen types typescript --project-id "$PROJECT_REF" > "$TMP"

# A failed call can still exit 0 and leave an error blob, which would wipe the
# file. Only replace it if what came back really is the types module.
if ! grep -q "export type Database" "$TMP"; then
  echo "That did not look like a types file -- leaving $OUT alone. Response:" >&2
  head -3 "$TMP" >&2
  rm -f "$TMP"
  exit 1
fi

BEFORE=$(wc -l < "$OUT")
mv "$TMP" "$OUT"
AFTER=$(wc -l < "$OUT")
echo "Regenerated $OUT: $BEFORE -> $AFTER lines."
echo "Now run: npx tsc --noEmit"
