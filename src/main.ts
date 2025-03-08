import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  // Configurar CORS para aceptar peticiones desde cualquier origen durante el desarrollo
  app.enableCors({
    origin: true, // Esto permite cualquier origen
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  
  // Configurar prefijo global para la API
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`✅ Servidor corriendo en el puerto ${port}`);
  console.log(`✅ API disponible en: http://localhost:${port}/api`);
}

bootstrap();
