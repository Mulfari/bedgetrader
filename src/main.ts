import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  // 🔹 Definir orígenes permitidos dinámicamente
  const allowedOrigins = [
    "https://edgetrader.vercel.app", // Producción
    "http://localhost:3000", // Desarrollo
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("❌ CORS bloqueado para esta solicitud."));
      }
    },
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true, // Si usas cookies o headers de autenticación
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✅ Servidor corriendo en el puerto ${port}`);
}

bootstrap();
