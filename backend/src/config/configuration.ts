import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3001'),
  environment: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  maxPdfSize: parseInt(process.env.MAX_PDF_SIZE || '20000000'),
  chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '100'),
}));

export const databaseConfig = registerAs('database', () => ({
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pdf-agent-platform',
}));

export const groqConfig = registerAs('groq', () => ({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
}));
