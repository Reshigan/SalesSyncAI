#!/bin/bash

# SalesSyncAI Mobile App Production Build Script
# This script builds the app for both iOS and Android production deployment

set -e

echo "🚀 Starting SalesSyncAI Mobile App Production Build"
echo "=================================================="

# Check if we're in the correct directory
if [ ! -f "app.json" ]; then
    echo "❌ Error: app.json not found. Please run this script from the mobile-app directory."
    exit 1
fi

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g @expo/eas-cli
fi

# Login to EAS (if not already logged in)
echo "🔐 Checking EAS authentication..."
if ! eas whoami &> /dev/null; then
    echo "Please login to your Expo account:"
    eas login
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Clear any existing builds
echo "🧹 Clearing cache..."
npx expo install --fix
npx expo doctor

# Configure EAS project (if not already configured)
echo "⚙️  Configuring EAS project..."
if [ ! -f "eas.json" ]; then
    echo "❌ Error: eas.json not found. Please ensure EAS is properly configured."
    exit 1
fi

# Build for Android (Production AAB)
echo "🤖 Building Android production AAB..."
eas build --platform android --profile production --non-interactive

# Build for iOS (Production IPA)
echo "🍎 Building iOS production IPA..."
eas build --platform ios --profile production --non-interactive

# Build preview versions for testing
echo "📱 Building preview versions for testing..."
eas build --platform android --profile preview --non-interactive
eas build --platform ios --profile preview --non-interactive

echo "✅ Production builds completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Download the builds from https://expo.dev/accounts/[your-account]/projects/salessyncai-mobile/builds"
echo "2. Test the preview builds on physical devices"
echo "3. Submit the production builds to app stores:"
echo "   - Android: Upload AAB to Google Play Console"
echo "   - iOS: Upload IPA to App Store Connect"
echo ""
echo "🎉 SalesSyncAI is ready for production deployment!"