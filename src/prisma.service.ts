import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    console.log("🔌 Conectando a la base de datos...");
    await this.$connect();
  }

  async onModuleDestroy() {
    console.log("⚡ Desconectando de la base de datos...");
    await this.$disconnect();
  }
}
