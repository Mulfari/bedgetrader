import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { createHmac } from "crypto";
import fetch from "node-fetch";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({ where: { userId } });
    } catch (error) {
      console.error("❌ Error obteniendo subcuentas:", error);
      throw new HttpException("Error al obtener subcuentas", HttpStatus.BAD_REQUEST);
    }
  }

  async getSubAccountKeys(subAccountId: string, userId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId, userId },
      });

      if (!subAccount) throw new Error("Subcuenta no encontrada");
      return { apiKey: subAccount.apiKey, apiSecret: subAccount.apiSecret };
    } catch (error) {
      console.error("❌ Error obteniendo API Keys:", error);
      throw new HttpException("Error al obtener API Keys", HttpStatus.BAD_REQUEST);
    }
  }

  async getBybitBalance(subAccountId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id: subAccountId } });
      if (!subAccount) throw new Error("Subcuenta no encontrada");

      // 🔍 Si `exchange` está vacío, usa Testnet; si es "bybit", usa producción.
      const BASE_URL = subAccount.exchange === "bybit" ? "https://api.bybit.com" : "https://api-testnet.bybit.com";
      const endpoint = "/v5/account/wallet-balance?accountType=UNIFIED";
      const url = `${BASE_URL}${endpoint}`;

      console.log(`🔍 Consultando balance en: ${url} para subcuenta: ${subAccount.name}`);

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
      throw new HttpException("Error al obtener el balance de Bybit", HttpStatus.BAD_REQUEST);
    }
  }
}
