import { Injectable, HttpException, HttpStatus, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';
// Comentamos la importación que causa problemas y usamos axios directamente
// import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { SubAccount } from '../types';

@Injectable()
export class SubaccountsService {
  private readonly logger = new Logger(SubaccountsService.name);

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

      return { apiKey: subAccount.apiKey, secretKey: subAccount.secretKey };
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
    // Generar un balance total entre 1,000 y 50,000 USD
    const balance = 1000 + Math.random() * 49000;
    
    // Rendimiento entre -15% y +25%
    const performance = (Math.random() * 40) - 15;
    
    // Lista de criptomonedas comunes con sus precios aproximados
    const cryptos = [
      { coin: 'BTC', price: 60000 + (Math.random() * 10000 - 5000) },
      { coin: 'ETH', price: 3000 + (Math.random() * 600 - 300) },
      { coin: 'USDT', price: 1 },
      { coin: 'USDC', price: 1 },
      { coin: 'BNB', price: 400 + (Math.random() * 80 - 40) },
      { coin: 'SOL', price: 120 + (Math.random() * 30 - 15) },
      { coin: 'XRP', price: 0.5 + (Math.random() * 0.2 - 0.1) },
      { coin: 'ADA', price: 0.4 + (Math.random() * 0.1 - 0.05) },
      { coin: 'DOGE', price: 0.1 + (Math.random() * 0.05 - 0.025) },
      { coin: 'SHIB', price: 0.00002 + (Math.random() * 0.00001 - 0.000005) }
    ];
    
    // Seleccionar entre 3 y 7 criptomonedas aleatorias
    const selectedCryptos = [...cryptos]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3 + Math.floor(Math.random() * 5));
    
    // Distribuir el balance total entre las criptomonedas seleccionadas
    let remainingBalance = balance;
    const assets: Array<{coin: string; walletBalance: number; usdValue: number}> = [];
    
    // Asignar entre 20% y 60% a stablecoins
    const stablecoins = selectedCryptos.filter(c => c.coin === 'USDT' || c.coin === 'USDC');
    if (stablecoins.length > 0) {
      const stablecoinAllocation = remainingBalance * (0.2 + Math.random() * 0.4);
      remainingBalance -= stablecoinAllocation;
      
      stablecoins.forEach(stable => {
        const allocation = stablecoinAllocation / stablecoins.length;
        assets.push({
          coin: stable.coin,
          walletBalance: allocation,
          usdValue: allocation
        });
      });
    }
    
    // Distribuir el resto entre las demás criptomonedas
    const nonStablecoins = selectedCryptos.filter(c => c.coin !== 'USDT' && c.coin !== 'USDC');
    if (nonStablecoins.length > 0) {
      nonStablecoins.forEach((crypto, index) => {
        // El último activo recibe el balance restante
        if (index === nonStablecoins.length - 1) {
          const usdValue = remainingBalance;
          const walletBalance = usdValue / crypto.price;
          assets.push({
            coin: crypto.coin,
            walletBalance,
            usdValue
          });
        } else {
          // Distribuir aleatoriamente entre los demás
          const allocation = remainingBalance * (0.1 + Math.random() * 0.3);
          remainingBalance -= allocation;
          
          const walletBalance = allocation / crypto.price;
          assets.push({
            coin: crypto.coin,
            walletBalance,
            usdValue: allocation
          });
        }
      });
    }
    
    // Ordenar por valor USD descendente
    assets.sort((a, b) => b.usdValue - a.usdValue);
    
    // Redondear valores para que sean más legibles
    assets.forEach(asset => {
      // Redondear cantidades según la moneda
      if (asset.coin === 'BTC') {
        asset.walletBalance = parseFloat(asset.walletBalance.toFixed(6));
      } else if (asset.coin === 'ETH' || asset.coin === 'BNB' || asset.coin === 'SOL') {
        asset.walletBalance = parseFloat(asset.walletBalance.toFixed(4));
      } else if (asset.coin === 'SHIB') {
        asset.walletBalance = parseFloat(asset.walletBalance.toFixed(0));
      } else {
        asset.walletBalance = parseFloat(asset.walletBalance.toFixed(2));
      }
      
      // Redondear valores USD
      asset.usdValue = parseFloat(asset.usdValue.toFixed(2));
    });
    
    console.log(`🤖 Datos simulados generados: $${balance.toFixed(2)} USD con ${assets.length} activos`);
    
    return {
      balance: parseFloat(balance.toFixed(2)),
      performance: parseFloat(performance.toFixed(2)),
      assets,
      isSimulated: true,
      isDemo: false,
      lastUpdate: Date.now()
    };
  }

  // Método para obtener balance del exchange
  private async getExchangeBalance(subaccount: SubAccount): Promise<any> {
    console.log(`🔍 Obteniendo balance para ${subaccount.exchange} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
    
    // Verificar que tenemos las credenciales necesarias
    if (!subaccount.apiKey || !subaccount.secretKey) {
      console.error('❌ Faltan credenciales de API para la subcuenta');
      throw new Error('Faltan credenciales de API pasra la subcuenta');
    }
    
    // Por ahora solo soportamos Bybit
    if (subaccount.exchange.toLowerCase() === 'bybit') {
      return this.getBybitBalance(subaccount);
    } else {
      console.error(`❌ Exchange ${subaccount.exchange} no soportado`);
      throw new Error(`Exchange ${subaccount.exchange} no soportado`);
    }
  }

  // Método para obtener balance de Bybit
  private async getBybitBalance(subaccount: SubAccount): Promise<any> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre reintentos
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 🔹 Configurar proxy
        const proxyUrl = "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001";
        
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // 🔹 Parámetros de autenticación
        const timestamp = Date.now().toString();
        const apiKey = subaccount.apiKey;
        const secretKey = subaccount.secretKey;
        const recvWindow = "5000";

        // 🔹 QueryString requerido por Bybit V5
        const queryParams = { accountType: "UNIFIED" };
        const queryString = new URLSearchParams(queryParams).toString();

        // 🔹 Crear el string para firmar
        const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
        const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

        // 🔹 Headers actualizados para Bybit V5
        const headers = {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        };

        // 🔹 URL de Bybit para obtener el balance
        const baseUrl = subaccount.isDemo 
          ? "https://api-demo.bybit.com"
          : "https://api.bybit.com";
        
        const url = `${baseUrl}/v5/account/wallet-balance`;

        // 🔹 Hacer la solicitud a Bybit con tiempo de espera
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 10000, // Aumentado a 10 segundos
        };

        const response = await axios.get(url, axiosConfig);
        
        // Si llegamos aquí, la solicitud fue exitosa
        if (!response.data || response.data.retCode !== 0) {
          const error = new Error(`Error en Bybit: ${response.data?.retMsg}`);
          error['bybitCode'] = response.data?.retCode;
          error['bybitMsg'] = response.data?.retMsg;
          throw error;
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
        
        // Mostrar un resumen del balance
        console.log(`✅ Balance de ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'}): $${totalBalance.toFixed(2)} USD con ${assets.length} activos`);
        
        // Mostrar los activos principales (top 3 por valor)
        if (assets.length > 0) {
          const topAssets = [...assets]
            .sort((a, b) => b.usdValue - a.usdValue)
            .slice(0, 3);
          
          console.log('📊 Activos principales:');
          console.table(topAssets.map(asset => ({
            Moneda: asset.coin,
            Cantidad: asset.walletBalance.toFixed(6),
            'Valor USD': asset.usdValue.toFixed(2)
          })));
        }
        
        return {
          balance: totalBalance,
          assets,
          performance: 0,
          isSimulated: false,
          isDemo: subaccount.isDemo,
          lastUpdate: Date.now()
        };
      } catch (error) {
        console.error(`❌ Error al obtener balance:`, error.message);

        // Si es el último intento, lanzar el error
        if (attempt === MAX_RETRIES) {
          // Si es un error de autenticación o permisos, no tiene sentido reintentar
          if (error.response?.status === 401 || error.response?.status === 403 || 
              error.bybitCode === 10003 || error.bybitCode === 10004) {
            throw new HttpException({
              message: 'Error de autenticación con Bybit',
              details: error.bybitMsg || error.message,
              code: error.bybitCode,
              status: error.response?.status
            }, HttpStatus.UNAUTHORIZED);
          }
          
          // Si es un error de rate limit, informar específicamente
          if (error.response?.status === 429 || error.bybitCode === 10006) {
            throw new HttpException({
              message: 'Demasiadas solicitudes a Bybit',
              details: 'Por favor, espera unos minutos antes de intentar nuevamente',
              code: error.bybitCode,
              status: 429
            }, HttpStatus.TOO_MANY_REQUESTS);
          }
          
          // Para otros errores
          throw new HttpException({
            message: 'Error al obtener balance de Bybit',
            details: error.bybitMsg || error.message,
            code: error.bybitCode,
            status: error.response?.status || 500
          }, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Esperar antes del siguiente intento
        console.log(`⏳ Esperando ${RETRY_DELAY/1000} segundos antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  // Obtener el balance de una subcuenta
  async getSubAccountBalance(id: string, userId: string): Promise<any> {
    try {
      console.log(`🔍 Obteniendo balance para subcuenta: ${id}`);
      
      // Buscar la subcuenta
      const subaccount = await this.findOne(id, userId);
      
      if (!subaccount) {
        console.error(`❌ Subcuenta ${id} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      try {
        // Intentar obtener el balance real
        const balance = await this.getExchangeBalance(subaccount);
        console.log(`✅ Balance obtenido para ${subaccount.name}: $${balance.balance.toFixed(2)} USD`);
        
        // Si es una cuenta demo, marcamos los datos
        if (subaccount.isDemo) {
          balance.isDemo = true;
        }
        
        return balance;
      } catch (exchangeError) {
        console.error(`❌ Error al obtener balance de ${subaccount.name} (${subaccount.exchange}):`, exchangeError.message);
        
        // Si el error es de restricción geográfica, intentar con el proxy
        if (exchangeError.message?.includes('ubicación geográfica') || 
            exchangeError.message?.includes('CloudFront') || 
            exchangeError.response?.status === 403) {
          console.log(`⚠️ Detectada restricción geográfica para ${subaccount.name}, intentando con proxy...`);
          
          try {
            const balanceViaProxy = await this.getExchangeBalanceViaProxy(subaccount);
            console.log(`✅ Balance obtenido vía proxy para ${subaccount.name}: $${balanceViaProxy.balance.toFixed(2)} USD`);
            
            // Si es una cuenta demo, marcamos los datos
            if (subaccount.isDemo) {
              balanceViaProxy.isDemo = true;
            }
            
            return balanceViaProxy;
          } catch (proxyError) {
            console.error(`❌ Error al intentar con proxy para ${subaccount.name}:`, proxyError.message);
            
            // Si es una cuenta demo y fallaron todos los intentos, generar datos simulados como último recurso
            if (subaccount.isDemo) {
              console.log(`⚠️ Generando datos simulados para cuenta demo: ${subaccount.name}`);
              const simulatedData = this.generateSimulatedData();
              simulatedData.isDemo = true;
              simulatedData.isSimulated = true;
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
          console.log(`⚠️ Generando datos simulados para cuenta demo: ${subaccount.name}`);
          const simulatedData = this.generateSimulatedData();
          simulatedData.isDemo = true;
          simulatedData.isSimulated = true;
          return simulatedData;
        }
        
        // Para cuentas reales, lanzar el error
        throw new HttpException(
          `No se pudo obtener el balance de ${subaccount.name}. Por favor verifica tus credenciales de API y que la cuenta tenga permisos de lectura.`,
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      console.error(`❌ Error al obtener balance:`, error.message);
      throw error;
    }
  }

  /**
   * Crea una nueva subcuenta para un usuario
   * @param userId ID del usuario
   * @param exchange Exchange de la subcuenta
   * @param apiKey API Key para el exchange
   * @param secretKey Secret Key para el exchange
   * @param name Nombre de la subcuenta
   * @param isDemo Indica si es una cuenta de demostración
   * @returns La subcuenta creada
   */
  async createSubAccount(
    userId: string, 
    exchange: string, 
    apiKey: string, 
    secretKey: string, 
    name: string, 
    isDemo: boolean = false
  ): Promise<SubAccount> {
    this.logger.log(`🔄 Creando subcuenta para usuario ${userId}:
      - Exchange: ${exchange}
      - Nombre: ${name}
      - API Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'No disponible'}
      - Demo: ${isDemo ? 'Sí' : 'No'}
    `);

    try {
      // Verificar que el usuario existe
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        this.logger.error(`❌ Usuario con ID ${userId} no encontrado`);
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      // Crear la subcuenta
      const subaccount = await this.prisma.subAccount.create({
        data: {
          userId,
          exchange,
          apiKey,
          secretKey,
          name,
          isDemo
        }
      });

      this.logger.log(`✅ Subcuenta creada exitosamente: ${subaccount.id}`);

      // Ya no obtenemos las posiciones cerradas automáticamente al crear la subcuenta
      // Esto se hará a través de un endpoint específico

      return subaccount;
    } catch (error) {
      // Manejar errores específicos de Prisma
      if (error.code === 'P2003') {
        this.logger.error(`❌ Error de clave foránea: ${error.message}`);
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }
      
      this.logger.error(`❌ Error al crear subcuenta:`, error);
      throw error;
    }
  }

  // ✅ Actualizar una subcuenta existente
  async updateSubAccount(id: string, userId: string, exchange: string, apiKey: string, secretKey: string, name: string): Promise<SubAccount> {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.update({
        where: { id },
        data: { exchange, apiKey, secretKey, name },
      });
    } catch (error) {
      throw new HttpException('Error al actualizar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Eliminar una subcuenta y todas sus posiciones asociadas
  async deleteSubAccount(id: string, userId: string) {
    this.logger.log(`🔄 Iniciando eliminación de subcuenta ${id} para usuario ${userId}`);
    
    try {
      // Verificar que la subcuenta existe y pertenece al usuario
      const subAccount = await this.prisma.subAccount.findUnique({ 
        where: { id },
        include: { positions: { select: { id: true } } } // Incluir solo los IDs de las posiciones para contar
      });

      if (!subAccount) {
        this.logger.error(`❌ Subcuenta ${id} no encontrada`);
        throw new NotFoundException('Subcuenta no encontrada');
      }

      if (subAccount.userId !== userId) {
        this.logger.error(`❌ La subcuenta ${id} no pertenece al usuario ${userId}`);
        throw new HttpException('No tienes permiso para eliminar esta subcuenta', HttpStatus.FORBIDDEN);
      }

      // Contar las posiciones asociadas
      const positionsCount = subAccount.positions ? subAccount.positions.length : 0;
      this.logger.log(`🔍 La subcuenta ${id} (${subAccount.name}) tiene ${positionsCount} posiciones asociadas que también serán eliminadas`);

      // Eliminar la subcuenta (las posiciones se eliminarán automáticamente por la relación onDelete: Cascade)
      const deletedSubAccount = await this.prisma.subAccount.delete({ 
        where: { id },
        include: { user: { select: { email: true } } } // Incluir email del usuario para el log
      });

      this.logger.log(`✅ Subcuenta ${deletedSubAccount.name} eliminada exitosamente junto con ${positionsCount} posiciones asociadas`);
      
      return {
        ...deletedSubAccount,
        positionsDeleted: positionsCount
      };
    } catch (error) {
      // Manejar errores específicos
      if (error instanceof NotFoundException || error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`❌ Error al eliminar subcuenta ${id}:`, error);
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
      const secretKey = subaccount.secretKey;
      const recvWindow = "5000";

      // 🔹 QueryString requerido por Bybit V5
      const queryParams = { accountType: "UNIFIED" };
      const queryString = new URLSearchParams(queryParams).toString();

      // 🔹 Crear el string para firmar
      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
      const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

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

  async getSubAccountCredentials(id: string): Promise<{ apiKey: string; secretKey: string }> {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { id },
      select: {
        apiKey: true,
        secretKey: true,
      },
    });

    if (!subAccount) {
      throw new NotFoundException('Subcuenta no encontrada');
    }

    return { apiKey: subAccount.apiKey, secretKey: subAccount.secretKey };
  }

  async validateSubAccountAccess(subaccount: SubAccount): Promise<boolean> {
    if (!subaccount.apiKey || !subaccount.secretKey) {
      throw new BadRequestException('Credenciales de API incompletas');
    }

    try {
      // Implementar la lógica de validación aquí
      return true;
    } catch (error) {
      throw new BadRequestException('Error al validar credenciales');
    }
  }

  async validateApiCredentials(subaccount: SubAccount): Promise<boolean> {
    try {
      // Implementar la lógica de validación aquí
      const timestamp = Date.now().toString();
      const signPayload = `${timestamp}${subaccount.apiKey}`;
      const signature = crypto.createHmac('sha256', subaccount.secretKey).update(signPayload).digest('hex');
      
      // Aquí iría la lógica de validación con el exchange
      return true;
    } catch (error) {
      throw new BadRequestException('Error al validar credenciales');
    }
  }

  // ✅ Obtener el historial de balances de una subcuenta
  async getSubAccountBalanceHistory(id: string, userId: string): Promise<any> {
    try {
      console.log(`🔍 Iniciando getSubAccountBalanceHistory para subcuenta ${id}, usuario ${userId}`);
      
      const subaccount = await this.findOne(id, userId);
      
      if (!subaccount) {
        console.error(`❌ Subcuenta ${id} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      // Por ahora, devolvemos un historial vacío ya que no tenemos implementada la persistencia del historial
      // TODO: Implementar la persistencia del historial de balances
      return {
        balance: 0,
        assetsCount: 0,
        performance: 0,
        historyLength: 0,
        history: []
      };
    } catch (error) {
      console.error(`❌ Error en getSubAccountBalanceHistory:`, error.message);
      throw error;
    }
  }

  /**
   * Obtiene las posiciones abiertas en perpetual para todas las subcuentas de Bybit (demo y reales)
   * @param userId ID del usuario
   * @returns Número de posiciones abiertas en perpetual para todas las subcuentas
   */
  async getBybitAllPerpetualPositions(userId: string): Promise<{ 
    totalPositions: number, 
    totalDemoPositions: number, 
    totalRealPositions: number, 
    subaccountsWithPositions: any[] 
  }> {
    try {
      console.log(`🔍 Obteniendo posiciones abiertas en perpetual para TODAS las cuentas del usuario: ${userId}`);
      
      // Obtener todas las subcuentas de Bybit del usuario (demo y reales)
      const subAccounts = await this.prisma.subAccount.findMany({
        where: {
          userId,
          exchange: 'bybit'
        }
      });
      
      console.log(`✅ Se encontraron ${subAccounts.length} subcuentas de Bybit (demo y reales)`);
      
      if (subAccounts.length === 0) {
        return { totalPositions: 0, totalDemoPositions: 0, totalRealPositions: 0, subaccountsWithPositions: [] };
      }
      
      // Array para almacenar resultados de cada subcuenta
      const subaccountsWithPositions = [];
      let totalPositions = 0;
      let totalDemoPositions = 0;
      let totalRealPositions = 0;
      
      // Procesar cada subcuenta
      for (const subAccount of subAccounts) {
        try {
          const positions = await this.getBybitPerpetualPositions(subAccount);
          
          // Contar posiciones abiertas
          const openPositions = positions.filter(pos => parseFloat(pos.size) !== 0);
          
          console.log(`✅ Subcuenta ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'}): ${openPositions.length} posiciones abiertas en perpetual`);
          
          // Actualizar contadores
          totalPositions += openPositions.length;
          if (subAccount.isDemo) {
            totalDemoPositions += openPositions.length;
          } else {
            totalRealPositions += openPositions.length;
          }
          
          // Agregar información de esta subcuenta
          subaccountsWithPositions.push({
            id: subAccount.id,
            name: subAccount.name,
            isDemo: subAccount.isDemo,
            openPositionsCount: openPositions.length
          });
        } catch (error) {
          console.error(`❌ Error al obtener posiciones para subcuenta ${subAccount.name}:`, error.message);
          
          // Agregar la subcuenta con error
          subaccountsWithPositions.push({
            id: subAccount.id,
            name: subAccount.name,
            isDemo: subAccount.isDemo,
            openPositionsCount: 0,
            error: error.message
          });
        }
      }
      
      console.log(`📊 Total de posiciones abiertas en perpetual: ${totalPositions}`);
      console.log(`📊 - En cuentas demo: ${totalDemoPositions}`);
      console.log(`📊 - En cuentas reales: ${totalRealPositions}`);
      
      return {
        totalPositions,
        totalDemoPositions,
        totalRealPositions,
        subaccountsWithPositions
      };
    } catch (error) {
      console.error('❌ Error al obtener posiciones abiertas en perpetual:', error);
      throw new HttpException(
        `Error al obtener posiciones abiertas en perpetual: ${error.message || 'Error desconocido'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene las posiciones abiertas en perpetual para las subcuentas demo de Bybit
   * @param userId ID del usuario
   * @returns Número de posiciones abiertas en perpetual para las subcuentas demo
   */
  async getBybitDemoPerpetualPositions(userId: string): Promise<{ totalPositions: number, subaccountsWithPositions: any[] }> {
    try {
      console.log(`🔍 Obteniendo posiciones abiertas en perpetual para cuentas DEMO del usuario: ${userId}`);
      
      // Obtener todas las subcuentas demo de Bybit del usuario
      const subAccounts = await this.prisma.subAccount.findMany({
        where: {
          userId,
          exchange: 'bybit',
          isDemo: true
        }
      });
      
      console.log(`✅ Se encontraron ${subAccounts.length} subcuentas demo de Bybit`);
      
      if (subAccounts.length === 0) {
        return { totalPositions: 0, subaccountsWithPositions: [] };
      }
      
      // Array para almacenar resultados de cada subcuenta
      const subaccountsWithPositions = [];
      let totalPositions = 0;
      
      // Procesar cada subcuenta
      for (const subAccount of subAccounts) {
        try {
          const positions = await this.getBybitPerpetualPositions(subAccount);
          
          // Contar posiciones abiertas
          const openPositions = positions.filter(pos => parseFloat(pos.size) !== 0);
          
          console.log(`✅ Subcuenta ${subAccount.name} (DEMO): ${openPositions.length} posiciones abiertas en perpetual`);
          
          // Actualizar contador total
          totalPositions += openPositions.length;
          
          // Agregar información de esta subcuenta
          subaccountsWithPositions.push({
            id: subAccount.id,
            name: subAccount.name,
            openPositionsCount: openPositions.length
          });
        } catch (error) {
          console.error(`❌ Error al obtener posiciones para subcuenta ${subAccount.name}:`, error.message);
          
          // Agregar la subcuenta con error
          subaccountsWithPositions.push({
            id: subAccount.id,
            name: subAccount.name,
            openPositionsCount: 0,
            error: error.message
          });
        }
      }
      
      console.log(`📊 Total de posiciones abiertas en perpetual en cuentas demo: ${totalPositions}`);
      
      return {
        totalPositions,
        subaccountsWithPositions
      };
    } catch (error) {
      console.error('❌ Error al obtener posiciones abiertas en perpetual para cuentas demo:', error);
      throw new HttpException(
        `Error al obtener posiciones abiertas en perpetual para cuentas demo: ${error.message || 'Error desconocido'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Obtiene las posiciones abiertas en perpetual para una subcuenta específica de Bybit
   * @param subaccount Subcuenta de Bybit
   * @returns Lista de posiciones abiertas en perpetual
   */
  private async getBybitPerpetualPositions(subaccount: any): Promise<any[]> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre reintentos
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 🔹 Configurar proxy
        const proxyUrl = "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001";
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // 🔹 Parámetros de autenticación
        const timestamp = Date.now().toString();
        const apiKey = subaccount.apiKey;
        const secretKey = subaccount.secretKey;
        const recvWindow = "5000";

        // 🔹 QueryString para obtener posiciones perpetual
        const queryParams = { 
          category: "linear", // Para futuros perpetuos lineales (USDT)
          settleCoin: "USDT" // Opcional: filtrar por moneda de liquidación
        };
        const queryString = new URLSearchParams(queryParams).toString();

        // 🔹 Crear el string para firmar
        const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
        const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

        // 🔹 Headers para Bybit V5
        const headers = {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        };

        // 🔹 URL de Bybit para obtener posiciones
        const baseUrl = subaccount.isDemo 
          ? "https://api-demo.bybit.com"
          : "https://api.bybit.com";
        
        const url = `${baseUrl}/v5/position/list`;

        // 🔹 Hacer la solicitud a Bybit
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 10000,
        };

        const response = await axios.get(url, axiosConfig);
        
        // Verificar respuesta
        if (!response.data || response.data.retCode !== 0) {
          const error = new Error(`Error en Bybit: ${response.data?.retMsg}`);
          error['bybitCode'] = response.data?.retCode;
          error['bybitMsg'] = response.data?.retMsg;
          throw error;
        }

        // Procesar la respuesta para extraer las posiciones
        const result = response.data.result;
        
        // Verificar si hay datos en el resultado
        if (!result || !result.list || !Array.isArray(result.list)) {
          console.error('❌ No se encontraron datos de posiciones en la respuesta de Bybit');
          return [];
        }
        
        // Devolver la lista de posiciones
        return result.list;
      } catch (error) {
        console.error(`❌ Error al obtener posiciones (intento ${attempt}/${MAX_RETRIES}):`, error.message);
        
        if (attempt < MAX_RETRIES) {
          console.log(`⏱️ Reintentando en ${RETRY_DELAY/1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        } else {
          throw error;
        }
      }
    }
    
    // Este return nunca debería ejecutarse debido al manejo de errores anterior
    return [];
  }

  /**
   * Obtiene las operaciones abiertas en perpetual para una subcuenta específica y las transforma al formato
   * que espera el componente Operations.tsx del frontend
   * @param subAccountId ID de la subcuenta
   * @param userId ID del usuario
   * @returns Lista de operaciones abiertas en perpetual formateadas para el frontend
   */
  async getSubAccountOpenPerpetualOperations(subAccountId: string, userId: string): Promise<any[]> {
    try {
      console.log(`🔍 Obteniendo operaciones abiertas en perpetual para subcuenta: ${subAccountId}`);
      
      // Buscar la subcuenta
      const subaccount = await this.findOne(subAccountId, userId);
      
      if (!subaccount) {
        console.error(`❌ Subcuenta ${subAccountId} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      // Verificar que sea una subcuenta de Bybit
      if (subaccount.exchange.toLowerCase() !== 'bybit') {
        console.error(`❌ Exchange ${subaccount.exchange} no soportado para obtener operaciones perpetual`);
        throw new HttpException(`Exchange ${subaccount.exchange} no soportado para obtener operaciones perpetual`, HttpStatus.BAD_REQUEST);
      }
      
      try {
        // Obtener posiciones abiertas en perpetual
        const positions = await this.getBybitPerpetualPositions(subaccount);
        
        // Filtrar solo las posiciones abiertas (size != 0)
        const openPositions = positions.filter(pos => parseFloat(pos.size) !== 0);
        
        console.log(`✅ Subcuenta ${subaccount.name}: ${openPositions.length} operaciones abiertas en perpetual`);
        
        // Transformar las posiciones al formato que espera el frontend
        const formattedOperations = openPositions.map(position => {
          // Añadir logs para depurar
          console.log(`🔍 Posición original:`, {
            symbol: position.symbol,
            size: position.size,
            positionSide: position.positionSide,
            positionIdx: position.positionIdx,
            side: position.side
          });
          
          // Calcular el lado (compra/venta) basado en el signo del tamaño
          const size = parseFloat(position.size);
          const side = size > 0 ? 'buy' : 'sell';
          
          console.log(`✅ Posición interpretada: Symbol=${position.symbol}, Size=${size}, Side=${side}`);
          
          // Calcular el beneficio no realizado en USD
          const unrealizedPnl = parseFloat(position.unrealisedPnl || '0');
          
          // Crear un ID único para la operación
          const operationId = `${subaccount.id}-${position.symbol}-${Date.now()}`;
          
          // Formatear la operación según la interfaz Operation del frontend
          return {
            id: operationId,
            subAccountId: subaccount.id,
            symbol: position.symbol,
            side: side,
            status: 'open',
            price: parseFloat(position.avgPrice || position.entryPrice),
            quantity: Math.abs(parseFloat(position.size)),
            leverage: parseFloat(position.leverage || '1'),
            openTime: new Date(parseInt(position.createdTime)),
            profit: unrealizedPnl,
            profitPercentage: parseFloat(position.unrealisedPnlPcnt || '0') * 100,
            exchange: subaccount.exchange,
            // Campos adicionales específicos de Bybit
            positionIdx: position.positionIdx,
            positionValue: parseFloat(position.positionValue || '0'),
            liqPrice: parseFloat(position.liqPrice || '0'),
            bustPrice: parseFloat(position.bustPrice || '0'),
            markPrice: parseFloat(position.markPrice || '0'),
            isIsolated: position.isIsolated === 'true',
            autoAddMargin: position.autoAddMargin === 'true',
            trailingStop: parseFloat(position.trailingStop || '0'),
            takeProfit: parseFloat(position.takeProfit || '0'),
            stopLoss: parseFloat(position.stopLoss || '0')
          };
        });
        
        return formattedOperations;
      } catch (error) {
        console.error(`❌ Error al obtener operaciones abiertas en perpetual:`, error.message);
        throw new HttpException(
          `Error al obtener operaciones abiertas en perpetual: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      console.error(`❌ Error en getSubAccountOpenPerpetualOperations:`, error.message);
      throw error;
    }
  }

  /**
   * Obtiene todas las operaciones abiertas en perpetual para todas las subcuentas de un usuario
   * @param userId ID del usuario
   * @returns Lista de operaciones abiertas en perpetual para todas las subcuentas
   */
  async getAllUserOpenPerpetualOperations(userId: string): Promise<any[]> {
    try {
      console.log(`🔍 Obteniendo todas las operaciones abiertas en perpetual para el usuario: ${userId}`);
      
      // Obtener todas las subcuentas del usuario
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { 
          userId,
          exchange: 'bybit' // Por ahora solo soportamos Bybit
        }
      });
      
      console.log(`✅ Se encontraron ${subAccounts.length} subcuentas de Bybit para el usuario`);
      
      if (subAccounts.length === 0) {
        return [];
      }
      
      // Array para almacenar todas las operaciones
      let allOperations = [];
      
      // Procesar cada subcuenta
      for (const subAccount of subAccounts) {
        try {
          // Obtener operaciones abiertas para esta subcuenta
          const operations = await this.getSubAccountOpenPerpetualOperations(subAccount.id, userId);
          
          // Agregar las operaciones al array total
          allOperations = [...allOperations, ...operations];
        } catch (error) {
          console.error(`❌ Error al obtener operaciones para subcuenta ${subAccount.name}:`, error.message);
          // Continuamos con la siguiente subcuenta en caso de error
        }
      }
      
      console.log(`📊 Total de operaciones abiertas en perpetual encontradas: ${allOperations.length}`);
      
      return allOperations;
    } catch (error) {
      console.error('❌ Error al obtener todas las operaciones abiertas en perpetual:', error);
      throw new HttpException(
        `Error al obtener todas las operaciones abiertas en perpetual: ${error.message || 'Error desconocido'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
