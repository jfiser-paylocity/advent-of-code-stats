#!/usr/bin/env sh
# Runs checks, uploads env vars from .env, deploys, then creates/updates triggers.
# Usage: scripts/deploy.sh [--skip-tests] [--skip-env] [--skip-triggers]
# Required: SLACK_APP=<app id> (see `slack-cli app list`), so the CLI never prompts.
# Override CLI binary with SLACK_CLI (default: slack-cli, falls back to slack).
set -eu

cd "$(dirname "$0")/.."

SKIP_TESTS=0
SKIP_ENV=0
SKIP_TRIGGERS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-env) SKIP_ENV=1 ;;
    --skip-triggers) SKIP_TRIGGERS=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ -z "${SLACK_CLI:-}" ]; then
  if command -v slack-cli >/dev/null 2>&1; then SLACK_CLI=slack-cli
  elif command -v slack >/dev/null 2>&1; then SLACK_CLI=slack
  else echo "Slack CLI not found. Install it or set SLACK_CLI." >&2; exit 1
  fi
fi

[ -n "${SLACK_APP:-}" ] || { echo "Set SLACK_APP to the target app ID, e.g. SLACK_APP=A065Y567PRR scripts/deploy.sh" >&2; exit 1; }

command -v deno >/dev/null 2>&1 || { echo "deno not found. Run scripts/install-deno.sh" >&2; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  echo "Warning: working tree has uncommitted changes." >&2
fi

if [ "$SKIP_TESTS" -eq 0 ]; then
  echo "==> Running checks"
  deno task test
fi

# Upload every KEY=VALUE line of .env as a remote env var.
upload_env() {
  [ -f .env ] || { echo ".env not found" >&2; exit 1; }
  echo "==> Uploading env vars from .env"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    key=${line%%=*}
    value=${line#*=}
    key=$(printf '%s' "$key" | sed 's/^export[[:space:]]*//; s/[[:space:]]*$//')
    # strip one pair of surrounding quotes
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    [ -n "$key" ] || continue
    echo "  $key"
    "$SLACK_CLI" env add --app "$SLACK_APP" "$key" "$value"
  done < .env
}

# Find ID of an existing trigger by name in `trigger list` output ("" if none).
# Assumes each trigger block prints its ID before its name.
trigger_id_by_name() {
  list=$("$SLACK_CLI" trigger list --app "$SLACK_APP") || {
    echo "trigger list failed; aborting to avoid duplicate triggers" >&2; exit 1
  }
  printf '%s\n' "$list" | awk -v name="$1" '
    match($0, /Ft[A-Z0-9]+/) { id = substr($0, RSTART, RLENGTH) }
    index($0, name) && id { print id; exit }
  '
}

# Create trigger from def file, or update it if one with the same name exists.
sync_trigger() {
  def=$1
  name=$2
  id=$(trigger_id_by_name "$name")
  if [ -n "$id" ]; then
    echo "  updating '$name' ($id)"
    "$SLACK_CLI" trigger update --app "$SLACK_APP" --trigger-id "$id" --trigger-def "$def"
  else
    echo "  creating '$name'"
    "$SLACK_CLI" trigger create --app "$SLACK_APP" --trigger-def "$def"
  fi
}

# Env first so the deployed app has its vars at first run.
[ "$SKIP_ENV" -eq 1 ] || upload_env

echo "==> Deploying with $SLACK_CLI"
"$SLACK_CLI" deploy --app "$SLACK_APP"

if [ "$SKIP_TRIGGERS" -eq 0 ]; then
  echo "==> Syncing triggers"
  sync_trigger triggers/daily_star_progress.ts "Daily star progress trigger"
  sync_trigger triggers/star_progress_link.ts "Star progress link trigger"
fi
