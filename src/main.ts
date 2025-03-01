import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  // 🔹 Definir orígenes permitidos dinámicamente
  const allowedOrigins = [
    "https://edgetrader.vercel.app",    // Producción
    "http://localhost:3000",            // Desarrollo local
    "http://localhost:3001",            // Desarrollo local alternativo
  ];

  // 🔹 Configuración CORS más específica
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir solicitudes sin origen (como las de Postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`❌ Origen bloqueado: ${origin}`);
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-BAPI-SIGN",
      "X-BAPI-API-KEY",
      "X-BAPI-TIMESTAMP",
      "X-BAPI-RECV-WINDOW"
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✅ Servidor corriendo en el puerto ${port}`);
}

bootstrap();
