import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as crypto from "crypto";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getBybitBalance(apiKey: string, apiSecret: string): Promise<number | null> {
    const baseUrl = "https://api-testnet.bybit.com";
    const endpoint = "/v5/account/wallet-balance";
    const accountType = "UNIFIED";

    const timestamp = Date.now().toString();
    const recvWindow = "5000";
    
    // 🔹 Firma HMAC
    const signaturePayload = `accountType=${accountType}&api_key=${apiKey}&recv_window=${recvWindow}&timestamp=${timestamp}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(signaturePayload).digest("hex");

    const url = `${baseUrl}${endpoint}?accountType=${accountType}&timestamp=${timestamp}&sign=${signature}`;

    console.log("🔍 URL final:", url);
    console.log("🔍 Firma HMAC:", signature);

    try {
      const proxyUrl = "http://brd.superproxy.io:33335";
      const proxyAuth = "brd-customer-hl_41a62a42-zone-datacenter_proxy1:0emxj5daikfp";

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": recvWindow,
          "X-BAPI-SIGN": signature,
          "Proxy-Authorization": "Basic " + Buffer.from(proxyAuth).toString("base64"),
        },
      });

      const data = await res.json();
      console.log("🔍 Respuesta de Bybit:", data);

      if (data.retCode !== 0) {
        console.error("❌ Error en la API de Bybit:", data.retMsg);
        return null;
      }

      const balance = data.result.list?.[0]?.totalWalletBalance || "0";
      return parseFloat(balance);
      
    } catch (error) {
      console.error("❌ Error obteniendo balance de Bybit:", error);
      return null;
    }
  }
}
