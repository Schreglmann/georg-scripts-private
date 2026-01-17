# Unraid Setup Instructions

## Prerequisites
Install the **User Scripts** plugin from Community Applications in Unraid.

## Setup Steps

### 1. Create Application Directory
```bash
mkdir -p /mnt/user/appdata/georg-cli
```

### 2. Create Environment File
Create `/mnt/user/appdata/georg-cli/.env`:
```env
# Salzburg AG Credentials
SBG_AG_USERNAME=your_username
SBG_AG_PASSWORD=your_password
DAY_ANLAGE=your_day_anlage
NIGHT_ANLAGE=your_night_anlage
GPNR=your_gpnr

# Database Configuration
PG_HOST=your_db_host
PG_PORT=5432
PG_USERNAME=your_db_user
PG_PASSWORD=your_db_password
PG_DATABASE=your_db_name

# Docker Network (use the same custom network as your other containers)
# Examples: br0, macvlan, or your custom network name
DOCKER_NETWORK=br0
```

### 3. Set Up User Script
1. Open **Settings → User Scripts**
2. Click **Add New Script**
3. Name it: `georg-cli-hourly`
4. Click the gear icon → **Edit Script**
5. Paste the contents of `unraid-script.sh`
6. Click **Save Changes**
7. Set schedule to **Hourly** (or **Custom** with cron: `0 * * * *`)

### 4. Test the Script
Click **Run Script** to test it manually before enabling the schedule.

## Manual Commands

Run commands manually using Docker:
```bash
# Load environment variables
source /mnt/user/appdata/georg-cli/.env

# Download and import day data directly to database
docker run --rm \
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
  ghcr.io/schreglmann/georg-scripts-private:latest download-salzburg-ag --target day --headless
```

## How It Works

The `download-salzburg-ag` command:
1. Logs into the Salzburg AG portal using Selenium
2. Downloads JSON data from the API
3. **Inserts data directly into the PostgreSQL database**
4. No CSV files are created (unless using `--debug` flag)

The `import-salzburg-ag` command is only needed if you have existing CSV files to import.

## Viewing Logs
Check the User Scripts plugin for execution logs in **Settings → User Scripts → click on the script name**.
