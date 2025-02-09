import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log("🔹 Cargando JWT_SECRET:", process.env.JWT_SECRET || "❌ NO DEFINIDO");

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'https://edgetrader.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
  console.log("✅ Server running...");
}
bootstrap();
