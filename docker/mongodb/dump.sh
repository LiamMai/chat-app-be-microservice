#!/bin/bash
set -e

nodeEnv=${1:-"dev"}
outPath="/docker-entrypoint-initdb.d/data"

# Must re-declare as it can't expand from .env file
MONGODB_BASE_URL="mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@localhost:${MONGODB_PRIMARY_CONTAINER_PORT}"