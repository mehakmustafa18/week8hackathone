import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

let cachedServer: any;

async function bootstrap() {
  if (cachedServer) return cachedServer;

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Middleware for file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  await app.init();
  cachedServer = app.getHttpAdapter().getInstance();
  return cachedServer;
}

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  bootstrap().then(async (server) => {
    const port = process.env.PORT || 3001;
    const app = await NestFactory.create(AppModule);
    // Re-apply same config for local
    app.enableCors({ origin: '*' });
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    await app.listen(port);
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

// Export for Vercel
export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};
