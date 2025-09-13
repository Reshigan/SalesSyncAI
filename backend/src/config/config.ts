import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://salessync:salessync_password@localhost:5432/salessync',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
  },
  
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3: {
      bucket: process.env.AWS_S3_BUCKET || 'salessync-files',
    },
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  },
  
  email: {
    from: process.env.EMAIL_FROM || 'noreply@salessync.com',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  },
  
  app: {
    name: 'SalesSync',
    url: process.env.APP_URL || 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  },
  
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
  },
  
  fraud: {
    locationAccuracyThreshold: parseInt(process.env.FRAUD_LOCATION_ACCURACY_THRESHOLD || '100'), // meters
    maxTravelSpeed: parseInt(process.env.FRAUD_MAX_TRAVEL_SPEED || '120'), // km/h
    cashVarianceThreshold: parseFloat(process.env.FRAUD_CASH_VARIANCE_THRESHOLD || '50'), // currency units
    photoQualityThreshold: parseFloat(process.env.FRAUD_PHOTO_QUALITY_THRESHOLD || '0.7'), // 0-1 score
  },
  
  ai: {
    imageAnalysisEndpoint: process.env.AI_IMAGE_ANALYSIS_ENDPOINT || 'http://localhost:8000/analyze',
    fraudDetectionEndpoint: process.env.AI_FRAUD_DETECTION_ENDPOINT || 'http://localhost:8000/fraud-detect',
  },
};