import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*', // O mejor: 'https://edgetrader.vercel.app'
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  });

  await app.listen(3000);
}
bootstrap();
