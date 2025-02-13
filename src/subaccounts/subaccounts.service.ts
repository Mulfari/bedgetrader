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

    const subAccountsWithBalance = await Promise.all(
      subAccounts.map(async (sub) => {
        if (sub.exchange === "bybit") {
          console.log(`🔹 Consultando balance para: ${sub.name} (ID: ${sub.id})`);
          const balance = await this.getBybitBalance(sub.apiKey, sub.apiSecret);
          return { id: sub.id, name: sub.name, exchange: sub.exchange, balance };
        }
        return { id: sub.id, name: sub.name, exchange: sub.exchange, balance: null };
      })
    );

    console.log("✅ Subcuentas con balance obtenido:", subAccountsWithBalance);
    return subAccountsWithBalance;
  }

  // ✅ Función para obtener balance de Bybit con logs detallados
  async getBybitBalance(apiKey: string, apiSecret: string) {
    const baseUrl = "https://api-testnet.bybit.com";
    const endpoint = "/v5/account/wallet-balance";
    const accountType = "UNIFIED";
    const timestamp = Date.now().toString();
    const recvWindow = "5000";

    const queryString = `accountType=${accountType}`;
    const signaturePayload = `${timestamp}${apiKey}${recvWindow}${queryString}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(signaturePayload).digest("hex");

    const url = `${baseUrl}${endpoint}?${queryString}`;

    console.log("🔍 URL final:", url);
    console.log("🔍 Timestamp:", timestamp);
    console.log("🔍 Firma HMAC:", signature);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
          "Content-Type": "application/json",
        },
      });

      const textResponse = await response.text(); // 🔹 Obtener el texto en bruto
      console.log("🔍 Respuesta completa de Bybit:", textResponse);

      // Intentar parsear como JSON
      const data = JSON.parse(textResponse);

      if (!response.ok) {
        console.error("❌ Error en la API de Bybit:", response.status, response.statusText);
        throw new InternalServerErrorException("Error consultando balance en Bybit.");
      }

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
