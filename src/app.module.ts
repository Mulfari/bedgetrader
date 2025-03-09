import { MiddlewareConsumer, Module, NestModule, Logger } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module"; // ✅ Importamos AuthModule
import { PrismaService } from "./prisma.service"; // ✅ Importamos PrismaService
import { SubaccountsModule } from "./subaccounts/subaccounts.module"; // ✅ Importamos SubaccountsModule
import { ConfigModule } from "@nestjs/config";
import { ProxyTestModule } from './proxy-test/proxy-test.module';
import { AccountDetailsModule } from './account-details/account-details.module';
import { MarketModule } from './market/market.module';
import { OrdersModule } from './orders/orders.module'; // ✅ Importamos OrdersModule

@Module({
  imports: [
    ConfigModule.forRoot(), // ✅ Carga variables de entorno
    AuthModule, // ✅ Módulo de autenticación
    SubaccountsModule,
    ProxyTestModule,
    AccountDetailsModule, // ✅ Módulo de subcuentas
    MarketModule,
    OrdersModule, // ✅ Módulo de órdenes
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService], // ✅ Registramos PrismaService
})
export class AppModule implements NestModule {
  private readonly logger = new Logger('HTTP');
  
  configure(consumer: MiddlewareConsumer) {
    // Middleware para depurar todas las solicitudes HTTP
    consumer
      .apply((req, res, next) => {
        // Log de la solicitud
        this.logger.log(`📝 ${req.method} ${req.originalUrl} - Body: ${JSON.stringify(req.body || {})}`);
        
        // Guardar el tiempo de inicio
        const start = Date.now();
        
        // Interceptar la respuesta
        const originalSend = res.send;
        res.send = function(body) {
          // Log de la respuesta
          const responseTime = Date.now() - start;
          const statusCode = res.statusCode;
          const statusText = statusCode >= 400 ? '❌' : '✅';
          
          // Intentar parsear el cuerpo de la respuesta
          let responseBody;
          try {
            responseBody = JSON.parse(body);
          } catch (e) {
            responseBody = body;
          }
          
          // Log detallado
          this.logger.log(`${statusText} ${req.method} ${req.originalUrl} - ${statusCode} - ${responseTime}ms`);
          
          // Si es un error, loguear más detalles
          if (statusCode >= 400) {
            this.logger.error(`Response: ${JSON.stringify(responseBody)}`);
          }
          
          // Continuar con la respuesta original
          return originalSend.call(this, body);
        }.bind(res);
        
        // CORS headers
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
