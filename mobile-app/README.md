# SalesSyncAI Mobile App

<div align="center">
  <img src="./assets/icon.png" alt="SalesSyncAI Logo" width="120" height="120">
  
  <h3>AI-Powered Field Sales & Marketing Management</h3>
  
  <p>Complete mobile solution for field sales teams, marketing campaigns, and activation management with offline-first architecture and AI-powered insights.</p>

  [![React Native](https://img.shields.io/badge/React%20Native-0.72-blue.svg)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-49.0-black.svg)](https://expo.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

## 🚀 Features

### 📱 Field Sales Management
- **Smart Visit Planning**: GPS-optimized route planning and visit scheduling
- **Interactive Surveys**: Customizable forms with photo capture and validation
- **Customer Management**: Complete CRM functionality with offline sync
- **Real-time Tracking**: GPS tracking and location verification
- **Performance Analytics**: Comprehensive reporting and insights

### 🎯 Marketing Campaigns
- **Campaign Execution**: Street marketing and product sampling tools
- **Customer Interactions**: Lead capture and engagement tracking
- **Material Management**: Inventory tracking for promotional materials
- **Live KPI Monitoring**: Real-time performance metrics and analytics
- **ROI Tracking**: Campaign effectiveness measurement

### 🎪 Activation Management
- **Event Coordination**: In-store and outdoor activation management
- **Team Collaboration**: Real-time checklists and task management
- **Performance Tracking**: Live KPI updates and progress monitoring
- **Documentation**: Photo capture and activity logging
- **Reporting**: Comprehensive activation reports and analytics

### 🔄 Offline-First Architecture
- **Complete Offline Functionality**: Full app functionality without internet
- **Automatic Sync**: Seamless data synchronization when online
- **Secure Storage**: Encrypted local data storage
- **Conflict Resolution**: Smart data merging and conflict handling
- **Background Sync**: Automatic sync in background when connected

### 📊 AI-Powered Insights
- **Route Optimization**: AI-driven route planning and optimization
- **Predictive Analytics**: Performance predictions and recommendations
- **Customer Segmentation**: Intelligent customer categorization
- **Performance Insights**: AI-generated reports and recommendations
- **Trend Analysis**: Market trend identification and analysis

## 🏗️ Technical Architecture

### Frontend Stack
- **React Native 0.72**: Cross-platform mobile development
- **Expo 49.0**: Development platform and build service
- **TypeScript**: Type-safe development
- **React Native Paper**: Material Design components
- **React Navigation**: Navigation and routing

### State Management
- **React Context**: Global state management
- **AsyncStorage**: Persistent local storage
- **SQLite**: Local database for offline data

### Services & APIs
- **RESTful APIs**: Backend communication
- **GraphQL**: Advanced data querying (planned)
- **WebSocket**: Real-time updates
- **Push Notifications**: Expo Notifications

### Location & Media
- **Expo Location**: GPS tracking and geolocation
- **Expo Camera**: Photo capture and processing
- **React Native Maps**: Interactive maps and routing
- **Expo Image Picker**: Media selection and upload

### Security
- **Expo SecureStore**: Encrypted credential storage
- **JWT Authentication**: Secure API authentication
- **Certificate Pinning**: API security (planned)
- **Biometric Authentication**: Fingerprint/Face ID (planned)

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio/Emulator (for Android development)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI/mobile-app

# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

### Development Setup
```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Install EAS CLI for building
npm install -g @expo/eas-cli

# Login to Expo account
npx expo login

# Install dependencies with legacy peer deps (if needed)
npm install --legacy-peer-deps
```

## 🏃‍♂️ Running the App

### Development Mode
```bash
# Start Metro bundler
npx expo start

# Run on specific platform
npx expo start --ios
npx expo start --android
npx expo start --web
```

### Preview Builds
```bash
# Build preview for testing
eas build --profile preview --platform all
```

### Production Builds
```bash
# Build for production
eas build --profile production --platform all
```

## 📱 App Structure

```
mobile-app/
├── src/
│   ├── components/          # Reusable UI components
│   ├── screens/            # Screen components
│   │   ├── auth/           # Authentication screens
│   │   ├── dashboard/      # Dashboard and home screens
│   │   ├── field-sales/    # Field sales management
│   │   ├── field-marketing/# Marketing campaigns
│   │   └── promotions/     # Activation management
│   ├── context/            # React Context providers
│   ├── services/           # API and utility services
│   ├── theme/              # Design system and theming
│   └── utils/              # Utility functions
├── assets/                 # Images, icons, and static assets
├── store-config/           # App store metadata
├── scripts/                # Build and deployment scripts
└── docs/                   # Documentation
```

## 🎨 Design System

### Theme Configuration
The app uses a consistent design system with:
- **Primary Colors**: Blue-based palette
- **Typography**: Roboto font family
- **Spacing**: 8px grid system
- **Components**: Material Design 3 components
- **Dark Mode**: Automatic theme switching (planned)

### Component Library
- **Cards**: Information display and grouping
- **Buttons**: Primary, secondary, and text variants
- **Forms**: Input fields, dropdowns, and validation
- **Navigation**: Tab bars, headers, and drawers
- **Feedback**: Snackbars, dialogs, and loading states

## 🔧 Configuration

### Environment Variables
Configure the app through `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.salessyncai.com",
      "environment": "development",
      "enableAnalytics": true
    }
  }
}
```

### API Configuration
Update API endpoints in `src/services/apiService.ts`:

```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
```

## 🧪 Testing

### Unit Testing
```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage
```

### E2E Testing
```bash
# Run end-to-end tests
npm run test:e2e
```

### Manual Testing
- Use Expo Go app for quick testing
- Test on physical devices for location/camera features
- Verify offline functionality
- Test performance on low-end devices

## 📊 Performance Optimization

### Bundle Size Optimization
- Tree shaking for unused code
- Image optimization and compression
- Lazy loading for screens and components
- Code splitting for large features

### Runtime Performance
- Optimized list rendering with FlatList
- Image caching and lazy loading
- Background task optimization
- Memory leak prevention

### Offline Performance
- Efficient local data storage
- Smart sync strategies
- Background sync optimization
- Conflict resolution algorithms

## 🛡️ Security Features

### Data Protection
- End-to-end encryption for sensitive data
- Secure local storage with Expo SecureStore
- API communication over HTTPS only
- Token-based authentication with refresh

### Privacy Compliance
- GDPR compliance for EU users
- CCPA compliance for California users
- Data minimization principles
- User consent management

## 🚀 Deployment

### Development Deployment
```bash
# Publish development update
eas update --branch development
```

### Production Deployment
```bash
# Build and deploy to app stores
./scripts/build-production.sh
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📈 Analytics & Monitoring

### Performance Monitoring
- Crash reporting with Expo Application Services
- Performance metrics tracking
- User behavior analytics
- Error boundary implementation

### Business Analytics
- User engagement metrics
- Feature usage tracking
- Conversion funnel analysis
- A/B testing framework (planned)

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Conventional commits for git messages

### Pull Request Process
1. Ensure all tests pass
2. Update documentation as needed
3. Add screenshots for UI changes
4. Request review from maintainers

## 📚 Documentation

### User Documentation
- [User Guide](./docs/USER_GUIDE.md)
- [Feature Documentation](./docs/FEATURES.md)
- [FAQ](./docs/FAQ.md)

### Developer Documentation
- [API Documentation](./docs/API.md)
- [Architecture Guide](./docs/ARCHITECTURE.md)
- [Contributing Guide](./docs/CONTRIBUTING.md)

## 🐛 Troubleshooting

### Common Issues
- **Metro bundler issues**: Clear cache with `npx expo start --clear`
- **Dependency conflicts**: Use `npm install --legacy-peer-deps`
- **Build failures**: Check EAS dashboard for detailed logs
- **Simulator issues**: Reset simulator and restart Metro

### Getting Help
- Check the [FAQ](./docs/FAQ.md)
- Search existing [GitHub Issues](https://github.com/Reshigan/SalesSyncAI/issues)
- Join our [Community Forum](https://community.salessyncai.com)
- Contact [Support](mailto:support@salessyncai.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Expo Team** for the amazing development platform
- **React Native Community** for the robust ecosystem
- **Material Design** for the design system
- **Open Source Contributors** for various libraries used

## 📞 Support

- **Email**: support@salessyncai.com
- **Website**: https://salessyncai.com
- **Documentation**: https://docs.salessyncai.com
- **Community**: https://community.salessyncai.com

---

<div align="center">
  <p>Built with ❤️ by the SalesSyncAI Team</p>
  <p>© 2024 SalesSyncAI. All rights reserved.</p>
</div>