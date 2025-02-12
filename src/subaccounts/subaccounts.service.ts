import { Injectable, UnauthorizedException, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as crypto from "crypto"; // Para firmar la solicitud a Bybit

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async createSubAccount(userId: string, data: any) {
    try {
      return await this.prisma.subAccount.create({
        data: {
          userId,
          exchange: data.exchange,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret, // ⚠️ Solo en el backend, no exponer en frontend
          name: data.name,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException("Error creando subcuenta: " + error.message);
    }
  }

  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, exchange: true, apiKey: true, name: true }, // ⚠️ NO enviamos apiSecret al frontend
      });
    } catch (error) {
      throw new InternalServerErrorException("Error obteniendo subcuentas: " + error.message);
    }
  }

  // ✅ Nuevo método para obtener balances desde Bybit
  async getSubAccountBalances(userId: string) {
    try {
      // 1️⃣ Obtener todas las subcuentas del usuario
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, name: true, apiKey: true, apiSecret: true }, // ✅ Ahora sí obtenemos apiSecret
      });

      if (!subAccounts.length) {
        throw new UnauthorizedException("No tienes subcuentas registradas.");
      }

      // 2️⃣ Consultar el balance de cada subcuenta en Bybit
      const balances = await Promise.all(
        subAccounts.map(async (sub) => {
          try {
            const balance = await this.getBybitBalance(sub.apiKey, sub.apiSecret);
            return {
              id: sub.id,
              name: sub.name,
              balance,
            };
          } catch (error) {
            console.error(`❌ Error obteniendo balance de ${sub.name}:`, error.message);
            return {
              id: sub.id,
              name: sub.name,
              balance: "Error al obtener balance",
            };
          }
        })
      );

      return balances;
    } catch (error) {
      throw new InternalServerErrorException("Error obteniendo balances: " + error.message);
    }
  }

  // ✅ Método para consultar el balance en la API de Bybit usando `fetch`
  private async getBybitBalance(apiKey: string, apiSecret: string): Promise<number> {
    try {
      const endpoint = "https://api-testnet.bybit.com/v5/account/wallet-balance";
      const timestamp = Date.now().toString();
      const recvWindow = "5000";

      // 🔑 Crear firma para la autenticación en Bybit
      const params = `api_key=${apiKey}&timestamp=${timestamp}&recv_window=${recvWindow}`;
      const sign = crypto.createHmac("sha256", apiSecret).update(params).digest("hex");

      // 🔄 Hacer la solicitud a Bybit con `fetch`
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": sign,
        },
      });

      if (!response.ok) {
        throw new Error(`Error en la API de Bybit: ${response.statusText}`);
      }

      const data = await response.json();

      // 📌 Extraer el balance en USDT (o cambiar la moneda si es necesario)
      const usdtBalance = data?.result?.list?.find((item: any) => item.coin === "USDT")?.walletBalance || 0;

      return parseFloat(usdtBalance);
    } catch (error) {
      console.error("❌ Error consultando balance en Bybit:", error.message);
      throw new InternalServerErrorException("Error consultando balance en Bybit.");
    }
  }
}
