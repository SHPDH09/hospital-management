#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL if not already accepting connections
if ! pg_isready -h localhost -q 2>/dev/null; then
  sudo pg_ctlcluster 16 main start 2>/dev/null \
    || sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/16/main start
fi

# Start Redis if not already running
if ! redis-cli ping >/dev/null 2>&1; then
  sudo redis-server --daemonize yes --port 6379
fi

# Wait for services to be ready
for _ in $(seq 1 30); do
  pg_isready -h localhost -q && redis-cli ping >/dev/null 2>&1 && break
  sleep 1
done

pg_isready -h localhost
redis-cli ping
