import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module"; // ✅ Importamos AuthModule
import { PrismaService } from "./prisma.service"; // ✅ Importamos PrismaService
import { SubaccountsModule } from "./subaccounts/subaccounts.module"; // ✅ Importamos SubaccountsModule
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { ProxyTestModule } from './proxy-test/proxy-test.module';
import { AccountDetailsModule } from './account-details/account-details.module';
import { MarketModule } from './market/market.module';
import { OrderbookModule } from './orderbook/orderbook.module'; // ✅ Importamos OrderbookModule

@Module({
  imports: [
    ConfigModule.forRoot(), // ✅ Carga variables de entorno
    AuthModule, // ✅ Módulo de autenticación
    SubaccountsModule,
    ProxyTestModule,
    AccountDetailsModule, // ✅ Módulo de subcuentas
    MarketModule,
    OrderbookModule, // ✅ Módulo de orderbook
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
        const allowedOrigins = [
          "https://edgetrader.vercel.app",
          "http://localhost:3000"
        ];
        const origin = req.headers.origin;
        
        if (origin && allowedOrigins.includes(origin)) {
          res.header("Access-Control-Allow-Origin", origin);
        }
        
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
