#!/bin/sh
# Plan § 3: save one rig page as a self-contained HTML file. Usage: scripts/preview.sh [path] [out]
# LANE_MARKER comes from the environment (or .env); unset it for the clean-up copy (plan § 4).
set -eu
path=${1:-/digest/2026-10-28}
out=${2:-var/preview/index.html}
port=${PORT:-8787}
mkdir -p "$(dirname "$out")"
node_modules/.bin/tsx --env-file-if-exists=.env src/server.ts >/dev/null 2>&1 &
pid=$!
trap 'pkill -P $pid 2>/dev/null; kill $pid 2>/dev/null' EXIT
for _ in $(seq 50); do curl -sf "http://localhost:$port/health" >/dev/null && break; sleep 0.2; done
curl -sf "http://localhost:$port$path" -o "$out"
echo "$out"
