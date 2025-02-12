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

  // ✅ Mostrar todas las rutas registradas sin errores
  const server = app.getHttpAdapter();
  const routes = server.getInstance()._router.stack
    .filter((r) => r.route)
    .map((r) => r.route.path);

  Logger.log("🔍 Rutas registradas en NestJS:", "Bootstrap");
  Logger.log(routes, "Bootstrap");
}
bootstrap();
