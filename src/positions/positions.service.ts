import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';
import { BybitPosition, BybitPositionResponse, BybitClosedPosition, BybitClosedPositionResponse, BybitExecution, BybitExecutionResponse } from './position.interface';
import { SubAccount } from '../types';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene las posiciones abiertas de una subcuenta de Bybit
   * @param subaccount Subcuenta de la que se quieren obtener las posiciones
   * @returns Posiciones abiertas de la subcuenta
   */
  async getBybitOpenPositions(subaccount: SubAccount): Promise<BybitPositionResponse | null> {
    // Eliminamos la restricción de solo cuentas demo
    // Ahora procesamos tanto cuentas demo como reales
    
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre reintentos
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`🔄 Intento ${attempt}/${MAX_RETRIES} de obtener posiciones para subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        
        // Configurar proxy
        const proxyUrl = "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001";
        
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // Parámetros de autenticación
        const timestamp = Date.now().toString();
        const apiKey = subaccount.apiKey;
        const secretKey = subaccount.secretKey;
        const recvWindow = "5000";

        // QueryString para obtener posiciones
        const queryParams = { 
          category: "linear",
          settleCoin: "USDT"
        };
        const queryString = new URLSearchParams(queryParams).toString();

        // Crear el string para firmar
        const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
        const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

        // Headers actualizados para Bybit V5
        const headers = {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        };

        // URL de Bybit para obtener posiciones
        const baseUrl = subaccount.isDemo 
          ? "https://api-demo.bybit.com"
          : "https://api.bybit.com";
        
        const url = `${baseUrl}/v5/position/list`;

        // Hacer la solicitud a Bybit con tiempo de espera
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 10000, // 10 segundos
        };

        const response = await axios.get(url, axiosConfig);
        
        // Si llegamos aquí, la solicitud fue exitosa
        this.logger.log(`✅ Respuesta recibida de Bybit para posiciones abiertas`);

        if (!response.data || response.data.retCode !== 0) {
          const error = new Error(`Error en Bybit: ${response.data?.retMsg}`);
          error['bybitCode'] = response.data?.retCode;
          error['bybitMsg'] = response.data?.retMsg;
          throw error;
        }

        // Mostrar las posiciones en los logs de forma resumida
        const positions = response.data as BybitPositionResponse;
        
        if (positions.result.list.length === 0) {
          this.logger.log(`✅ No hay posiciones abiertas para la subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        } else {
          this.logger.log(`✅ Se encontraron ${positions.result.list.length} posiciones abiertas para la subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        }
        
        return positions;
      } catch (error) {
        this.logger.error(`❌ Error al obtener posiciones abiertas para subcuenta ${subaccount.id}:`, error.message);

        // Si es el último intento, devolver null
        if (attempt === MAX_RETRIES) {
          this.logger.error(`❌ No se pudieron obtener las posiciones después de ${MAX_RETRIES} intentos`);
          return null;
        }

        // Esperar antes del siguiente intento
        this.logger.log(`⏳ Esperando ${RETRY_DELAY/1000} segundos antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    
    return null;
  }

  /**
   * Obtiene las posiciones cerradas de una subcuenta de Bybit en los últimos 180 días (6 meses)
   * @param subaccount Subcuenta de la que se quieren obtener las posiciones cerradas
   * @returns Posiciones cerradas de la subcuenta
   */
  async getBybitClosedPositions(subaccount: SubAccount): Promise<BybitClosedPositionResponse | null> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre reintentos
    
    // Calcular fecha de inicio (180 días atrás - 6 meses)
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 180);
    const startTimeMs = startTime.getTime();
    
    // Mostrar información detallada sobre la subcuenta
    this.logger.log(`🔍 Obteniendo posiciones cerradas para subcuenta:
      - ID: ${subaccount.id}
      - Nombre: ${subaccount.name}
      - Exchange: ${subaccount.exchange}
      - Tipo: ${subaccount.isDemo ? 'DEMO' : 'REAL'}
      - API Key: ${subaccount.apiKey ? subaccount.apiKey.substring(0, 5) + '...' : 'No disponible'}
      - Periodo: Últimos 180 días (6 meses) (desde ${startTime.toLocaleString()})
    `);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`🔄 Intento ${attempt}/${MAX_RETRIES} de obtener posiciones cerradas para cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'}`);
        
        // Configurar proxy
        const proxyUrl = "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001";
        
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // Parámetros de autenticación
        const timestamp = Date.now().toString();
        const apiKey = subaccount.apiKey;
        const secretKey = subaccount.secretKey;
        const recvWindow = "5000";

        // QueryString para obtener posiciones cerradas
        // Ajustamos los parámetros para obtener más resultados
        const queryParams = { 
          category: "linear",
          settleCoin: "USDT",
          startTime: startTimeMs.toString(),
          limit: "100", // Aumentamos el límite para obtener más resultados
          cursor: "" // Inicialmente sin cursor
        };
        const queryString = new URLSearchParams(queryParams).toString();

        // Crear el string para firmar
        const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
        const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

        // Headers actualizados para Bybit V5
        const headers = {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        };

        // URL de Bybit para obtener posiciones cerradas
        const baseUrl = subaccount.isDemo 
          ? "https://api-demo.bybit.com"
          : "https://api.bybit.com";
        
        const url = `${baseUrl}/v5/position/closed-pnl`;
        
        this.logger.log(`📡 Enviando solicitud a ${baseUrl} para obtener posiciones cerradas (cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        this.logger.log(`📝 Parámetros de consulta: startTime=${new Date(parseInt(queryParams.startTime)).toLocaleString()}, limit=${queryParams.limit}`);

        // Hacer la solicitud a Bybit con tiempo de espera
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 15000, // Aumentamos el timeout a 15 segundos
        };

        const response = await axios.get(url, axiosConfig);
        
        // Si llegamos aquí, la solicitud fue exitosa
        this.logger.log(`✅ Respuesta recibida de Bybit (código: ${response.status}) para cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'}`);

        // Verificar si la respuesta es válida
        if (!response.data) {
          throw new Error('Respuesta vacía de Bybit');
        }
        
        // Verificar si hay un error en la respuesta
        if (response.data.retCode !== 0) {
          const error = new Error(`Error en Bybit: ${response.data?.retMsg}`);
          error['bybitCode'] = response.data?.retCode;
          error['bybitMsg'] = response.data?.retMsg;
          throw error;
        }

        // Mostrar la respuesta completa para depuración
        this.logger.log(`📊 Respuesta de Bybit recibida correctamente para cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'}`);

        // Procesar las posiciones cerradas
        const closedPositions = response.data as BybitClosedPositionResponse;
        
        if (!closedPositions.result || !closedPositions.result.list || closedPositions.result.list.length === 0) {
          this.logger.log(`⚠️ No se encontraron posiciones cerradas en los últimos 180 días para la subcuenta ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        } else {
          this.logger.log(`✅ Se encontraron ${closedPositions.result.list.length} posiciones cerradas en los últimos 180 días para la subcuenta ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'}):`);
          
          // Crear una tabla resumida de las posiciones cerradas
          const positionSummary = closedPositions.result.list.map((position, index) => {
            return {
              index: index + 1,
              symbol: position.symbol,
              side: position.side,
              qty: position.qty,
              entryPrice: position.avgEntryPrice,
              exitPrice: position.avgExitPrice,
              pnl: position.closedPnl,
              leverage: position.leverage,
              fecha: new Date(parseInt(position.updatedTime)).toLocaleString()
            };
          });
          
          // Mostrar la tabla resumida
          console.table(positionSummary);
        }
        
        return closedPositions;
      } catch (error) {
        this.logger.error(`❌ Error al obtener posiciones cerradas:`, error);
        this.logger.error(`Detalles del error:`, {
          message: error.message,
          stack: error.stack,
          response: error.response?.data
        });

        // Si es el último intento, devolver null
        if (attempt === MAX_RETRIES) {
          this.logger.error(`❌ No se pudieron obtener las posiciones cerradas después de ${MAX_RETRIES} intentos`);
          return null;
        }

        // Esperar antes del siguiente intento
        this.logger.log(`⏳ Esperando ${RETRY_DELAY/1000} segundos antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    
    return null;
  }

  /**
   * Guarda las posiciones cerradas en la base de datos
   * @param subaccount Subcuenta a la que pertenecen las posiciones
   * @param closedPositions Posiciones cerradas a guardar
   * @returns Número de posiciones guardadas
   */
  async saveClosedPositions(subaccount: SubAccount, closedPositions: BybitClosedPositionResponse): Promise<number> {
    if (!closedPositions.result || !closedPositions.result.list || closedPositions.result.list.length === 0) {
      this.logger.log(`⚠️ No hay posiciones cerradas para guardar en la base de datos`);
      return 0;
    }

    this.logger.log(`🔄 Guardando ${closedPositions.result.list.length} posiciones cerradas en la base de datos...`);
    
    let savedCount = 0;
    
    try {
      // Procesar cada posición cerrada
      for (const position of closedPositions.result.list) {
        try {
          // Verificar si la posición ya existe en la base de datos
          const existingPosition = await this.prisma.position.findFirst({
            where: {
              subAccountId: subaccount.id,
              symbol: position.symbol,
              externalId: position.orderId,
              openedAt: new Date(parseInt(position.createdTime)),
              closedAt: new Date(parseInt(position.updatedTime))
            }
          });

          if (existingPosition) {
            this.logger.log(`⏩ Posición ya existe en la base de datos: ${position.symbol} (${position.orderId})`);
            continue;
          }

          // Calcular duración en segundos
          const openedAt = new Date(parseInt(position.createdTime));
          const closedAt = new Date(parseInt(position.updatedTime));
          const durationSeconds = Math.floor((closedAt.getTime() - openedAt.getTime()) / 1000);

          // Calcular porcentaje de retorno
          const entryPrice = parseFloat(position.avgEntryPrice);
          const exitPrice = parseFloat(position.avgExitPrice);
          const side = position.side.toLowerCase();
          let percentageReturn = 0;

          if (side === 'buy') {
            percentageReturn = ((exitPrice - entryPrice) / entryPrice) * 100 * parseFloat(position.leverage);
          } else if (side === 'sell') {
            percentageReturn = ((entryPrice - exitPrice) / entryPrice) * 100 * parseFloat(position.leverage);
          }

          // Crear la posición en la base de datos
          await this.prisma.position.create({
            data: {
              subAccountId: subaccount.id,
              userId: subaccount.userId,
              externalId: position.orderId,
              symbol: position.symbol,
              positionType: 'linear',
              side: position.side.toLowerCase(),
              size: position.qty,
              leverage: position.leverage,
              entryPrice: position.avgEntryPrice,
              exitPrice: position.avgExitPrice,
              markPrice: position.avgExitPrice,
              status: 'closed',
              openedAt: openedAt,
              closedAt: closedAt,
              realisedPnl: position.closedPnl,
              unrealisedPnl: '0',
              commission: '0', // No tenemos esta información de la API
              settlementCurrency: 'USDT', // Asumimos USDT como moneda de liquidación
              isDemo: subaccount.isDemo,
              exchange: subaccount.exchange,
              category: 'linear',
              durationSeconds: durationSeconds,
              percentageReturn: percentageReturn,
              maxDrawdown: 0, // No tenemos esta información de la API
            }
          });

          savedCount++;
          this.logger.log(`✅ Posición guardada: ${position.symbol} (${position.side}) - PnL: ${position.closedPnl}`);
        } catch (error) {
          this.logger.error(`❌ Error al guardar posición ${position.symbol}:`, error);
        }
      }

      this.logger.log(`✅ Se guardaron ${savedCount} posiciones cerradas en la base de datos`);
      return savedCount;
    } catch (error) {
      this.logger.error(`❌ Error al guardar posiciones cerradas:`, error);
      return savedCount;
    }
  }

  /**
   * Obtiene las operaciones spot de una subcuenta de Bybit en los últimos 180 días (6 meses)
   * @param subaccount Subcuenta de la que se quieren obtener las operaciones spot
   * @returns Operaciones spot de la subcuenta
   */
  async getBybitSpotExecutions(subaccount: SubAccount): Promise<BybitExecutionResponse | null> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre reintentos
    
    // Calcular fecha de inicio (180 días atrás - 6 meses)
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 180);
    const startTimeMs = startTime.getTime();
    
    // Mostrar información detallada sobre la subcuenta
    this.logger.log(`🔍 Obteniendo operaciones SPOT para subcuenta:
      - ID: ${subaccount.id}
      - Nombre: ${subaccount.name}
      - Exchange: ${subaccount.exchange}
      - Tipo: ${subaccount.isDemo ? 'DEMO' : 'REAL'}
      - API Key: ${subaccount.apiKey ? subaccount.apiKey.substring(0, 5) + '...' : 'No disponible'}
      - Periodo: Últimos 180 días (6 meses) (desde ${startTime.toLocaleString()})
    `);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`🔄 Intento ${attempt}/${MAX_RETRIES} de obtener operaciones SPOT para cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'}`);
        
        // Configurar proxy
        const proxyUrl = "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001";
        
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // Parámetros de autenticación
        const timestamp = Date.now().toString();
        const apiKey = subaccount.apiKey;
        const secretKey = subaccount.secretKey;
        const recvWindow = "5000";

        // QueryString para obtener operaciones spot
        const queryParams = { 
          category: "spot",
          startTime: startTimeMs.toString(),
          limit: "100", // Aumentamos el límite para obtener más resultados
          cursor: "" // Inicialmente sin cursor
        };
        const queryString = new URLSearchParams(queryParams).toString();

        // Crear el string para firmar
        const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
        const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

        // Headers actualizados para Bybit V5
        const headers = {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        };

        // URL de Bybit para obtener operaciones spot
        const baseUrl = subaccount.isDemo 
          ? "https://api-demo.bybit.com"
          : "https://api.bybit.com";
        
        const url = `${baseUrl}/v5/execution/list`;
        
        this.logger.log(`📡 Enviando solicitud a ${baseUrl} para obtener operaciones SPOT (cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        this.logger.log(`📝 Parámetros de consulta: startTime=${new Date(parseInt(queryParams.startTime)).toLocaleString()}, limit=${queryParams.limit}`);

        // Hacer la solicitud a Bybit con tiempo de espera
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 15000, // Aumentamos el timeout a 15 segundos
        };

        const response = await axios.get(url, axiosConfig);
        
        // Si llegamos aquí, la solicitud fue exitosa
        this.logger.log(`✅ Respuesta recibida de Bybit (código: ${response.status}) para operaciones SPOT (cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'})`);

        // Verificar si la respuesta es válida
        if (!response.data) {
          throw new Error('Respuesta vacía de Bybit');
        }
        
        // Verificar si hay un error en la respuesta
        if (response.data.retCode !== 0) {
          const error = new Error(`Error en Bybit: ${response.data?.retMsg}`);
          error['bybitCode'] = response.data?.retCode;
          error['bybitMsg'] = response.data?.retMsg;
          throw error;
        }

        // Mostrar la respuesta completa para depuración
        this.logger.log(`📊 Respuesta de Bybit recibida correctamente para operaciones SPOT (cuenta ${subaccount.isDemo ? 'DEMO' : 'REAL'})`);

        // Procesar las operaciones spot
        const spotExecutions = response.data as BybitExecutionResponse;
        
        if (!spotExecutions.result || !spotExecutions.result.list || spotExecutions.result.list.length === 0) {
          this.logger.log(`⚠️ No se encontraron operaciones SPOT en los últimos 180 días para la subcuenta ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        } else {
          this.logger.log(`✅ Se encontraron ${spotExecutions.result.list.length} operaciones SPOT en los últimos 180 días para la subcuenta ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'}):`);
          
          // Crear una tabla resumida de las operaciones spot
          const executionSummary = spotExecutions.result.list.map((execution, index) => {
            return {
              index: index + 1,
              symbol: execution.symbol,
              side: execution.side,
              qty: execution.execQty,
              price: execution.execPrice,
              value: execution.execValue,
              fee: execution.execFee,
              fecha: new Date(parseInt(execution.execTime)).toLocaleString()
            };
          });
          
          // Mostrar la tabla resumida
          console.table(executionSummary);
        }
        
        return spotExecutions;
      } catch (error) {
        this.logger.error(`❌ Error al obtener operaciones SPOT:`, error);
        this.logger.error(`Detalles del error:`, {
          message: error.message,
          stack: error.stack,
          response: error.response?.data
        });

        // Si es el último intento, devolver null
        if (attempt === MAX_RETRIES) {
          this.logger.error(`❌ No se pudieron obtener las operaciones SPOT después de ${MAX_RETRIES} intentos`);
          return null;
        }

        // Esperar antes del siguiente intento
        this.logger.log(`⏳ Esperando ${RETRY_DELAY/1000} segundos antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    
    return null;
  }

  /**
   * Guarda las operaciones spot en la base de datos
   * @param subaccount Subcuenta a la que pertenecen las operaciones
   * @param spotExecutions Operaciones spot a guardar
   * @returns Número de operaciones guardadas
   */
  async saveSpotExecutions(subaccount: SubAccount, spotExecutions: BybitExecutionResponse): Promise<number> {
    if (!spotExecutions.result || !spotExecutions.result.list || spotExecutions.result.list.length === 0) {
      this.logger.log(`⚠️ No hay operaciones SPOT para guardar en la base de datos`);
      return 0;
    }

    this.logger.log(`🔄 Guardando ${spotExecutions.result.list.length} operaciones SPOT en la base de datos...`);
    
    let savedCount = 0;
    
    try {
      // Procesar cada operación spot
      for (const execution of spotExecutions.result.list) {
        try {
          // Verificar si la operación ya existe en la base de datos
          const existingPosition = await this.prisma.position.findFirst({
            where: {
              subAccountId: subaccount.id,
              symbol: execution.symbol,
              externalId: execution.orderId,
              openedAt: new Date(parseInt(execution.execTime)),
              closedAt: new Date(parseInt(execution.execTime))
            }
          });

          if (existingPosition) {
            this.logger.log(`⏩ Operación SPOT ya existe en la base de datos: ${execution.symbol} (${execution.orderId})`);
            continue;
          }

          // Para operaciones spot, la fecha de apertura y cierre es la misma
          const execTime = new Date(parseInt(execution.execTime));
          
          // Crear la operación en la base de datos
          await this.prisma.position.create({
            data: {
              subAccountId: subaccount.id,
              userId: subaccount.userId,
              externalId: execution.orderId,
              symbol: execution.symbol,
              positionType: 'spot',
              side: execution.side.toLowerCase(),
              size: execution.execQty,
              leverage: '1', // Las operaciones spot tienen apalancamiento 1
              entryPrice: execution.execPrice,
              exitPrice: execution.execPrice,
              markPrice: execution.execPrice,
              status: 'closed',
              openedAt: execTime,
              closedAt: execTime,
              realisedPnl: '0', // No aplica para spot
              unrealisedPnl: '0',
              commission: execution.execFee,
              settlementCurrency: execution.symbol.endsWith('USDT') ? 'USDT' : 'USD', // Inferir la moneda de liquidación
              isDemo: subaccount.isDemo,
              exchange: subaccount.exchange,
              category: 'spot',
              durationSeconds: 0, // Las operaciones spot son instantáneas
              percentageReturn: 0, // No aplica para spot
              maxDrawdown: 0, // No aplica para spot
            }
          });

          savedCount++;
          this.logger.log(`✅ Operación SPOT guardada: ${execution.symbol} (${execution.side}) - Valor: ${execution.execValue}`);
        } catch (error) {
          this.logger.error(`❌ Error al guardar operación SPOT ${execution.symbol}:`, error);
        }
      }

      this.logger.log(`✅ Se guardaron ${savedCount} operaciones SPOT en la base de datos`);
      return savedCount;
    } catch (error) {
      this.logger.error(`❌ Error al guardar operaciones SPOT:`, error);
      return savedCount;
    }
  }
} 