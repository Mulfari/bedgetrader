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
      isSimulated: true,
      isDebug: false, // Añadir propiedad isDebug con valor por defecto false
      isDemo: false   // Añadir propiedad isDemo con valor por defecto false
    };
  }

  // Método para obtener balance del exchange
  private async getExchangeBalance(subaccount: SubAccount): Promise<any> {
    console.log(`🔍 Obteniendo balance para ${subaccount.exchange} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
    
    // Verificar que tenemos las credenciales necesarias
    if (!subaccount.apiKey || !subaccount.apiSecret) {
      console.error('❌ Faltan credenciales de API para la subcuenta');
      throw new Error('Faltan credenciales de API pasra la subcuenta');
    }
    
    // Por ahora solo soportamos Bybit
    if (subaccount.exchange.toLowerCase() === 'bybit') {
      console.log(`🔍 Usando método específico para Bybit (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
      return this.getBybitBalance(subaccount);
    } else {
      console.error(`❌ Exchange ${subaccount.exchange} no soportado`);
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
      // Usar el mismo tipo de cuenta UNIFIED para todas las cuentas (reales y demo)
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
      // Usar la URL correcta según si es una cuenta demo o real
      const baseUrl = subaccount.isDemo 
        ? "https://api-demo.bybit.com"  // URL para cuentas demo (api-demo)
        : "https://api.bybit.com";      // URL para cuentas reales
      
      const url = `${baseUrl}/v5/account/wallet-balance`;
      
      console.log(`📡 Enviando solicitud a Bybit (${subaccount.isDemo ? 'DEMO' : 'REAL'}): ${url}`);

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
      
      // Verificar si hay datos en el resultado
      if (!result || !result.list || result.list.length === 0) {
        console.error('❌ No se encontraron datos de balance en la respuesta de Bybit');
        throw new Error('No se encontraron datos de balance en la respuesta de Bybit');
      }
      
      // Obtener el primer elemento de la lista (cuenta UNIFIED)
      const accountData = result.list[0];
      
      // Verificar si hay datos de la cuenta
      if (!accountData || !accountData.coin || !Array.isArray(accountData.coin)) {
        console.error('❌ Estructura de datos inesperada en la respuesta de Bybit');
        throw new Error('Estructura de datos inesperada en la respuesta de Bybit');
      }
      
      // Calcular el balance total sumando los usdValue de todas las monedas
      let totalBalance = 0;
      const assets: Array<{coin: string; walletBalance: number; usdValue: number}> = [];
      
      // Procesar cada moneda
      accountData.coin.forEach(coin => {
        // Verificar si la moneda tiene un valor en USD
        const usdValue = parseFloat(coin.usdValue || '0');
        
        // Sumar al balance total
        totalBalance += usdValue;
        
        // Solo incluir monedas con balance positivo
        if (usdValue > 0 || parseFloat(coin.walletBalance || '0') > 0) {
          assets.push({
            coin: coin.coin,
            walletBalance: parseFloat(coin.walletBalance || '0'),
            usdValue: usdValue
          });
        }
      });
      
      console.log(`✅ Balance total calculado: ${totalBalance}`);
      console.log(`✅ Activos procesados: ${assets.length}`);
      
      return {
        balance: totalBalance,
        assets,
        performance: 0, // Bybit no proporciona rendimiento directamente
        isSimulated: false,
        isDemo: subaccount.isDemo // Indicar si es una cuenta demo
      };
    } catch (error) {
      console.error(`❌ Error al obtener balance de Bybit:`, error.message);
      throw error;
    }
  }

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getSubAccountBalance(id: string, userId: string): Promise<any> {
    try {
      console.log(`🔍 Iniciando getSubAccountBalance para subcuenta ${id}, usuario ${userId}`);
      
      const subaccount = await this.findOne(id, userId);
      
      if (!subaccount) {
        console.error(`❌ Subcuenta ${id} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      console.log(`✅ Subcuenta encontrada: ${JSON.stringify({
        id: subaccount.id,
        exchange: subaccount.exchange,
        isDemo: subaccount.isDemo,
        apiKey: subaccount.apiKey ? `${subaccount.apiKey.substring(0, 5)}...` : 'no-key'
      })}`);
      
      // IMPORTANTE: Siempre intentamos obtener datos reales, tanto para cuentas demo como reales
      console.log(`🔍 Obteniendo balance para cuenta ${id} en ${subaccount.exchange} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
      
      try {
        // Intentar obtener el balance real
        const balance = await this.getExchangeBalance(subaccount);
        console.log(`✅ Balance obtenido correctamente para subcuenta: ${id}`);
        
        // Si es una cuenta demo, marcamos los datos
        if (subaccount.isDemo) {
          balance.isDemo = true;
        }
        
        return balance;
      } catch (exchangeError) {
        console.error(`❌ Error al obtener balance de ${subaccount.exchange}:`, exchangeError.message);
        
        // Si el error es de restricción geográfica, intentar con el proxy
        if (exchangeError.message?.includes('ubicación geográfica') || 
            exchangeError.message?.includes('CloudFront') || 
            exchangeError.response?.status === 403) {
          console.log('⚠️ Detectada restricción geográfica, intentando con proxy alternativo...');
          
          try {
            console.log(`🔄 Llamando a getExchangeBalanceViaProxy para ${id}...`);
            const balanceViaProxy = await this.getExchangeBalanceViaProxy(subaccount);
            console.log(`✅ Balance obtenido vía proxy para subcuenta: ${id}`);
            
            // Si es una cuenta demo, marcamos los datos
            if (subaccount.isDemo) {
              balanceViaProxy.isDemo = true;
            }
            
            return balanceViaProxy;
          } catch (proxyError) {
            console.error('❌ Error al intentar con proxy:', proxyError.message);
            
            // Si es una cuenta demo y fallaron todos los intentos, generar datos simulados como último recurso
            if (subaccount.isDemo) {
              console.log(`⚠️ Cuenta demo ${id}: Generando datos simulados como último recurso.`);
              const simulatedData = this.generateSimulatedData();
              simulatedData.isDemo = true;
              return simulatedData;
            }
            
            // Para cuentas reales, lanzar el error
            throw new HttpException(
              'No se pudo obtener el balance real de la cuenta, incluso usando métodos alternativos. Por favor verifica tus credenciales de API.',
              HttpStatus.BAD_REQUEST
            );
          }
        }
        
        // Si es una cuenta demo y falló el intento principal, generar datos simulados como último recurso
        if (subaccount.isDemo) {
          console.log(`⚠️ Cuenta demo ${id}: Generando datos simulados como último recurso.`);
          const simulatedData = this.generateSimulatedData();
          simulatedData.isDemo = true;
          return simulatedData;
        }
        
        // Para cuentas reales, lanzar el error
        console.error(`❌ Error obteniendo balance para subcuenta ${id}:`, exchangeError.message);
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

  // Método para obtener balance a través de un proxy
  private async getExchangeBalanceViaProxy(subaccount: SubAccount): Promise<any> {
    // Implementación temporal que devuelve datos simulados para depuración
    console.log(`🔄 Método getExchangeBalanceViaProxy llamado para ${subaccount.exchange} (${subaccount.isDemo ? 'DEMO' : 'REAL'})...`);
    
    try {
      // 🔹 Configurar proxy alternativo (usando un proxy diferente)
      const proxyAgent = new HttpsProxyAgent(
        "http://spj4f84ugp:cquYV74a4kWrct_V9h@us.smartproxy.com:20001" // Usar servidor en US
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

      console.log(`🔍 String para firmar (proxy): ${signPayload}`);
      console.log(`🔍 Firma generada (proxy): ${signature}`);

      // 🔹 Headers actualizados para Bybit V5
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // 🔹 URL de Bybit para obtener el balance
      // Usar la URL correcta según si es una cuenta demo o real
      const baseUrl = subaccount.isDemo 
        ? "https://api-demo.bybit.com"  // URL para cuentas demo (api-demo)
        : "https://api.bybit.com";      // URL para cuentas reales
      
      const url = `${baseUrl}/v5/account/wallet-balance`;
      
      console.log(`📡 Enviando solicitud a Bybit vía proxy alternativo (${subaccount.isDemo ? 'DEMO' : 'REAL'}): ${url}`);

      // 🔹 Hacer la solicitud a Bybit con tiempo de espera
      const axiosConfig = {
        headers,
        params: queryParams,
        httpsAgent: proxyAgent,
        timeout: 8000, // 🔹 Timeout más largo para el proxy alternativo
      };

      const response = await axios.get(url, axiosConfig);

      console.log(`📡 Respuesta de Bybit vía proxy:`, JSON.stringify(response.data, null, 2));

      if (!response.data || response.data.retCode !== 0) {
        console.error(`❌ Error en Bybit vía proxy: ${response.data.retMsg} (Código: ${response.data.retCode})`);
        throw new Error(`Error en Bybit vía proxy: ${response.data.retMsg}`);
      }

      // Procesar la respuesta para extraer el balance total y los activos
      const result = response.data.result;
      
      // Verificar si hay datos en el resultado
      if (!result || !result.list || result.list.length === 0) {
        console.error('❌ No se encontraron datos de balance en la respuesta de Bybit vía proxy');
        throw new Error('No se encontraron datos de balance en la respuesta de Bybit vía proxy');
      }
      
      // Obtener el primer elemento de la lista (cuenta UNIFIED)
      const accountData = result.list[0];
      
      // Verificar si hay datos de la cuenta
      if (!accountData || !accountData.coin || !Array.isArray(accountData.coin)) {
        console.error('❌ Estructura de datos inesperada en la respuesta de Bybit vía proxy');
        throw new Error('Estructura de datos inesperada en la respuesta de Bybit vía proxy');
      }
      
      // Calcular el balance total sumando los usdValue de todas las monedas
      let totalBalance = 0;
      const assets: Array<{coin: string; walletBalance: number; usdValue: number}> = [];
      
      // Procesar cada moneda
      accountData.coin.forEach(coin => {
        // Verificar si la moneda tiene un valor en USD
        const usdValue = parseFloat(coin.usdValue || '0');
        
        // Sumar al balance total
        totalBalance += usdValue;
        
        // Solo incluir monedas con balance positivo
        if (usdValue > 0 || parseFloat(coin.walletBalance || '0') > 0) {
          assets.push({
            coin: coin.coin,
            walletBalance: parseFloat(coin.walletBalance || '0'),
            usdValue: usdValue
          });
        }
      });
      
      console.log(`✅ Balance total calculado vía proxy: ${totalBalance}`);
      console.log(`✅ Activos procesados vía proxy: ${assets.length}`);
      
      return {
        balance: totalBalance,
        assets,
        performance: 0, // Bybit no proporciona rendimiento directamente
        isSimulated: false,
        isDemo: subaccount.isDemo // Indicar si es una cuenta demo
      };
    } catch (error) {
      console.error(`❌ Error al obtener balance vía proxy:`, error.message);
      
      // Si es una cuenta demo, generar datos simulados como fallback
      if (subaccount.isDemo) {
        console.log(`⚠️ Generando datos simulados como fallback para cuenta demo...`);
        const simulatedData = this.generateSimulatedData();
        simulatedData.isDemo = true;
        return simulatedData;
      }
      
      // Para cuentas reales, propagar el error
      throw error;
    }
  }
}
