#!/bin/sh
set -e

echo "Starting Enkai Qualify Dashboard..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    # Use node directly since npx may not find prisma in standalone builds
    PRISMA="node ./node_modules/prisma/build/index.js"

    # Resolve any failed migrations first (marks them as rolled back)
    # This handles the case where a migration was started but failed
    $PRISMA migrate resolve --rolled-back 20260218052100_clerk_to_cognito --schema=./prisma/schema.prisma 2>/dev/null || true

    # Now run the migrations
    $PRISMA migrate deploy --schema=./prisma/schema.prisma
    echo "Migrations complete."
else
    echo "DATABASE_URL not set, skipping migrations."
fi

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
