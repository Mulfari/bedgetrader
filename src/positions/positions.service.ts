import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';
import { BybitPosition, BybitPositionResponse, BybitClosedPosition, BybitClosedPositionResponse } from './position.interface';
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
   * Obtiene las posiciones cerradas de una subcuenta de Bybit en los últimos 7 días
   * @param subaccount Subcuenta de la que se quieren obtener las posiciones cerradas
   * @returns Posiciones cerradas de la subcuenta
   */
  async getBybitClosedPositions(subaccount: SubAccount): Promise<BybitClosedPositionResponse | null> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre reintentos
    
    // Calcular fecha de inicio (7 días atrás)
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 7);
    const startTimeMs = startTime.getTime();
    
    // Mostrar información detallada sobre la subcuenta
    this.logger.log(`🔍 Obteniendo posiciones cerradas REALES para subcuenta:
      - ID: ${subaccount.id}
      - Nombre: ${subaccount.name}
      - Exchange: ${subaccount.exchange}
      - Tipo: ${subaccount.isDemo ? 'DEMO' : 'REAL'}
      - API Key: ${subaccount.apiKey ? subaccount.apiKey.substring(0, 5) + '...' : 'No disponible'}
      - Periodo: Últimos 7 días (desde ${startTime.toLocaleString()})
    `);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`🔄 Intento ${attempt}/${MAX_RETRIES} de obtener posiciones cerradas REALES`);
        
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
        
        this.logger.log(`📡 Enviando solicitud a ${baseUrl} para obtener posiciones cerradas REALES`);

        // Hacer la solicitud a Bybit con tiempo de espera
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 15000, // Aumentamos el timeout a 15 segundos
        };

        const response = await axios.get(url, axiosConfig);
        
        // Si llegamos aquí, la solicitud fue exitosa
        this.logger.log(`✅ Respuesta recibida de Bybit (código: ${response.status})`);

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
        this.logger.log(`📊 Respuesta completa de Bybit: ${JSON.stringify(response.data, null, 2)}`);

        // Procesar las posiciones cerradas
        const closedPositions = response.data as BybitClosedPositionResponse;
        
        if (!closedPositions.result || !closedPositions.result.list || closedPositions.result.list.length === 0) {
          this.logger.log(`⚠️ No se encontraron posiciones cerradas REALES en los últimos 7 días para la subcuenta ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        } else {
          this.logger.log(`✅ Se encontraron ${closedPositions.result.list.length} posiciones cerradas REALES en los últimos 7 días para la subcuenta ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'}):`);
          
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
        this.logger.error(`❌ Error al obtener posiciones cerradas REALES:`, error);
        this.logger.error(`Detalles del error:`, {
          message: error.message,
          stack: error.stack,
          response: error.response?.data
        });

        // Si es el último intento, devolver null
        if (attempt === MAX_RETRIES) {
          this.logger.error(`❌ No se pudieron obtener las posiciones cerradas REALES después de ${MAX_RETRIES} intentos`);
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
} 