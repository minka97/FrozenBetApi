import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiration: process.env.JWT_EXPIRATION || '24h',
    refreshExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
