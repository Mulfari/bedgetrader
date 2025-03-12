import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';
import { BybitPositionResponse, BybitPosition } from './position.interface';
import { SubAccount } from '../types';
import { PrismaService } from '../prisma.service';
import { CreatePositionDto, UpdatePositionDto } from './position.dto';

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
        this.logger.log(`🔹 Configurando proxy: ${proxyUrl.replace(/:[^:]*@/, ':****@')}`);
        
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // Parámetros de autenticación
        const timestamp = Date.now().toString();
        const apiKey = subaccount.apiKey;
        const secretKey = subaccount.secretKey;
        const recvWindow = "5000";

        this.logger.log(`🔹 Preparando autenticación:
          - Timestamp: ${timestamp}
          - API Key: ${apiKey.substring(0, 5)}...
          - RecvWindow: ${recvWindow}`);

        // QueryString para obtener posiciones
        const queryParams = { 
          category: "linear",
          settleCoin: "USDT"
        };
        const queryString = new URLSearchParams(queryParams).toString();

        // Crear el string para firmar
        const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
        const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

        this.logger.log(`🔹 Generación de firma:
          - Sign Payload: ${signPayload}
          - Signature: ${signature}`);

        // Headers actualizados para Bybit V5
        const headers = {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        };

        this.logger.log('🔹 Headers configurados:', JSON.stringify(headers, null, 2));

        // URL de Bybit para obtener posiciones
        const baseUrl = subaccount.isDemo 
          ? "https://api-demo.bybit.com"
          : "https://api.bybit.com";
        
        const url = `${baseUrl}/v5/position/list`;
        
        this.logger.log(`📡 Enviando solicitud a Bybit:
          - URL: ${url}
          - Modo: ${subaccount.isDemo ? 'DEMO' : 'REAL'}
          - Método: GET
          - Params: ${JSON.stringify(queryParams)}`);

        // Hacer la solicitud a Bybit con tiempo de espera
        const axiosConfig = {
          headers,
          params: queryParams,
          httpsAgent: proxyAgent,
          timeout: 10000, // 10 segundos
        };

        this.logger.log('📡 Configuración de axios:', JSON.stringify({
          ...axiosConfig,
          httpsAgent: 'ProxyAgent'
        }, null, 2));

        const response = await axios.get(url, axiosConfig);
        
        // Si llegamos aquí, la solicitud fue exitosa
        this.logger.log(`✅ Respuesta recibida de Bybit en el intento ${attempt}:
          - Status: ${response.status}
          - Status Text: ${response.statusText}`);

        if (!response.data || response.data.retCode !== 0) {
          const error = new Error(`Error en Bybit: ${response.data?.retMsg}`);
          error['bybitCode'] = response.data?.retCode;
          error['bybitMsg'] = response.data?.retMsg;
          throw error;
        }

        // Mostrar las posiciones en los logs
        const positions = response.data as BybitPositionResponse;
        
        if (positions.result.list.length === 0) {
          this.logger.log(`✅ No hay posiciones abiertas para la subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
        } else {
          this.logger.log(`✅ Posiciones abiertas para la subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'}):`);
          
          // Guardar las posiciones en la base de datos
          await this.savePositionsToDatabase(positions.result.list, subaccount);
          
          positions.result.list.forEach((position, index) => {
            this.logger.log(`📊 Posición ${index + 1}:
              - Símbolo: ${position.symbol}
              - Lado: ${position.side}
              - Tamaño: ${position.size}
              - Precio promedio: ${position.avgPrice}
              - PnL no realizado: ${position.unrealisedPnl}
              - Apalancamiento: ${position.leverage}
            `);
          });
        }
        
        return positions;
      } catch (error) {
        this.logger.error(`❌ Error en intento ${attempt}/${MAX_RETRIES} para subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'}):`, {
          message: error.message,
          bybitCode: error.bybitCode,
          bybitMsg: error.bybitMsg,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });

        // Si es el último intento, devolver null
        if (attempt === MAX_RETRIES) {
          this.logger.error(`❌ No se pudieron obtener las posiciones después de ${MAX_RETRIES} intentos para subcuenta ${subaccount.id} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
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
   * Guarda las posiciones en la base de datos
   * @param positions Lista de posiciones de Bybit
   * @param subaccount Subcuenta a la que pertenecen las posiciones
   */
  private async savePositionsToDatabase(positions: BybitPosition[], subaccount: SubAccount): Promise<void> {
    try {
      this.logger.log(`🔄 Guardando ${positions.length} posiciones en la base de datos para la subcuenta ${subaccount.id}`);
      
      for (const position of positions) {
        // Solo procesamos posiciones con tamaño > 0
        if (parseFloat(position.size) <= 0) {
          this.logger.log(`⏭️ Omitiendo posición con tamaño 0: ${position.symbol}`);
          continue;
        }
        
        // Verificar si la posición ya existe en la base de datos
        const existingPosition = await this.prisma.position.findFirst({
          where: {
            subAccountId: subaccount.id,
            symbol: position.symbol,
            side: position.side,
            status: 'OPEN',
          },
        });
        
        if (existingPosition) {
          // Actualizar la posición existente
          this.logger.log(`🔄 Actualizando posición existente para ${position.symbol} (${position.side})`);
          
          const updateData: UpdatePositionDto = {
            markPrice: position.markPrice,
            unrealisedPnl: position.unrealisedPnl,
            status: 'OPEN', // Asegurarnos de que sigue abierta
          };
          
          await this.prisma.position.update({
            where: { id: existingPosition.id },
            data: updateData,
          });
        } else {
          // Crear una nueva posición
          this.logger.log(`➕ Creando nueva posición para ${position.symbol} (${position.side})`);
          
          const createData: CreatePositionDto = {
            externalId: `${position.symbol}-${position.side}-${Date.now()}`, // Generamos un ID único
            subAccountId: subaccount.id,
            userId: subaccount.userId,
            symbol: position.symbol,
            positionType: 'PERPETUAL', // Por defecto para futuros perpetuos
            side: position.side,
            size: position.size,
            leverage: position.leverage,
            entryPrice: position.avgPrice,
            markPrice: position.markPrice,
            status: 'OPEN',
            openedAt: new Date(),
            unrealisedPnl: position.unrealisedPnl,
            settlementCurrency: 'USDT', // Por defecto para contratos lineales
            liquidationPrice: position.liqPrice || position.bustPrice,
            isDemo: subaccount.isDemo,
            exchange: 'BYBIT',
            category: 'linear',
          };
          
          await this.prisma.position.create({
            data: createData,
          });
        }
      }
      
      this.logger.log(`✅ Posiciones guardadas correctamente en la base de datos`);
    } catch (error) {
      this.logger.error(`❌ Error al guardar posiciones en la base de datos:`, error);
    }
  }

  /**
   * Obtiene todas las posiciones de un usuario
   * @param userId ID del usuario
   * @returns Lista de posiciones del usuario
   */
  async getUserPositions(userId: string) {
    try {
      return await this.prisma.position.findMany({
        where: { userId },
        orderBy: { openedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`❌ Error al obtener posiciones del usuario ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene las posiciones abiertas de un usuario
   * @param userId ID del usuario
   * @returns Lista de posiciones abiertas del usuario
   */
  async getUserOpenPositions(userId: string) {
    try {
      return await this.prisma.position.findMany({
        where: { 
          userId,
          status: 'OPEN'
        },
        orderBy: { openedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`❌ Error al obtener posiciones abiertas del usuario ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene las posiciones de una subcuenta
   * @param subAccountId ID de la subcuenta
   * @param userId ID del usuario (para verificación)
   * @returns Lista de posiciones de la subcuenta
   */
  async getSubAccountPositions(subAccountId: string, userId: string) {
    try {
      // Verificar que la subcuenta pertenece al usuario
      const subAccount = await this.prisma.subAccount.findFirst({
        where: { 
          id: subAccountId,
          userId
        }
      });
      
      if (!subAccount) {
        throw new Error('Subcuenta no encontrada o no pertenece al usuario');
      }
      
      return await this.prisma.position.findMany({
        where: { subAccountId },
        orderBy: { openedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`❌ Error al obtener posiciones de la subcuenta ${subAccountId}:`, error);
      throw error;
    }
  }
} 