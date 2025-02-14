import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as crypto from "crypto";
import * as rp from "request-promise";
import tunnel from "tunnel"; // 📌 Necesario para manejar proxies con autenticación

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    try {
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, exchange: true, apiKey: true, apiSecret: true, name: true },
      });

      const subAccountsWithBalance = await Promise.all(
        subAccounts.map(async (sub) => {
          const balance = await this.getBybitBalance(sub.apiKey, sub.apiSecret);
          return { id: sub.id, name: sub.name, exchange: sub.exchange, balance };
        })
      );

      console.log("✅ Subcuentas con balance obtenido:", subAccountsWithBalance);
      return subAccountsWithBalance;
    } catch (error) {
      console.error("❌ Error obteniendo subcuentas:", error.message);
      throw new UnauthorizedException("No se pudieron obtener las subcuentas.");
    }
  }

  async getBybitBalance(apiKey: string, apiSecret: string): Promise<number | null> {
    const API_URL = "https://api-testnet.bybit.com/v5/account/wallet-balance?accountType=UNIFIED";

    const timestamp = Date.now().toString();
    const signaturePayload = `${timestamp}${apiKey}5000`;
    const signature = crypto.createHmac("sha256", apiSecret).update(signaturePayload).digest("hex");

    // 🔹 Configuración del proxy con túnel
    const proxyOptions = {
      proxy: {
        host: "brd.superproxy.io",
        port: 33335,
        proxyAuth: "brd-customer-hl_41a62a42-zone-datacenter_proxy1-country-us:0emxj5daikfp",
      },
    };

    const agent = tunnel.httpsOverHttp(proxyOptions); // 📌 Crear el túnel seguro

    const options = {
      uri: API_URL,
      method: "GET",
      headers: {
        "X-BAPI-API-KEY": apiKey,
        "X-BAPI-SIGN": signature,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": "5000",
      },
      agent, // 📌 Usa el túnel proxy
      json: true, // 📌 Parsea automáticamente la respuesta JSON
    };

    try {
      const response = await rp(options);
      console.log("🔍 Respuesta de Bybit:", response);
      return response?.result?.list?.[0]?.totalWalletBalance || null;
    } catch (error) {
      console.error("❌ Error obteniendo balance de Bybit:", error.message);
      return null;
    }
  }
}
