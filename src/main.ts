import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  // ✅ Habilitar CORS (para permitir el frontend en Vercel)
  app.enableCors({
    origin: "*", // ⚠️ Para pruebas, luego cambiar a "https://edgetrader.vercel.app"
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
  });

  await app.listen(process.env.PORT || 3000);
  console.log("✅ Servidor corriendo en el puerto", process.env.PORT || 3000);
}
bootstrap();
