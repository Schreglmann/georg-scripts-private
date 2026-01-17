#!/bin/bash
# Unraid User Script for georg-cli
# Install via: User Scripts plugin -> Add New Script -> Set schedule to hourly
#
# This script runs the georg-cli container to download and import Salzburg AG data directly to database

# Load environment variables
source /mnt/user/appdata/georg-cli/.env

IMAGE="ghcr.io/schreglmann/georg-scripts-private:latest"

echo "$(date): Starting georg-cli tasks"

# Pull latest image
echo "Pulling latest image..."
docker pull "$IMAGE"

# Download and import day data directly to database
echo "Downloading and importing day data..."
docker run --rm \
  -e USERNAME="$USERNAME" \
  -e PASSWORD="$PASSWORD" \
  -e DAY_ANLAGE="$DAY_ANLAGE" \
  -e NIGHT_ANLAGE="$NIGHT_ANLAGE" \
  -e GPNR="$GPNR" \
  -e DB_HOST="$DB_HOST" \
  -e DB_PORT="$DB_PORT" \
  -e DB_USER="$DB_USER" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e DB_NAME="$DB_NAME" \
  "$IMAGE" download-salzburg-ag --target day --headless

# Download and import night data directly to database
echo "Downloading and importing night data..."
docker run --rm \
  -e USERNAME="$USERNAME" \
  -e PASSWORD="$PASSWORD" \
  -e DAY_ANLAGE="$DAY_ANLAGE" \
  -e NIGHT_ANLAGE="$NIGHT_ANLAGE" \
  -e GPNR="$GPNR" \
  -e DB_HOST="$DB_HOST" \
  -e DB_PORT="$DB_PORT" \
  -e DB_USER="$DB_USER" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e DB_NAME="$DB_NAME" \
  "$IMAGE" download-salzburg-ag --target night --headless

echo "$(date): Completed georg-cli tasks"
