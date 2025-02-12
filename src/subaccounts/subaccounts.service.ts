import { Injectable, UnauthorizedException, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as crypto from "crypto"; // Para firmar la solicitud a Bybit

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Método para crear una subcuenta en la base de datos
  async createSubAccount(userId: string, data: any) {
    try {
      return await this.prisma.subAccount.create({
        data: {
          userId,
          exchange: data.exchange,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          name: data.name,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException("Error creando subcuenta: " + error.message);
    }
  }

  // ✅ Método para obtener las subcuentas del usuario (sin apiSecret)
  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, exchange: true, apiKey: true, name: true },
      });
    } catch (error) {
      throw new InternalServerErrorException("Error obteniendo subcuentas: " + error.message);
    }
  }

  // ✅ Método para obtener balances desde Bybit
  async getSubAccountBalances(userId: string) {
    try {
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, name: true, apiKey: true, apiSecret: true },
      });

      if (!subAccounts.length) {
        throw new UnauthorizedException("No tienes subcuentas registradas.");
      }

      const balances = await Promise.all(
        subAccounts.map(async (sub) => {
          try {
            const balance = await this.getBybitBalance(sub.apiKey, sub.apiSecret);
            return { id: sub.id, name: sub.name, balance };
          } catch (error) {
            console.error(`❌ Error obteniendo balance de ${sub.name}:`, error.message);
            return { id: sub.id, name: sub.name, balance: "Error al obtener balance" };
          }
        })
      );

      return balances;
    } catch (error) {
      throw new InternalServerErrorException("Error obteniendo balances: " + error.message);
    }
  }

  // ✅ Método para consultar el balance en Bybit con firma corregida
  private async getBybitBalance(apiKey: string, apiSecret: string): Promise<number> {
    try {
      const endpoint = "https://api-testnet.bybit.com/v5/account/wallet-balance";
      const timestamp = Date.now().toString();
      const recvWindow = "5000";
      const params = { accountType: "UNIFIED" }; // 🔹 Parámetro requerido por Bybit

      // 🔥 Firma corregida según Bybit
      const queryString = JSON.stringify(params);
      const signString = timestamp + apiKey + recvWindow + queryString;
      const sign = crypto.createHmac("sha256", apiSecret).update(signString).digest("hex");

      // 🔄 Hacer la solicitud a Bybit con `POST`
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": sign,
        },
        body: queryString, // ✅ Enviar el JSON correctamente
      });

      // 🔍 Leer la respuesta sin procesar (para depuración)
      const text = await response.text();
      console.log("🔍 Respuesta de Bybit (RAW):", text);

      // 🔥 Intentar parsear la respuesta a JSON
      let data;
      try {
        data = JSON.parse(text);
        console.log("🔍 Respuesta de Bybit (JSON):", JSON.stringify(data, null, 2));
      } catch (error) {
        console.error("❌ Error al parsear JSON:", error.message);
        throw new InternalServerErrorException("Bybit devolvió una respuesta inválida.");
      }

      if (!response.ok || data.retCode !== 0) {
        throw new Error(`Error en la API de Bybit: ${data.retMsg || response.statusText}`);
      }

      // 📌 Extraer el balance en USDT
      const usdtBalance = data?.result?.list?.find((item: any) => item.coin === "USDT")?.walletBalance || 0;

      return parseFloat(usdtBalance);
    } catch (error) {
      console.error("❌ Error consultando balance en Bybit:", error.message);
      throw new InternalServerErrorException("Error consultando balance en Bybit.");
    }
  }
}
