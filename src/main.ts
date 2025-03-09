import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AuthExceptionFilter } from "./auth/auth.controller";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  // Registrar filtro de excepciones global
  app.useGlobalFilters(new AuthExceptionFilter());

  // Configurar CORS - Permitir todos los orígenes en desarrollo
  app.enableCors({
    origin: true, // Permitir todos los orígenes
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  
  // Configurar prefijo global para la API
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`✅ Servidor corriendo en el puerto ${port}`);
  console.log(`✅ CORS configurado para permitir todos los orígenes`);
}

bootstrap();
