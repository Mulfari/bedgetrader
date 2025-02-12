import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("🔹 Iniciando servidor...");

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
  });

  // ✅ Muestra todas las rutas registradas
  const server = app.getHttpServer();
  const router = server._events.request._router;
  console.log("🔍 Rutas registradas en NestJS:");
  console.log(router.stack.map((r) => r.route?.path).filter(Boolean));

  await app.listen(process.env.PORT || 3000);
  console.log("✅ Servidor corriendo en el puerto", process.env.PORT || 3000);
}
bootstrap();
