#!/bin/sh
set -e

echo "Starting Metis Dashboard..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma
    echo "Migrations complete."
else
    echo "DATABASE_URL not set, skipping migrations."
fi

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
