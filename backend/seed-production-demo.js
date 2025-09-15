#!/usr/bin/env node

/**
 * Production Demo Seed Script
 * 
 * This script seeds the production database with demo data for TechCorp Solutions
 * including easy-to-remember login credentials for demonstrations.
 * 
 * Usage:
 *   node seed-production-demo.js
 * 
 * Or via Docker:
 *   docker exec -it salessync-backend-prod node seed-production-demo.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🌱 Starting production demo database seeding...');
console.log('');

try {
  // Change to the correct directory
  process.chdir(__dirname);
  
  // Run the TypeScript seed file
  console.log('📦 Compiling and running seed file...');
  execSync('npx tsx prisma/seed-demo-production.ts', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  console.log('');
  console.log('✅ Production demo seeding completed successfully!');
  console.log('');
  console.log('🔗 Next steps:');
  console.log('1. Access the application at your domain');
  console.log('2. Use the demo credentials to log in');
  console.log('3. Explore the features with realistic demo data');
  
} catch (error) {
  console.error('❌ Error during seeding:', error.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('1. Ensure the database is running and accessible');
  console.log('2. Check that DATABASE_URL environment variable is set');
  console.log('3. Verify Prisma client is generated: npx prisma generate');
  console.log('4. Check database connection: npx prisma db pull');
  
  process.exit(1);
}