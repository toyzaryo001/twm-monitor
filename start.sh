#!/usr/bin/env bash
set -euo pipefail

# Railway/Railpack entrypoint (repo root)
cd "$(dirname "$0")"

npm --prefix true-webhook run start:railway
