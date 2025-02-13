import { Injectable, NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as crypto from "crypto";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    const subAccounts = await this.prisma.subAccount.findMany({
      where: { userId },
      select: { id: true, name: true, exchange: true, apiKey: true, apiSecret: true },
    });

    if (subAccounts.length === 0) {
      throw new NotFoundException("No tienes subcuentas registradas.");
    }

    // Obtener balances de Bybit
    const subAccountsWithBalance = await Promise.all(
      subAccounts.map(async (sub) => {
        if (sub.exchange === "bybit") {
          const balance = await this.getBybitBalance(sub.apiKey, sub.apiSecret);
          return { id: sub.id, name: sub.name, exchange: sub.exchange, balance };
        }
        return { id: sub.id, name: sub.name, exchange: sub.exchange, balance: null };
      })
    );

    return subAccountsWithBalance;
  }

  // ✅ Función para obtener balance de Bybit
  async getBybitBalance(apiKey: string, apiSecret: string) {
    const baseUrl = "https://api-testnet.bybit.com";
    const endpoint = "/v5/account/wallet-balance";
    const accountType = "UNIFIED";
    const timestamp = Date.now().toString();
    const recvWindow = "5000";

    const queryString = `accountType=${accountType}`;
    const signaturePayload = `${timestamp}${apiKey}${recvWindow}${queryString}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(signaturePayload).digest("hex");

    try {
      const response = await fetch(`${baseUrl}${endpoint}?${queryString}`, {
        method: "GET",
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("❌ Error en la API de Bybit:", response.status, response.statusText);
        throw new InternalServerErrorException("Error consultando balance en Bybit.");
      }

      const data = await response.json();
      if (data.retCode !== 0) {
        console.error("❌ Error en respuesta de Bybit:", data.retMsg);
        throw new InternalServerErrorException("Bybit devolvió un error.");
      }

      const balance = data.result.list[0]?.totalWalletBalance || "0";
      return parseFloat(balance);
    } catch (error) {
      console.error("❌ Error obteniendo balance de Bybit:", error);
      return null;
    }
  }
}
