#!/bin/bash
# Unraid User Script for georg-cli
# Install via: User Scripts plugin -> Add New Script -> Set schedule to hourly
#
# This script runs the georg-cli container to download and import Salzburg AG data directly to database

# Load environment variables
source /mnt/user/appdata/georg-cli/.env

IMAGE="ghcr.io/schreglmann/georg-scripts-private:latest"

echo "$(date): Starting georg-cli tasks"
echo "Checking environment variables..."
if [ -z "$SBG_AG_USERNAME" ]; then
    echo "ERROR: SBG_AG_USERNAME is not set in .env file"
    exit 1
fi
if [ -z "$SBG_AG_PASSWORD" ]; then
    echo "ERROR: SBG_AG_PASSWORD is not set in .env file"
    exit 1
fi
if [ -z "$PG_HOST" ]; then
    echo "ERROR: PG_HOST is not set in .env file"
    exit 1
fi
echo "Environment variables loaded successfully"

# Pull latest image
echo "Pulling latest image..."
docker pull "$IMAGE"

# Download and import day data directly to database
echo "Downloading and importing day data..."
docker run --rm --network host \
  -e SBG_AG_USERNAME="$SBG_AG_USERNAME" \
  -e SBG_AG_PASSWORD="$SBG_AG_PASSWORD" \
  -e DAY_ANLAGE="$DAY_ANLAGE" \
  -e NIGHT_ANLAGE="$NIGHT_ANLAGE" \
  -e GPNR="$GPNR" \
  -e PG_HOST="$PG_HOST" \
  -e PG_PORT="$PG_PORT" \
  -e PG_USERNAME="$PG_USERNAME" \
  -e PG_PASSWORD="$PG_PASSWORD" \
  -e PG_DATABASE="$PG_DATABASE" \
  "$IMAGE" download-salzburg-ag --target day --headless

# Download and import night data directly to database
echo "Downloading and importing night data..."
docker run --rm --network host \
  -e SBG_AG_USERNAME="$SBG_AG_USERNAME" \
  -e SBG_AG_PASSWORD="$SBG_AG_PASSWORD" \
  -e DAY_ANLAGE="$DAY_ANLAGE" \
  -e NIGHT_ANLAGE="$NIGHT_ANLAGE" \
  -e GPNR="$GPNR" \
  -e PG_HOST="$PG_HOST" \
  -e PG_PORT="$PG_PORT" \
  -e PG_USERNAME="$PG_USERNAME" \
  -e PG_PASSWORD="$PG_PASSWORD" \
  -e PG_DATABASE="$PG_DATABASE" \
  "$IMAGE" download-salzburg-ag --target night --headless

echo "$(date): Completed georg-cli tasks"
