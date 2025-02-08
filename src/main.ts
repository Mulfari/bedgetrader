import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'https://edgetrader.vercel.app',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  });  
  await app.listen(3000);
  setInterval(() => console.log("Server is running..."), 300000);
}
bootstrap();
