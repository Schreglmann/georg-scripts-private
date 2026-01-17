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
  -e SBG_AG_USERNAME="$USERNAME" \
  -e SBG_AG_PASSWORD="$PASSWORD" \
  -e DAY_ANLAGE="$DAY_ANLAGE" \
  -e NIGHT_ANLAGE="$NIGHT_ANLAGE" \
  -e GPNR="$GPNR" \
  -e PG_HOST="$DB_HOST" \
  -e PG_PORT="$DB_PORT" \
  -e PG_USERNAME="$DB_USER" \
  -e PG_PASSWORD="$DB_PASSWORD" \
  -e PG_DATABASE="$DB_NAME" \
  "$IMAGE" download-salzburg-ag --target day --headless

# Download and import night data directly to database
echo "Downloading and importing night data..."
docker run --rm \
  -e SBG_AG_USERNAME="$USERNAME" \
  -e SBG_AG_PASSWORD="$PASSWORD" \
  -e DAY_ANLAGE="$DAY_ANLAGE" \
  -e NIGHT_ANLAGE="$NIGHT_ANLAGE" \
  -e GPNR="$GPNR" \
  -e PG_HOST="$DB_HOST" \
  -e PG_PORT="$DB_PORT" \
  -e PG_USERNAME="$DB_USER" \
  -e PG_PASSWORD="$DB_PASSWORD" \
  -e PG_DATABASE="$DB_NAME" \
  "$IMAGE" download-salzburg-ag --target night --headless

echo "$(date): Completed georg-cli tasks"
