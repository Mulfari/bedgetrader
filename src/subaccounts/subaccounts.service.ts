import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';
// Comentamos la importación que causa problemas y usamos axios directamente
// import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { SubAccount } from '@prisma/client';

@Injectable()
export class SubaccountsService {
  constructor(
    private prisma: PrismaService,
    // private readonly httpService: HttpService, // Comentamos este servicio
    private readonly configService: ConfigService,
  ) {}

  // ✅ Obtener subcuentas del usuario autenticado
  async getSubAccounts(userId: string) {
    try {
      console.log(`🔍 Buscando subcuentas para el usuario con ID: ${userId}`);
      const subAccounts = await this.prisma.subAccount.findMany({ 
        where: { userId },
        include: { user: true } // Incluir datos del usuario relacionado
      });
      console.log(`✅ Se encontraron ${subAccounts.length} subcuentas`);
      return subAccounts;
    } catch (error) {
      console.error('❌ Error detallado al obtener subcuentas:', error);
      throw new HttpException(
        `Error al obtener subcuentas: ${error.message || 'Error desconocido'}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ✅ Obtener las API keys de una subcuenta
  async getSubAccountKeys(subAccountId: string, userId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId },
      });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return { apiKey: subAccount.apiKey, apiSecret: subAccount.apiSecret };
    } catch (error) {
      throw new HttpException('Error obteniendo API keys', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Método para buscar una subcuenta específica
  async findOne(id: string, userId: string): Promise<SubAccount | null> {
    try {
      return await this.prisma.subAccount.findFirst({
        where: { 
          id,
          userId 
        }
      });
    } catch (error) {
      console.error(`❌ Error al buscar subcuenta ${id}:`, error.message);
      throw new HttpException('Error al buscar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Método para generar datos simulados
  private generateSimulatedData() {
    const balance = Math.random() * 10000;
    const performance = (Math.random() * 20) - 10; // Entre -10% y +10%
    
    // Generar algunos activos simulados
    const assets: Array<{coin: string; walletBalance: number; usdValue: number}> = [
      { coin: 'BTC', walletBalance: Math.random() * 0.5, usdValue: Math.random() * 2000 },
      { coin: 'ETH', walletBalance: Math.random() * 5, usdValue: Math.random() * 1500 },
      { coin: 'USDT', walletBalance: Math.random() * 5000, usdValue: Math.random() * 5000 }
    ];
    
    return {
      balance,
      performance,
      assets,
      isSimulated: true
    };
  }

  // Método para obtener balance del exchange
  private async getExchangeBalance(subaccount: SubAccount): Promise<any> {
    if (subaccount.exchange.toLowerCase() === 'bybit') {
      return this.getBybitBalance(subaccount);
    } else {
      throw new Error(`Exchange ${subaccount.exchange} no soportado`);
    }
  }

  // Método para obtener balance de Bybit
  private async getBybitBalance(subaccount: SubAccount): Promise<any> {
    try {
      // 🔹 Configurar proxy
      const proxyAgent = new HttpsProxyAgent(
        "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001"
      );

      // 🔹 Parámetros de autenticación
      const timestamp = Date.now().toString();
      const apiKey = subaccount.apiKey;
      const apiSecret = subaccount.apiSecret;
      const recvWindow = "5000";

      // 🔹 QueryString requerido por Bybit V5
      const queryParams = { accountType: "UNIFIED" };
      const queryString = new URLSearchParams(queryParams).toString();

      // 🔹 Crear el string para firmar
      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');

      console.log(`🔍 String para firmar: ${signPayload}`);
      console.log(`🔍 Firma generada: ${signature}`);

      // 🔹 Headers actualizados para Bybit V5
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // 🔹 URL de Bybit para obtener el balance
      const url = `https://api.bybit.com/v5/account/wallet-balance`;

      console.log("📡 Enviando solicitud a Bybit...");

      // 🔹 Hacer la solicitud a Bybit con tiempo de espera
      const axiosConfig = {
        headers,
        params: queryParams,
        httpsAgent: proxyAgent,
        timeout: 5000, // 🔹 Timeout de 5 segundos para evitar esperas largas
      };

      const response = await axios.get(url, axiosConfig);

      console.log(`📡 Respuesta de Bybit:`, JSON.stringify(response.data, null, 2));

      if (!response.data || response.data.retCode !== 0) {
        console.error(`❌ Error en Bybit: ${response.data.retMsg} (Código: ${response.data.retCode})`);
        throw new Error(`Error en Bybit: ${response.data.retMsg}`);
      }

      // Procesar la respuesta para extraer el balance total y los activos
      const result = response.data.result;
      const totalBalance = result.totalEquity || result.totalWalletBalance || 0;
      const assets: Array<{coin: string; walletBalance: number; usdValue: number}> = [];

      // Extraer los activos si están disponibles
      if (result.coin && Array.isArray(result.coin)) {
        result.coin.forEach(coin => {
          if (coin.walletBalance > 0) {
            assets.push({
              coin: coin.coin,
              walletBalance: parseFloat(coin.walletBalance),
              usdValue: parseFloat(coin.usdValue || 0)
            });
          }
        });
      }

      return {
        balance: parseFloat(totalBalance),
        assets,
        performance: 0, // Bybit no proporciona rendimiento directamente
        isSimulated: false
      };
    } catch (error) {
      console.error(`❌ Error al obtener balance de Bybit:`, error.message);
      throw error;
    }
  }

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getSubAccountBalance(id: string, userId: string): Promise<any> {
    try {
      const subaccount = await this.findOne(id, userId);
      
      if (!subaccount) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      if (subaccount.isDemo) {
        console.log(`⚠️ Cuenta demo ${id}: Generando datos simulados.`);
        return this.generateSimulatedData();
      }
      
      try {
        console.log(`🔍 Obteniendo balance real para cuenta ${id} en ${subaccount.exchange}`);
        
        // Intentar obtener el balance real
        const balance = await this.getExchangeBalance(subaccount);
        return balance;
      } catch (error) {
        // Si el error es de restricción geográfica, intentar con el proxy
        if (error.message?.includes('ubicación geográfica') || 
            error.message?.includes('CloudFront') || 
            error.response?.status === 403) {
          console.log('⚠️ Detectada restricción geográfica, intentando con proxy alternativo...');
          try {
            const balanceViaProxy = await this.getExchangeBalanceViaProxy(subaccount);
            return balanceViaProxy;
          } catch (proxyError) {
            console.error('❌ Error al intentar con proxy:', proxyError.message);
            throw new HttpException(
              'No se pudo obtener el balance real de la cuenta, incluso usando métodos alternativos. Por favor verifica tus credenciales de API.',
              HttpStatus.BAD_REQUEST
            );
          }
        }
        
        // Para cuentas reales, no generar datos simulados, lanzar el error
        console.error(`❌ Error obteniendo balance para subcuenta ${id}:`, error.message);
        throw new HttpException(
          `No se pudo obtener el balance real de la cuenta. Por favor verifica tus credenciales de API y que la cuenta tenga permisos de lectura.`,
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      console.error(`❌ Error en getSubAccountBalance:`, error.message);
      throw error;
    }
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, exchange: string, apiKey: string, apiSecret: string, name: string, isDemo: boolean = false) {
    try {
      console.log(`🔹 Creando subcuenta para usuario: ${userId}`);
      console.log(`🔹 Datos: exchange=${exchange}, name=${name}, apiKey=${apiKey.substring(0, 5)}..., isDemo=${isDemo}`);
      
      // Verificar que el usuario existe antes de crear la subcuenta
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        console.error(`❌ Usuario con ID ${userId} no encontrado`);
        throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }
      
      const newSubAccount = await this.prisma.subAccount.create({
        data: { 
          userId, 
          exchange, 
          apiKey, 
          apiSecret, 
          name,
          isDemo // Usar el valor proporcionado en lugar de hardcodearlo como true
        },
        include: { user: true } // Incluir datos del usuario relacionado
      });
      
      console.log(`✅ Subcuenta creada con éxito: ${newSubAccount.id}`);
      return newSubAccount;
    } catch (error) {
      console.error('❌ Error detallado al crear subcuenta:', error);
      
      // Manejar errores específicos de Prisma
      if (error.code) {
        console.error(`❌ Código de error Prisma: ${error.code}`);
        
        if (error.code === 'P2003') {
          throw new HttpException('Error de clave foránea: el usuario no existe', HttpStatus.BAD_REQUEST);
        }
      }
      
      throw new HttpException(
        `Error al crear subcuenta: ${error.message || 'Error desconocido'}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ✅ Actualizar una subcuenta existente
  async updateSubAccount(id: string, userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.update({
        where: { id },
        data: { exchange, apiKey, apiSecret, name },
      });
    } catch (error) {
      throw new HttpException('Error al actualizar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Eliminar una subcuenta
  async deleteSubAccount(id: string, userId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.delete({ where: { id } });
    } catch (error) {
      throw new HttpException('Error al eliminar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Nuevo método para obtener balance a través de un proxy
  private async getExchangeBalanceViaProxy(subaccount: SubAccount): Promise<any> {
    // Aquí implementaríamos la lógica para usar un proxy o servicio alternativo
    // Esta es una implementación de ejemplo que podría adaptarse según tus necesidades
    
    const proxyUrl = this.configService.get('PROXY_SERVICE_URL');
    if (!proxyUrl) {
      throw new Error('No hay configurado un servicio de proxy alternativo');
    }
    
    try {
      console.log(`🔄 Intentando obtener balance a través de proxy para ${subaccount.exchange}...`);
      
      // Usar axios directamente en lugar de httpService
      const response = await axios.post(`${proxyUrl}/proxy/bybit/balance`, {
        apiKey: subaccount.apiKey,
        secretKey: subaccount.apiSecret,
        exchange: subaccount.exchange
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Error al usar el servicio proxy:', error.message);
      throw error;
    }
  }
}
