#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

npm install --silent

# Ensure the Docker verify image exists (needed for test verification)
if ! docker image inspect shadownpm-verify >/dev/null 2>&1; then
  echo "[engine] Building shadownpm-verify Docker image..."
  docker build -t shadownpm-verify -f Dockerfile.verify . || {
    echo "[engine] WARNING: Failed to build shadownpm-verify image. Test verification will be skipped."
  }
else
  echo "[engine] shadownpm-verify Docker image: OK"
fi

# Run in its own process group so we can kill the entire tree
set -m

cleanup() {
  echo -e "\nShutting down engine..."
  # Kill the entire process group (npx -> tsx -> node)
  kill -- -"$PID" 2>/dev/null
  wait "$PID" 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM EXIT

npx tsx src/index.ts &
PID=$!
wait "$PID"
