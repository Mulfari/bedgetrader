import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { createHmac } from "crypto";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
  async getSubAccounts(userId: string) {
    return this.prisma.subAccount.findMany({ where: { userId }, select: { id: true, exchange: true, name: true } });
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, data: { exchange: string; apiKey: string; apiSecret: string; name: string }) {
    return this.prisma.subAccount.create({ data: { ...data, userId } });
  }

  // ✅ Obtener las API Keys de una subcuenta (para la solicitud desde el frontend)
  async getSubAccountKeys(subAccountId: string, userId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({ where: { id: subAccountId, userId } });
    if (!subAccount) throw new Error("Subcuenta no encontrada");
    return { apiKey: subAccount.apiKey, apiSecret: subAccount.apiSecret };
  }

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getBybitBalance(subAccountId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id: subAccountId } });
      if (!subAccount) throw new Error("Subcuenta no encontrada");

      // 🔍 Determinar el entorno (Producción o Testnet)
      const BASE_URL =
        subAccount.exchange === "bybit"
          ? "https://api.bybit.com" // Producción
          : "https://api-testnet.bybit.com"; // Testnet por defecto

      const endpoint = "/v5/account/wallet-balance?accountType=UNIFIED";
      const url = `${BASE_URL}${endpoint}`;

      console.log(`🔍 Consultando balance en: ${url}`);

      // 🔑 Obtener las API Keys de la subcuenta
      const { apiKey, apiSecret } = subAccount;
      if (!apiKey || !apiSecret) throw new Error("API Key o Secret Key faltante");

      // 🔐 Generar firma HMAC
      const timestamp = Date.now().toString();
      const params = `accountType=UNIFIED`;
      const signMessage = `${timestamp}${apiKey}5000${params}`;
      const signature = createHmac("sha256", apiSecret).update(signMessage).digest("hex");

      // 🌍 Hacer la solicitud a Bybit
      const response = await fetch(`${url}&${params}`, {
        method: "GET",
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-SIGN": signature,
          "X-BAPI-RECV-WINDOW": "5000",
        },
      });

      const data = await response.json();
      if (data.retCode !== 0) throw new Error(`Error de Bybit: ${data.retMsg}`);

      console.log("✅ Balance obtenido:", data);
      return data.result;
    } catch (error) {
      console.error("❌ Error obteniendo balance de Bybit:", error);
      throw new Error("Error al obtener el balance de Bybit");
    }
  }

  // ✅ Eliminar una subcuenta
  async deleteSubAccount(subAccountId: string, userId: string) {
    return this.prisma.subAccount.deleteMany({ where: { id: subAccountId, userId } });
  }
}
