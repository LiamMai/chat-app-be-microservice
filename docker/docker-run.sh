#!/bin/bash
set -e

NETWORK_NAME=${APP_NAME}-network

# Generic function to run or start a container
runContainer() {
    local CONTAINER_NAME=$1
    local IMAGE_NAME=$2
    shift 2

    # Split OPTIONS vs CMD (everything after `--` is CMD)
    local OPTIONS=()
    local CMD=()
    local SEEN_DOUBLE_DASH=false

    for arg in "$@"; do
        if [ "$arg" == "--" ]; then
            SEEN_DOUBLE_DASH=true
            continue
        fi
        
        if [ "$SEEN_DOUBLE_DASH" = true ]; then
            CMD+=("$arg")
        else
            OPTIONS+=("$arg")
        fi
    done

    if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
        if [ "$(docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME})" == "true" ]; then
            echo "✅ Container '${CONTAINER_NAME}' is already running."
        else
            echo "▶️ Starting existing container '${CONTAINER_NAME}'..."
            docker start "${CONTAINER_NAME}"
        fi
    else
        echo "🚀 Creating and starting new container '${CONTAINER_NAME}' from image '${IMAGE_NAME}'..."
        if [ ${#CMD[@]} -gt 0 ]; then
            docker run -d --name "${CONTAINER_NAME}" "${OPTIONS[@]}" "${IMAGE_NAME}" "${CMD[@]}"
        else
            docker run -d --name "${CONTAINER_NAME}" "${OPTIONS[@]}" "${IMAGE_NAME}"
        fi
    fi
}

# Create network if not exists
docker network inspect ${NETWORK_NAME} >/dev/null 2>&1 || docker network create ${NETWORK_NAME}

# Run Redis
runContainer ${APP_NAME}-redis redis:latest \
  -p ${REDIS_HOST_PORT}:${REDIS_CONTAINER_PORT} \
  --env-file .env \
  --restart always \
  --network ${NETWORK_NAME} \
  -- redis-server --save 20 1 --loglevel warning --requirepass ${REDIS_PASSWORD}

# Run RabbitMQ
runContainer ${APP_NAME}-rabbitmq rabbitmq:latest \
  -p ${RABBITMQ_HOST_PORT}:${RABBITMQ_CONTAINER_PORT} \
  -e RABBITMQ_DEFAULT_USER=${RABBITMQ_USER} \
  -e RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD} \
  --env-file .env \
  --restart always \
  --network ${NETWORK_NAME}

# Run MongoDB primary
runContainer ${APP_NAME}-mongodb-primary ${APP_NAME}-mongodb \
  -p ${MONGODB_PRIMARY_HOST_PORT}:${MONGODB_PRIMARY_CONTAINER_PORT} \
  -e MONGODB_USERNAME=${MONGODB_USERNAME} \
  -e MONGODB_PASSWORD=${MONGODB_PASSWORD} \
  -v ./docker/mongodb/data:/docker/mongodb/data \
  --env-file .env \
  --restart always \
  --network ${NETWORK_NAME} \
  -- mongod --bind_ip_all --replSet rs0 --keyFile /docker-entrypoint-initdb.d/mongodb-keyfile --port ${MONGODB_PRIMARY_CONTAINER_PORT}

# Run Postgres
runContainer ${APP_NAME}-postgres-primary ${APP_NAME}-postgres \
  -p ${POSTGRES_PRIMARY_HOST_PORT}:5432 \
  -e POSTGRES_USER=${POSTGRES_USERNAME} \
  -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
  -e POSTGRES_DB=${APP_NAME} \
  -v ./docker/postgres/data:/var/lib/postgresql/data/pgdata \
  --env-file .env \
  --restart always \
  --network ${NETWORK_NAME}
