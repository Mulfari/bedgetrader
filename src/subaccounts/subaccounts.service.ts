import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

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

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getSubAccountBalance(subAccountId: string, userId: string) {
    try {
      console.log(`🔹 Obteniendo balance para subcuenta: ${subAccountId}, usuario: ${userId}`);
      
      const subAccount = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId },
      });

      if (!subAccount || subAccount.userId !== userId) {
        console.error(`❌ Subcuenta no encontrada o no pertenece al usuario: ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      console.log(`🔹 Subcuenta encontrada: ${subAccount.name}, exchange: ${subAccount.exchange}`);
      
      // Verificar si es una cuenta demo o real
      const isDemo = subAccount.isDemo === true;
      console.log(`🔹 Tipo de cuenta: ${isDemo ? 'Demo' : 'Real'}`);
      
      // Si no es Bybit, lanzar error
      if (subAccount.exchange.toLowerCase() !== 'bybit') {
        console.error(`❌ Exchange no soportado: ${subAccount.exchange}`);
        throw new HttpException(`Exchange ${subAccount.exchange} no soportado actualmente`, HttpStatus.BAD_REQUEST);
      }

      // Configurar el proxy con autenticación correcta
      const proxyUrl = 'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001';
      console.log(`🔹 Configurando proxy: ${proxyUrl.replace(/\/\/(.+?):/g, '//*****:')}`);
      
      const proxyAgent = new HttpsProxyAgent(proxyUrl);

      // Generar firma para la API de Bybit
      const timestamp = Date.now().toString();
      const apiKey = subAccount.apiKey;
      const apiSecret = subAccount.apiSecret;
      const recvWindow = "20000"; // Aumentado para dar más tiempo a la respuesta

      console.log(`🔹 Generando firma para Bybit con apiKey: ${apiKey.substring(0, 5)}...`);

      // Seleccionar el dominio correcto según el tipo de cuenta
      const baseUrl = isDemo 
        ? 'https://api-demo.bybit.com' // URL para cuentas demo
        : 'https://api.bybit.com';     // URL para cuentas reales
      
      // Endpoint para obtener el balance de la wallet
      const endpoint = '/v5/account/wallet-balance';
      
      // Parámetros de consulta
      const accountType = 'UNIFIED';
      
      // Generar firma para la API de Bybit
      // IMPORTANTE: La firma debe generarse con los parámetros en orden alfabético
      // Según la documentación de Bybit: https://bybit-exchange.github.io/docs/v5/intro
      
      // 1. Crear un objeto con todos los parámetros
      const params = {
        accountType,
        api_key: apiKey,
        recv_window: recvWindow,
        timestamp
      };
      
      // 2. Ordenar los parámetros alfabéticamente y crear una cadena de consulta
      const orderedParams = Object.keys(params)
        .sort()
        .reduce((result, key) => {
          return `${result}${key}=${params[key]}&`;
        }, '')
        .slice(0, -1); // Eliminar el último '&'
      
      // 3. Generar la firma HMAC SHA256
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(orderedParams)
        .digest('hex');
      
      // 4. Construir la URL final con los parámetros
      const url = `${baseUrl}${endpoint}?accountType=${accountType}`;
      
      console.log(`🔹 URL de la API: ${url}`);
      console.log(`🔹 Parámetros ordenados para firma: ${orderedParams.replace(apiKey, apiKey.substring(0, 5) + '...')}`);
      console.log(`🔹 Firma generada: ${signature.substring(0, 10)}...`);

      // Headers según la documentación de Bybit V5
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
        'Content-Type': 'application/json'
      };

      console.log(`🔹 Headers configurados: ${JSON.stringify({
        'X-BAPI-API-KEY': `${apiKey.substring(0, 5)}...`,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': `${signature.substring(0, 5)}...`,
      })}`);

      // Hacer la solicitud a Bybit
      console.log(`🔹 Realizando solicitud a Bybit...`);
      let response;
      try {
        // Imprimir todos los detalles de la solicitud para depuración
        console.log(`🔹 Detalles completos de la solicitud:`);
        console.log(`🔹 URL: ${url}`);
        console.log(`🔹 Headers: ${JSON.stringify({
          'X-BAPI-API-KEY': `${apiKey.substring(0, 5)}...`,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': `${signature.substring(0, 10)}...`,
          'Content-Type': 'application/json'
        })}`);
        
        // Realizar la solicitud
        response = await axios.get(url, {
          headers,
          httpsAgent: proxyAgent,
          timeout: 15000 // 15 segundos de timeout
        });

        console.log(`✅ Respuesta de Bybit recibida con código: ${response.status}`);
        
        // Verificar si la respuesta es válida
        if (!response.data) {
          console.error(`❌ Error: Respuesta vacía de Bybit`);
          throw new HttpException(
            `Error al obtener balance de Bybit: Respuesta vacía`, 
            HttpStatus.BAD_REQUEST
          );
        }
        
        // Imprimir la respuesta completa para depuración
        console.log(`✅ Respuesta completa: ${JSON.stringify(response.data)}`);
        
        if (response.data.retCode !== 0) {
          console.error(`❌ Error en respuesta de Bybit: Código ${response.data.retCode}, Mensaje: ${response.data.retMsg}`);
          
          // Manejar códigos de error específicos de Bybit
          switch (response.data.retCode) {
            case 10001:
              throw new HttpException(
                `Error de autenticación en Bybit: Verifique sus credenciales API`, 
                HttpStatus.UNAUTHORIZED
              );
            case 10002:
              throw new HttpException(
                `Parámetros inválidos en la solicitud a Bybit`, 
                HttpStatus.BAD_REQUEST
              );
            case 10003:
              throw new HttpException(
                `API Key inválida o expirada`, 
                HttpStatus.UNAUTHORIZED
              );
            case 10004:
              throw new HttpException(
                `Firma inválida en la solicitud a Bybit`, 
                HttpStatus.BAD_REQUEST
              );
            case 10016:
              throw new HttpException(
                `Servicio no disponible para este tipo de cuenta`, 
                HttpStatus.BAD_REQUEST
              );
            case 10018:
              throw new HttpException(
                `IP no permitida para esta API Key`, 
                HttpStatus.FORBIDDEN
              );
            case 110001:
              throw new HttpException(
                `Permiso denegado para esta operación`, 
                HttpStatus.FORBIDDEN
              );
            default:
              throw new HttpException(
                `Error al obtener balance de Bybit: ${response.data.retMsg || 'Error desconocido'} (Código: ${response.data.retCode})`, 
                HttpStatus.BAD_REQUEST
              );
          }
        }

        // Verificar que la estructura de datos esperada existe
        if (!response.data.result || !response.data.result.list || !Array.isArray(response.data.result.list)) {
          console.error(`❌ Error: Estructura de datos inesperada en la respuesta de Bybit`);
          console.error(`❌ Datos recibidos: ${JSON.stringify(response.data)}`);
          throw new HttpException(
            `Error al procesar los datos de Bybit: Estructura de datos inesperada`, 
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }

        // Extraer todos los assets
        let assets: Array<{coin: string; walletBalance: number; usdValue: number}> = [];
        let totalBalance = 0;
        
        try {
          // Iterar sobre cada wallet en la lista
          for (const wallet of response.data.result.list) {
            console.log(`🔹 Procesando wallet: ${JSON.stringify(wallet)}`);
            
            // Verificar si hay monedas en esta wallet
            if (wallet.coin && Array.isArray(wallet.coin)) {
              // Procesar cada moneda
              for (const coin of wallet.coin) {
                if (coin && coin.coin && coin.walletBalance && parseFloat(coin.walletBalance) > 0) {
                  const walletBalance = parseFloat(coin.walletBalance);
                  const usdValue = parseFloat(coin.usdValue || '0');
                  
                  assets.push({
                    coin: coin.coin,
                    walletBalance: walletBalance,
                    usdValue: usdValue
                  });
                  
                  // Sumar al balance total
                  totalBalance += usdValue;
                }
              }
            }
          }
          
          console.log(`✅ Assets extraídos: ${assets.length}`);
          console.log(`✅ Balance total calculado: ${totalBalance.toFixed(2)}`);
          
          // Si no se encontraron assets, mostrar advertencia
          if (assets.length === 0) {
            console.warn(`⚠️ No se encontraron assets con balance positivo en la respuesta de Bybit`);
          }
        } catch (parseError) {
          console.error(`❌ Error al procesar los assets: ${parseError.message}`);
          console.error(`❌ Datos que causaron el error: ${JSON.stringify(response.data.result.list)}`);
          throw new HttpException(
            `Error al procesar los datos de Bybit: ${parseError.message}`, 
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }

        // Calcular rendimiento simulado (en un sistema real, esto vendría de datos históricos)
        // Nota: En una implementación completa, este valor debería venir de datos históricos reales
        const performance = Math.random() * 20 - 10; // Entre -10% y +10%

        console.log(`✅ Balance total calculado: ${totalBalance.toFixed(2)}, con ${assets.length} activos`);
        
        return {
          balance: totalBalance,
          assets: assets,
          performance: performance
        };
      } catch (axiosError) {
        // Manejar errores específicos de Axios
        console.error(`❌ Error en la solicitud a Bybit: ${axiosError.message}`);
        
        if (axiosError.response) {
          // La solicitud fue realizada y el servidor respondió con un código de estado
          // que cae fuera del rango 2xx
          console.error(`❌ Respuesta de error: ${JSON.stringify({
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data
          })}`);
          
          throw new HttpException(
            `Error en la API de Bybit: ${axiosError.response.data?.retMsg || axiosError.message}`,
            axiosError.response.status || HttpStatus.BAD_REQUEST
          );
        } else if (axiosError.request) {
          // La solicitud fue realizada pero no se recibió respuesta
          console.error(`❌ No se recibió respuesta de Bybit`);
          throw new HttpException(
            'No se pudo conectar con la API de Bybit. Verifique su conexión a internet o inténtelo más tarde.',
            HttpStatus.SERVICE_UNAVAILABLE
          );
        } else {
          // Algo ocurrió al configurar la solicitud que desencadenó un error
          throw new HttpException(
            `Error al configurar la solicitud a Bybit: ${axiosError.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      }
    } catch (error) {
      console.error('❌ Error en getSubAccountBalance:', error.message);
      
      // Si ya es un HttpException, lo propagamos
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Para otros errores, lanzamos un error genérico
      throw new HttpException(
        `Error al obtener balance: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
}
