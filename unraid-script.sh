#!/bin/bash
# Unraid User Script for georg-cli
# Install via: User Scripts plugin -> Add New Script -> Set schedule to hourly
#
# This script runs the georg-cli container to download and import Salzburg AG data directly to database

# ============================================
# CONFIGURATION FLAGS
# ============================================
# Set FORCE_MODE to true to override existing database entries
FORCE_MODE=false
# ============================================

# Load environment variables
source /mnt/user/appdata/georg-cli/.env

IMAGE="ghcr.io/schreglmann/georg-scripts-private:latest"

# Set default network if not specified
DOCKER_NETWORK="${DOCKER_NETWORK:-bridge}"

# Build force flag parameter
FORCE_FLAG=""
if [ "$FORCE_MODE" = true ]; then
    FORCE_FLAG="--force"
    echo "FORCE MODE ENABLED: Will override existing database entries"
fi

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
echo "Using Docker network: $DOCKER_NETWORK"

# Pull latest image
echo "Pulling latest image..."
docker pull "$IMAGE"

# Download and import day data directly to database
echo "Downloading and importing day data..."
DAY_OUTPUT=$(docker run --rm --network "$DOCKER_NETWORK" \
  -e TZ=Europe/Vienna \
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
  "$IMAGE" download-salzburg-ag --target day --headless $FORCE_FLAG 2>&1)

DAY_EXIT_CODE=$?
echo "$DAY_OUTPUT"

# Download and import night data directly to database
echo "Downloading and importing night data..."
NIGHT_OUTPUT=$(docker run --rm --network "$DOCKER_NETWORK" \
  -e TZ=Europe/Vienna \
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
  "$IMAGE" download-salzburg-ag --target night --headless $FORCE_FLAG 2>&1)

NIGHT_EXIT_CODE=$?
echo "$NIGHT_OUTPUT"

echo ""
echo "========================================"
echo "           FINAL SUMMARY"
echo "========================================"
echo ""
echo "DAY DATA SUMMARY:"
echo "$DAY_OUTPUT" | grep -A 10 "=== Summary ===" | tail -n +2
if [ $DAY_EXIT_CODE -ne 0 ]; then
    echo "Day task exited with error code: $DAY_EXIT_CODE"
fi
echo ""
echo "NIGHT DATA SUMMARY:"
echo "$NIGHT_OUTPUT" | grep -A 10 "=== Summary ===" | tail -n +2
if [ $NIGHT_EXIT_CODE -ne 0 ]; then
    echo "Night task exited with error code: $NIGHT_EXIT_CODE"
fi
echo ""
echo "========================================"
echo ""

echo "$(date): Completed georg-cli tasks"
