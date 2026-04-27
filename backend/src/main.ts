import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { Express } from 'express';

async function bootstrap() {
  console.log('🔄 Starting PDF Agent Platform...');
  console.log('📊 Environment:', process.env.NODE_ENV || 'development');
  
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  // Enable CORS for deployment
  app.enableCors({
    origin: true, // Allow all origins for the hackathon deployment to prevent blockages
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Middleware for file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log('🚀 PDF Agent Platform running on http://localhost:' + port);
  console.log('🌐 Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
  console.log('🔑 GROQ API Key:', process.env.GROQ_API_KEY ? '✅ Configured' : '❌ Missing');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
