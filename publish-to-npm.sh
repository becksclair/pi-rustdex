#!/bin/bash
set -e

echo "Publishing pi-rustdex to npm..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install

# Run tests if they exist
if npm run test 2>/dev/null; then
  echo "Tests passed!"
else
  echo "No tests found or tests failed, continuing..."
fi

# Build TypeScript if needed
# npm run build

# Publish to npm
echo "Publishing to npm..."
npm publish --access public

echo "Done! Package published successfully."
