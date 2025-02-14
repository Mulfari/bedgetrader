import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import fetch from "node-fetch";
import * as crypto from "crypto";
import { HttpsProxyAgent } from "https-proxy-agent";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    try {
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, name: true, exchange: true, apiKey: true, apiSecret: true },
      });

      const subAccountsWithBalance = await Promise.all(
        subAccounts.map(async (account) => {
          if (account.exchange === "bybit") {
            const balance = await this.getBybitBalance(account.apiKey, account.apiSecret);
            return { id: account.id, name: account.name, exchange: account.exchange, balance };
          }
          return { id: account.id, name: account.name, exchange: account.exchange, balance: null };
        })
      );

      return subAccountsWithBalance;
    } catch (error) {
      console.error("❌ Error obteniendo subcuentas:", error);
      throw new UnauthorizedException("Error obteniendo subcuentas");
    }
  }

  async getBybitBalance(apiKey: string, apiSecret: string) {
    const API_URL = "https://api-testnet.bybit.com/v5/account/wallet-balance";
    const accountType = "UNIFIED";
    const timestamp = Date.now().toString();
    const recvWindow = "5000";
    const queryString = `accountType=${accountType}`;

    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(timestamp + apiKey + recvWindow + queryString)
      .digest("hex");

    const proxyAgent = new HttpsProxyAgent(
      "http://brd-customer-hl_41a62a42-zone-datacenter_proxy1-country-us:0emxj5daikfp@brd.superproxy.io:33335"
    );

    try {
      const response = await fetch(`${API_URL}?${queryString}`, {
        method: "GET",
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
          "Content-Type": "application/json",
        },
        agent: proxyAgent,
      });

      const textResponse = await response.text(); // Primero obtenemos la respuesta como texto

      console.log("🔍 Respuesta cruda de Bybit:", textResponse); // 👀 Ver la respuesta sin procesar

      if (!textResponse) {
        throw new Error("Bybit devolvió una respuesta vacía.");
      }

      const data = JSON.parse(textResponse); // Intentamos parsear el JSON
      console.log("🔍 Respuesta de Bybit parseada:", data);

      if (data.retCode !== 0) {
        throw new Error(`Error en la API de Bybit: ${data.retMsg}`);
      }

      const balance = data.result?.list?.[0]?.totalWalletBalance || null;
      return balance;
    } catch (error) {
      console.error("❌ Error obteniendo balance de Bybit:", error);
      return null;
    }
  }
}
