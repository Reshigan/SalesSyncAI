# SalesSyncAI Mobile App Deployment Guide

This guide covers the complete deployment process for the SalesSyncAI mobile application to both iOS App Store and Google Play Store.

## 🚀 Quick Start

1. **Prerequisites Setup**
2. **Build Configuration**
3. **Production Builds**
4. **App Store Submission**
5. **Post-Deployment**

## 📋 Prerequisites

### Required Accounts
- [ ] **Expo Account** - For EAS Build service
- [ ] **Apple Developer Account** ($99/year) - For iOS App Store
- [ ] **Google Play Developer Account** ($25 one-time) - For Google Play Store

### Required Tools
- [ ] **Node.js** (v16 or later)
- [ ] **npm** or **yarn**
- [ ] **EAS CLI** (`npm install -g @expo/eas-cli`)
- [ ] **Expo CLI** (`npm install -g @expo/cli`)

### Development Environment
```bash
# Install dependencies
cd mobile-app
npm install

# Install EAS CLI globally
npm install -g @expo/eas-cli

# Login to Expo
eas login
```

## ⚙️ Build Configuration

### 1. App Configuration (`app.json`)
The app is pre-configured with production-ready settings:
- **Bundle ID**: `com.salessyncai.mobile`
- **App Name**: SalesSyncAI
- **Version**: 1.0.0
- **Production API**: `https://ssai.gonxt.tech/api`
- **Permissions**: Location, Camera, Storage, etc.

### 2. Production Server Configuration
The mobile app is configured to connect to the production server:
- **Server URL**: `https://ssai.gonxt.tech`
- **API Base URL**: `https://ssai.gonxt.tech/api`
- **Environment**: Production
- **Offline-First**: App works fully offline with automatic sync when online

### 3. EAS Build Configuration (`eas.json`)
Three build profiles are configured:
- **development**: For development builds with dev client
- **preview**: For internal testing (APK/IPA)
- **production**: For app store submission (AAB/IPA)

### 4. Store Metadata
Pre-configured store listings are available in `/store-config/`:
- `app-store-metadata.json` - iOS App Store listing
- `google-play-metadata.json` - Google Play Store listing

## 🏗️ Production Builds

### Automated Build Script
Use the provided build script for complete production builds:

```bash
# Make script executable
chmod +x scripts/build-production.sh

# Run production builds
./scripts/build-production.sh
```

### Manual Build Commands

#### Android Production Build (AAB)
```bash
eas build --platform android --profile production
```

#### iOS Production Build (IPA)
```bash
eas build --platform ios --profile production
```

#### Preview Builds for Testing
```bash
# Android APK for testing
eas build --platform android --profile preview

# iOS IPA for testing
eas build --platform ios --profile preview
```

## 📱 App Store Submission

### iOS App Store (App Store Connect)

1. **Prepare App Store Connect**
   - Create new app in App Store Connect
   - Configure app information using `store-config/app-store-metadata.json`
   - Upload screenshots and app preview videos

2. **Upload Build**
   ```bash
   # Download IPA from EAS dashboard
   # Upload to App Store Connect using Transporter or Xcode
   ```

3. **App Review Submission**
   - Complete app information
   - Set pricing and availability
   - Submit for review

### Google Play Store (Play Console)

1. **Prepare Play Console**
   - Create new app in Google Play Console
   - Configure store listing using `store-config/google-play-metadata.json`
   - Upload screenshots and feature graphics

2. **Upload Build**
   ```bash
   # Download AAB from EAS dashboard
   # Upload to Play Console under "Production" track
   ```

3. **Release Management**
   - Complete content rating questionnaire
   - Set up pricing and distribution
   - Submit for review

## 🔧 Advanced Configuration

### Environment Variables
Configure environment-specific variables in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.salessyncai.com",
      "environment": "production"
    }
  }
}
```

### Code Signing (iOS)
EAS handles code signing automatically, but you can configure:
- Distribution certificates
- Provisioning profiles
- App Store Connect API keys

### App Signing (Android)
EAS manages Android app signing:
- Upload key generation
- Play App Signing enrollment
- Automatic key management

## 📊 Monitoring & Analytics

### Crash Reporting
The app includes crash reporting via:
- Expo Application Services (EAS)
- Native crash reporting tools

### Performance Monitoring
Monitor app performance through:
- EAS Insights
- App Store Connect Analytics
- Google Play Console Vitals

## 🔄 Updates & Maintenance

### Over-the-Air Updates
Use Expo Updates for non-native changes:

```bash
# Publish update
eas update --branch production --message "Bug fixes and improvements"
```

### App Store Updates
For native changes, rebuild and resubmit:

1. Update version in `app.json`
2. Run production builds
3. Submit to app stores

## 🛡️ Security Considerations

### Code Obfuscation
Production builds include:
- JavaScript minification
- Asset optimization
- Bundle splitting

### API Security
- HTTPS-only communication
- Token-based authentication
- Certificate pinning (if configured)

### Data Protection
- Local data encryption
- Secure storage implementation
- Privacy compliance (GDPR, CCPA)

## 📋 Pre-Launch Checklist

### Technical Validation
- [ ] All screens and functionality working
- [ ] Offline mode functioning correctly
- [ ] GPS and location services working
- [ ] Camera and photo capture working
- [ ] Push notifications configured
- [ ] Performance optimized
- [ ] Memory usage acceptable
- [ ] Battery usage optimized

### Store Requirements
- [ ] App metadata complete
- [ ] Screenshots uploaded (all required sizes)
- [ ] App icons provided (all required sizes)
- [ ] Privacy policy published
- [ ] Terms of service available
- [ ] Content rating completed
- [ ] Age rating appropriate

### Legal & Compliance
- [ ] Privacy policy updated
- [ ] Terms of service current
- [ ] Data handling compliant
- [ ] Third-party licenses included
- [ ] Export compliance (if applicable)

## 🎉 Post-Deployment

### Launch Activities
1. **Monitor App Store Reviews**
   - Respond to user feedback
   - Address critical issues quickly

2. **Track Key Metrics**
   - Download numbers
   - User engagement
   - Crash rates
   - Performance metrics

3. **Marketing & Promotion**
   - Social media announcement
   - Press release
   - User onboarding campaigns

### Ongoing Maintenance
- Regular updates and improvements
- Bug fixes and performance optimization
- Feature enhancements based on user feedback
- Security updates and compliance maintenance

## 🆘 Troubleshooting

### Common Build Issues
- **Dependency conflicts**: Run `npm install --legacy-peer-deps`
- **EAS authentication**: Run `eas login` and verify account
- **Build failures**: Check EAS dashboard for detailed logs

### Store Rejection Issues
- **iOS rejections**: Common issues include privacy descriptions, app functionality
- **Android rejections**: Usually related to permissions or content policy

### Support Resources
- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy](https://play.google.com/about/developer-content-policy/)

---

## 📞 Support

For deployment support and questions:
- **Email**: support@salessyncai.com
- **Documentation**: https://salessyncai.com/docs
- **Community**: https://community.salessyncai.com

**Happy Deploying! 🚀**