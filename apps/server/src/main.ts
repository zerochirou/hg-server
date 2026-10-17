import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('/api', { exclude: ['/'] });

  // Enable trust proxy for reverse proxies (Render, Nginx, Cloudflare)
  app.set('trust proxy', 1);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const allowedOrigins: string[] = [
    clientUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
  ];

  if (process.env.ADDITIONAL_ALLOWED_ORIGINS) {
    allowedOrigins.push(
      ...process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    );
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, Expo native, or curl)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('exp://') ||
        origin.startsWith('hypergrid://') ||
        (process.env.NODE_ENV !== 'production' && origin.includes('localhost'))
      ) {
        callback(null, true);
      } else {
        if (process.env.NODE_ENV === 'production') {
          callback(new Error('Akses diblokir oleh kebijakan CORS'));
        } else {
          callback(null, true);
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'expo-origin',
      'x-skip-oauth-proxy',
    ],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
