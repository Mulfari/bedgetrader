import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "*", // ⚠️ Para producción, cambiar a "https://edgetrader.vercel.app"
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
  });

  await app.listen(process.env.PORT || 3000);
  Logger.log(`✅ Servidor corriendo en el puerto ${process.env.PORT || 3000}`, "Bootstrap");

  // ✅ Obtener rutas correctamente en NestJS
  const httpServer = app.getHttpServer();
  const router = httpServer._events.request._router;
  const availableRoutes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
    }));

  Logger.log("🔍 Rutas registradas en NestJS:", "Bootstrap");
  console.table(availableRoutes);
}
bootstrap();
