import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module"; // ✅ Importamos AuthModule
import { PrismaService } from "./prisma.service"; // ✅ Importamos PrismaService
import { SubaccountsModule } from "./subaccounts/subaccounts.module"; // ✅ Importamos SubaccountsModule
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { ProxyTestModule } from './proxy-test/proxy-test.module';

@Module({
  imports: [
    ConfigModule.forRoot(), // ✅ Carga variables de entorno
    AuthModule, // ✅ Módulo de autenticación
    SubaccountsModule,
    ProxyTestModule, // ✅ Módulo de subcuentas
    JwtModule.register({
      secret: process.env.JWT_SECRET || "default_secret", // ✅ Usa JWT_SECRET del .env
      signOptions: { expiresIn: "7d" }, // ✅ Token válido por 7 días
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService], // ✅ Registramos PrismaService
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "https://edgetrader.vercel.app");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.header("Access-Control-Allow-Credentials", "true");

        if (req.method === "OPTIONS") {
          return res.sendStatus(200);
        }

        next();
      })
      .forRoutes("*");
  }
}
