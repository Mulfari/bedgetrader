import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as crypto from "crypto";
import rp from "request-promise";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    try {
      // 🔹 Obtiene las subcuentas de la base de datos
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, exchange: true, apiKey: true, apiSecret: true, name: true },
      });

      // 🔹 Obtiene los balances de cada subcuenta
      const accountsWithBalance = await Promise.all(
        subAccounts.map(async (sub) => {
          const balance = await this.getBybitBalance(sub.apiKey, sub.apiSecret);
          return { id: sub.id, name: sub.name, exchange: sub.exchange, balance };
        })
      );

      console.log("✅ Subcuentas con balance obtenido:", accountsWithBalance);
      return accountsWithBalance;
    } catch (error) {
      console.error("❌ Error obteniendo subcuentas:", error);
      throw new Error("Error obteniendo subcuentas");
    }
  }

  async getBybitBalance(apiKey: string, apiSecret: string) {
    const baseUrl = "https://api-testnet.bybit.com";
    const endpoint = "/v5/account/wallet-balance";
    const queryString = "accountType=UNIFIED";
    const recvWindow = "5000";
    const timestamp = Date.now().toString();

    // 🔹 Generar firma HMAC
    const signature = this.generateSignature(apiSecret, timestamp, recvWindow, queryString);

    // 🔹 Configuración del proxy de Bright Data
    const proxyUrl = "http://brd-customer-hl_41a62a42-zone-datacenter_proxy1-country-us:0emxj5daikfp@brd.superproxy.io:33335";

    // 🔹 Opciones de la petición
    const options = {
      method: "GET",
      uri: `${baseUrl}${endpoint}?${queryString}`,
      headers: {
        "X-BAPI-API-KEY": apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recvWindow,
        "X-BAPI-SIGN": signature,
      },
      proxy: proxyUrl,
      json: true, // 🔹 Parsear automáticamente la respuesta a JSON
    };

    try {
      console.log("🔍 Consultando balance para:", options.uri);
      console.log("🔍 Firma HMAC:", signature);

      const response = await rp(options);
      console.log("✅ Respuesta de Bybit:", response);

      return response?.result?.list[0]?.totalWalletBalance || 0;
    } catch (error) {
      console.error("❌ Error obteniendo balance de Bybit:", error.message);
      return null;
    }
  }

  private generateSignature(apiSecret: string, timestamp: string, recvWindow: string, queryString: string): string {
    const preSign = `${timestamp}${apiSecret}${recvWindow}${queryString}`;
    return crypto.createHmac("sha256", apiSecret).update(preSign).digest("hex");
  }
}
