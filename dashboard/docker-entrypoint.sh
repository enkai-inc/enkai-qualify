#!/bin/sh
set -e

echo "Starting Metis Dashboard..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    # Use node directly since npx may not find prisma in standalone builds
    node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
    echo "Migrations complete."
else
    echo "DATABASE_URL not set, skipping migrations."
fi

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
