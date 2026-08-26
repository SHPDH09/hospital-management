#!/usr/bin/env bash
# Cloud Agent start phase for the Healthcare Platform.
# Runs on every boot: brings up PostgreSQL and waits until it is ready, then
# returns. The dev servers themselves run in the "dev" terminal (see
# .cursor/environment.json) so their logs stay visible to the agent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1)"
if [ -z "${PG_VER}" ]; then
  echo "ERROR: PostgreSQL is not installed; run .cursor/install.sh first." >&2
  exit 1
fi

echo "==> Starting PostgreSQL ${PG_VER} cluster"
sudo pg_ctlcluster "${PG_VER}" main start 2>/dev/null || true

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    echo "==> PostgreSQL is ready."
    break
  fi
  sleep 1
done

# Make sure the API env file is present (covers fresh checkouts).
bash "$REPO_ROOT/.cursor/write-env.sh"
