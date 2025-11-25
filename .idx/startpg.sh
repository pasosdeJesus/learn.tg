#!/bin/sh
set -e

# Ensure data and run directories exist
mkdir -p /home/user/pg/data
mkdir -p /run/postgresql

# Initialize DB if it hasn't been initialized yet
if [ ! -f "/home/user/pg/data/PG_VERSION" ]; then
    initdb -D /home/user/pg/data
fi

# Start server if not running
pg_ctl -D /home/user/pg/data status || pg_ctl -D /home/user/pg/data -l /home/user/pg/logfile start

# Create user if it doesn't exist
if ! psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='learntg'" | grep -q 1; then
    createuser -s learntg
fi

# Set password for the user
psql -d postgres -c "ALTER USER learntg WITH PASSWORD 'xyz';"

