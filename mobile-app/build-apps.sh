#!/bin/bash

# SalesSync Mobile App Build Script
# Builds iOS and Android apps for app store submission

set -e

# Configuration
APP_NAME="SalesSync"
BUNDLE_ID="tech.gonxt.salessync"
VERSION="1.0.0"
BUILD_NUMBER="1"
OUTPUT_DIR="./builds"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check React Native CLI
    if ! command -v npx react-native &> /dev/null; then
        log_error "React Native CLI is not available"
        exit 1
    fi
    
    # Check if we're on macOS for iOS builds
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v xcodebuild &> /dev/null; then
            log_warning "Xcode is not installed - iOS build will be skipped"
            SKIP_IOS=true
        fi
    else
        log_warning "Not on macOS - iOS build will be skipped"
        SKIP_IOS=true
    fi
    
    # Check Android SDK
    if [[ -z "$ANDROID_HOME" ]]; then
        log_warning "ANDROID_HOME not set - Android build may fail"
    fi
    
    log_success "Prerequisites checked"
}

# Setup build environment
setup_build_env() {
    log_info "Setting up build environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Install dependencies
    npm install
    
    # Install iOS dependencies (if on macOS)
    if [[ "$OSTYPE" == "darwin"* ]] && [[ "$SKIP_IOS" != "true" ]]; then
        cd ios && pod install && cd ..
    fi
    
    log_success "Build environment setup complete"
}

# Update app configuration
update_app_config() {
    log_info "Updating app configuration..."
    
    # Update package.json version
    npm version "$VERSION" --no-git-tag-version
    
    # Update Android version
    sed -i.bak "s/versionCode [0-9]*/versionCode $BUILD_NUMBER/" android/app/build.gradle
    sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" android/app/build.gradle
    
    # Update iOS version (if on macOS)
    if [[ "$OSTYPE" == "darwin"* ]] && [[ "$SKIP_IOS" != "true" ]]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" ios/SalesSync/Info.plist
        /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" ios/SalesSync/Info.plist
    fi
    
    log_success "App configuration updated"
}

# Build Android APK
build_android_apk() {
    log_info "Building Android APK..."
    
    cd android
    
    # Clean previous builds
    ./gradlew clean
    
    # Build release APK
    ./gradlew assembleRelease
    
    # Copy APK to output directory
    cp app/build/outputs/apk/release/app-release.apk "../$OUTPUT_DIR/SalesSync-v$VERSION-release.apk"
    
    cd ..
    
    log_success "Android APK built successfully"
}

# Build Android AAB (for Play Store)
build_android_aab() {
    log_info "Building Android AAB for Play Store..."
    
    cd android
    
    # Build release AAB
    ./gradlew bundleRelease
    
    # Copy AAB to output directory
    cp app/build/outputs/bundle/release/app-release.aab "../$OUTPUT_DIR/SalesSync-v$VERSION-release.aab"
    
    cd ..
    
    log_success "Android AAB built successfully"
}

# Build iOS IPA
build_ios_ipa() {
    if [[ "$SKIP_IOS" == "true" ]]; then
        log_warning "Skipping iOS build"
        return
    fi
    
    log_info "Building iOS IPA..."
    
    # Build iOS app
    npx react-native run-ios --configuration Release
    
    # Archive the app (requires Xcode project configuration)
    xcodebuild -workspace ios/SalesSync.xcworkspace \
               -scheme SalesSync \
               -configuration Release \
               -archivePath "$OUTPUT_DIR/SalesSync.xcarchive" \
               archive
    
    # Export IPA
    xcodebuild -exportArchive \
               -archivePath "$OUTPUT_DIR/SalesSync.xcarchive" \
               -exportPath "$OUTPUT_DIR" \
               -exportOptionsPlist ios/ExportOptions.plist
    
    log_success "iOS IPA built successfully"
}

# Generate app metadata
generate_metadata() {
    log_info "Generating app metadata..."
    
    cat > "$OUTPUT_DIR/app-metadata.json" << EOF
{
  "appName": "$APP_NAME",
  "bundleId": "$BUNDLE_ID",
  "version": "$VERSION",
  "buildNumber": "$BUILD_NUMBER",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform": {
    "android": {
      "minSdkVersion": 21,
      "targetSdkVersion": 34,
      "compileSdkVersion": 34
    },
    "ios": {
      "minimumOSVersion": "12.0",
      "targetOSVersion": "17.0"
    }
  },
  "features": [
    "GPS Location Tracking",
    "Camera Integration",
    "Offline Data Sync",
    "Bluetooth Printing",
    "Barcode Scanning",
    "Real-time Notifications",
    "Biometric Authentication",
    "Background Location Updates"
  ],
  "permissions": {
    "android": [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "CAMERA",
      "WRITE_EXTERNAL_STORAGE",
      "READ_EXTERNAL_STORAGE",
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "USE_FINGERPRINT",
      "USE_BIOMETRIC"
    ],
    "ios": [
      "NSLocationWhenInUseUsageDescription",
      "NSLocationAlwaysAndWhenInUseUsageDescription",
      "NSCameraUsageDescription",
      "NSPhotoLibraryUsageDescription",
      "NSBluetoothAlwaysUsageDescription",
      "NSFaceIDUsageDescription"
    ]
  }
}
EOF

    log_success "App metadata generated"
}

# Create build summary
create_build_summary() {
    log_info "Creating build summary..."
    
    cat > "$OUTPUT_DIR/BUILD_SUMMARY.md" << EOF
# SalesSync Mobile App Build Summary

## Build Information
- **App Name**: $APP_NAME
- **Version**: $VERSION
- **Build Number**: $BUILD_NUMBER
- **Build Date**: $(date)
- **Bundle ID**: $BUNDLE_ID

## Build Artifacts

### Android
- **APK**: SalesSync-v$VERSION-release.apk
- **AAB**: SalesSync-v$VERSION-release.aab (for Play Store)
- **Min SDK**: 21 (Android 5.0)
- **Target SDK**: 34 (Android 14)

### iOS
EOF

    if [[ "$SKIP_IOS" != "true" ]]; then
        cat >> "$OUTPUT_DIR/BUILD_SUMMARY.md" << EOF
- **IPA**: SalesSync.ipa (for App Store)
- **Min iOS**: 12.0
- **Target iOS**: 17.0
EOF
    else
        cat >> "$OUTPUT_DIR/BUILD_SUMMARY.md" << EOF
- **Status**: Skipped (not on macOS or Xcode not available)
EOF
    fi

    cat >> "$OUTPUT_DIR/BUILD_SUMMARY.md" << EOF

## App Features
- Field Sales Management (DSD)
- Field Marketing Campaigns
- Promotion Activations
- GPS Location Tracking
- Offline Data Synchronization
- Camera Integration
- Bluetooth Thermal Printing
- Barcode Scanning
- Real-time Notifications
- Biometric Authentication

## Technical Specifications
- **Framework**: React Native
- **Minimum Android**: 5.0 (API 21)
- **Minimum iOS**: 12.0
- **Architecture**: ARM64, x86_64
- **Backend API**: HTTPS REST API
- **Database**: SQLite (local), PostgreSQL (server)
- **Authentication**: JWT with biometric support

## Deployment Notes
1. Android APK can be installed directly for testing
2. Android AAB should be uploaded to Google Play Console
3. iOS IPA should be uploaded to App Store Connect
4. Both apps require backend API to be running
5. Apps include offline capabilities for field operations

## Next Steps
1. Test apps on physical devices
2. Submit to app stores for review
3. Configure app store listings
4. Set up analytics and crash reporting
5. Plan rollout strategy
EOF

    log_success "Build summary created"
}

# Main build function
main() {
    log_info "Starting SalesSync mobile app build process..."
    
    check_prerequisites
    setup_build_env
    update_app_config
    
    # Build Android
    build_android_apk
    build_android_aab
    
    # Build iOS (if available)
    build_ios_ipa
    
    # Generate metadata and summary
    generate_metadata
    create_build_summary
    
    log_success "Build process completed!"
    log_info "Build artifacts available in: $OUTPUT_DIR"
    
    # List build artifacts
    echo ""
    log_info "Build Artifacts:"
    ls -la "$OUTPUT_DIR"
}

# Handle script arguments
case "${1:-build}" in
    "build")
        main
        ;;
    "android")
        check_prerequisites
        setup_build_env
        update_app_config
        build_android_apk
        build_android_aab
        generate_metadata
        log_success "Android build completed!"
        ;;
    "ios")
        check_prerequisites
        setup_build_env
        update_app_config
        build_ios_ipa
        generate_metadata
        log_success "iOS build completed!"
        ;;
    "clean")
        log_info "Cleaning build artifacts..."
        rm -rf "$OUTPUT_DIR"
        rm -rf android/app/build
        rm -rf ios/build
        log_success "Clean completed!"
        ;;
    *)
        echo "Usage: $0 {build|android|ios|clean}"
        echo "  build   - Build both Android and iOS apps"
        echo "  android - Build only Android apps"
        echo "  ios     - Build only iOS app"
        echo "  clean   - Clean build artifacts"
        exit 1
        ;;
esac