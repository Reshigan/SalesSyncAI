-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE salessync'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'salessync')\gexec

-- Connect to the salessync database
\c salessync;

-- Enable extensions on the salessync database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create indexes for better performance
-- These will be created by Prisma migrations, but we can prepare the database