import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS
  app.enableCors({
    origin: '*', // Cambia a 'https://edgetrader.vercel.app' cuando funcione
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Middleware para manejar preflight requests (CORS)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  await app.listen(3000);
  setInterval(() => console.log("Server is running..."), 300000);
}

bootstrap();
