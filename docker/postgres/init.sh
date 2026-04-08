#!/bin/bash
set -e

ROOT_USER=${POSTGRES_USER:-postgres}
ROOT_PASS=${POSTGRES_PASSWORD}
APP_ROLE=${POSTGRES_USERNAME:-postgres_admin}
APP_DB=${APP_NAME:-chat_app_db}

echo "🐘 Starting initialization..."

# 🔥 Set password FIRST (no auth needed due to trust)
psql --username "$ROOT_USER" --dbname "postgres" \
  -c "ALTER USER \"$ROOT_USER\" PASSWORD '$ROOT_PASS';"

# 1. Create Role
ROLE_EXISTS=$(psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APP_ROLE'" --username "$ROOT_USER")

if [ "$ROLE_EXISTS" != "1" ]; then
    echo "👤 Creating role: $APP_ROLE..."
    psql --username "$ROOT_USER" \
        -c "CREATE ROLE \"$APP_ROLE\" WITH LOGIN PASSWORD '$ROOT_PASS';" \
        -c "ALTER ROLE \"$APP_ROLE\" CREATEDB;"
fi

# 2. Create Database
DB_EXISTS=$(psql -tAc "SELECT 1 FROM pg_database WHERE datname='$APP_DB'" --username "$ROOT_USER")

if [ "$DB_EXISTS" != "1" ]; then
    echo "🛠️ Creating database: $APP_DB..."
    psql --username "$ROOT_USER" \
        -c "CREATE DATABASE \"$APP_DB\" OWNER \"$APP_ROLE\";"
fi

# 3. Grant privileges
psql --username "$ROOT_USER" \
    -c "GRANT ALL PRIVILEGES ON DATABASE \"$APP_DB\" TO \"$APP_ROLE\";"

echo "✅ Initialization complete."