#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

case "$1" in
  build)
    echo "Building the service..."
    yarn nest build copy-comments-old
    ;;
  start)
    echo "Starting the service..."
    yarn node dist/services/copy-comments-old/main.js
    ;;
  start:dev)
    echo "Starting the service in development mode..."
    yarn nest start copy-comments-old --watch
    ;;
  send)
    # Get count from command line, default to 5
    COUNT="${2:-5}"
    echo "Sending $COUNT test messages..."
    yarn node services/copy-comments-old/send-direct.js "$COUNT"
    ;;
  status)
    echo "Checking queue status..."
    yarn node services/copy-comments-old/check-consumer.js
    ;;
  *)
    echo "Usage: $0 {build|start|start:dev|send [count]|status}"
    echo "  build      - Build the service"
    echo "  start      - Start the service"
    echo "  start:dev  - Start the service in development mode"
    echo "  send [count] - Send test messages (default: 5)"
    echo "  status     - Check queue status"
    exit 1
    ;;
esac 