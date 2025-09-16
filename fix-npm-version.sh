#!/bin/bash

# 🔧 Fix npm version compatibility with Node.js 18
# This script fixes the npm version issue and continues the installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

# Configuration
DOMAIN="salessync.gonxt.tech"
APP_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync"
DB_PASS="salessync_secure_password_2024"

log "Fixing npm version compatibility..."

# Fix npm version to be compatible with Node.js 18
log "Installing compatible npm version..."
npm install -g npm@10.9.0

# Install global packages
log "Installing global packages..."
npm install -g pm2@latest
npm install -g typescript@latest

# Continue with the rest of the installation
log "Continuing with SalesSync installation..."

# Create application directory if it doesn't exist
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository if not already done
if [ ! -d ".git" ]; then
    log "Cloning SalesSync repository..."
    git clone https://github.com/Reshigan/SalesSyncAI.git .
fi

# Install backend dependencies
log "Installing backend dependencies..."
cd backend
npm install --include=dev

# Install additional type definitions
log "Installing additional type definitions..."
npm install --save-dev \
    @types/node \
    @types/express \
    @types/cors \
    @types/bcryptjs \
    @types/jsonwebtoken \
    @types/multer \
    @types/pdfkit \
    @types/web-push \
    @types/handlebars || log "Some type packages may not be available (continuing...)"

# Create custom type declarations
log "Creating custom type declarations..."
mkdir -p types

cat > types/custom.d.ts << 'EOF'
// Custom type declarations for modules without proper types

declare module 'handlebars' {
  export function compile(template: string): (context: any) => string;
  export function registerHelper(name: string, fn: Function): void;
}

declare namespace Express {
  export namespace Multer {
    export interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

declare module 'pdfkit' {
  namespace PDFKit {
    interface PDFDocument {
      fontSize(size: number): PDFDocument;
      text(text: string, x?: number, y?: number, options?: any): PDFDocument;
      moveDown(lines?: number): PDFDocument;
      end(): void;
      pipe(stream: any): any;
    }
  }
  
  interface PDFDocumentOptions {
    size?: string;
    margin?: number;
  }
  
  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    fontSize(size: number): PDFDocument;
    text(text: string, x?: number, y?: number, options?: any): PDFDocument;
    moveDown(lines?: number): PDFDocument;
    end(): void;
    pipe(stream: any): any;
  }
  
  export = PDFDocument;
}
EOF

# Update TypeScript configuration
log "Updating TypeScript configuration..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "noImplicitAny": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "typeRoots": ["./node_modules/@types", "./types"],
    "types": ["node", "express", "multer", "jsonwebtoken"]
  },
  "include": [
    "src/**/*",
    "types/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
EOF

log "Generating Prisma client..."
npx prisma generate

log "Running database migrations..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" npx prisma migrate deploy

log "Seeding database with demo data..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" node seed-simple.js

log "Building TypeScript application..."
npx tsc --skipLibCheck

log "✅ npm version fixed and SalesSync setup completed!"
log "You can now continue with the rest of the installation or restart the main script."