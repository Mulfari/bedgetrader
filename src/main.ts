import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  // Configurar CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://edgetrader.vercel.app',
      // Agregar otros orígenes permitidos si es necesario
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  
  // Configurar prefijo global para la API
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`✅ Servidor corriendo en el puerto ${port}`);
}

bootstrap();
