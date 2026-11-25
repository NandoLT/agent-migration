#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 || $1 != /* || ! $2 =~ ^[0-9a-f]{64}$ ]]; then
  printf 'Usage: bash %s /absolute/path/to/native-opencode sha256\n' "$0" >&2
  exit 2
fi
binary="$(realpath -e -- "$1")"
[[ "$binary" = "$1" && -f "$binary" && -x "$binary" ]]
test "$(head -c 4 -- "$binary")" = $'\177ELF'
actual_hash="$(sha256sum < "$binary")"
test "${actual_hash%% *}" = "$2"

fixture="$(realpath -- "$(dirname -- "$0")/../fixtures/opencode-v2-two-messages.json")"
lab="$(mktemp -d "${TMPDIR:-/tmp}/agent-migration-roundtrip.XXXXXXXX")"
trap 'rc=$?; if ((rc == 0)); then rm -rf -- "$lab"; else printf "Synthetic artifacts: %s\n" "$lab" >&2; fi' EXIT
mkdir -p "$lab"/{home,config,data,state,cache,runtime,tmp,project}

timeout --kill-after=5s 60s bwrap \
  --unshare-all --die-with-parent --new-session --clearenv --cap-drop ALL \
  --ro-bind /usr /usr --symlink usr/lib /lib --symlink usr/lib /lib64 --symlink usr/bin /bin \
  --proc /proc --dev /dev --tmpfs /tmp \
  --bind "$lab" /lab --ro-bind "$binary" /opencode --ro-bind "$fixture" /fixture.json \
  --setenv PATH /usr/bin --setenv LC_ALL C.UTF-8 --setenv HOME /lab/home \
  --setenv XDG_CONFIG_HOME /lab/config --setenv XDG_DATA_HOME /lab/data \
  --setenv XDG_STATE_HOME /lab/state --setenv XDG_CACHE_HOME /lab/cache \
  --setenv XDG_RUNTIME_DIR /lab/runtime --setenv TMPDIR /lab/tmp \
  --setenv OPENCODE_DB /lab/data/opencode-test.db --setenv GIT_CONFIG_NOSYSTEM 1 \
  --chdir /lab/project /usr/bin/bash -se <<'SANDBOX'
set -euo pipefail
umask 077

[[ ! -e /home && ! -e /run ]]
test "$(awk -F: 'NR > 2 { gsub(/[[:space:]]/, "", $1); print $1 }' /proc/net/dev)" = lo
test "$(/opencode --version)" = 'opencode v2.4.1'
test "$(/opencode debug paths db)" = "$OPENCODE_DB"
test ! -e "$OPENCODE_DB"
printf 'Isolation verified: no host home or runtime, loopback only, fresh DB at %s\n' "$OPENCODE_DB"

git init --quiet --initial-branch=main
GIT_AUTHOR_DATE=2026-01-01T00:00:00Z GIT_COMMITTER_DATE=2026-01-01T00:00:00Z \
  git -c user.name=Synthetic -c user.email=synthetic@example.invalid commit --quiet --allow-empty -m 'Synthetic project'
project_id="$(git rev-list --max-parents=0 HEAD)"
session_id="$(jq -er '.info.id' /fixture.json)"

/opencode session import /fixture.json --directory "$PWD" --standalone
test -s "$OPENCODE_DB"
/opencode session export "$session_id" --standalone > /lab/exported.json

project_projection='{
  id: .info.id, projectID: .info.projectID, directory: .info.location.directory,
  title: .info.title, created: .info.time.created,
  messages: [.messages[] | {id, type, time, text: (if .type == "user" then .text else [.content[] | select(.type == "text") | .text] end)}]
}'
jq -eS --arg project "$project_id" --arg directory "$PWD" \
  ".info.projectID = \$project | .info.location.directory = \$directory | $project_projection" \
  /fixture.json > /lab/expected.json
jq -eS "$project_projection" /lab/exported.json > /lab/actual.json
diff -u /lab/expected.json /lab/actual.json
test -z "$(git status --short)"
printf 'Round trip verified: %s messages; canonical projection SHA-256: ' "$(jq '.messages | length' /lab/actual.json)"
sha256sum < /lab/actual.json
jq -n --slurpfile input /fixture.json --slurpfile output /lab/exported.json \
  '{updated_input: $input[0].info.time.updated, updated_export: $output[0].info.time.updated}'
SANDBOX
