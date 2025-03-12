import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';
import { BybitPositionResponse } from './position.interface';
import { SubAccount } from '../types';

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

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
} 