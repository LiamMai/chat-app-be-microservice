#!/bin/bash
set -e

nodeEnv=${1:-"dev"}
outPath="/docker-entrypoint-initdb.d/data"

# Must re-declare as it can't expand from .env file
POSTGRES_BASE_URL=postgresql://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_PRIMARY_HOST}:${POSTGRES_PRIMARY_HOST_PORT}