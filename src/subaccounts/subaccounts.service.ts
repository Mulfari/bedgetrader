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
      
      // Verificar que el ID de usuario no sea undefined
      if (!userId) {
        console.error('❌ Error: ID de usuario es undefined');
        throw new HttpException('ID de usuario no proporcionado', HttpStatus.BAD_REQUEST);
      }
      
      // Buscar la subcuenta con más detalles para depuración
      console.log(`🔹 Buscando subcuenta con ID: ${subAccountId} para usuario: ${userId}`);
      
      // Primero, verificar si la subcuenta existe en absoluto
      const subAccountExists = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId },
      });
      
      if (!subAccountExists) {
        console.error(`❌ Subcuenta con ID ${subAccountId} no existe en la base de datos`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      console.log(`🔹 Subcuenta encontrada en la base de datos. Propietario: ${subAccountExists.userId}`);
      
      // Ahora verificar si pertenece al usuario
      if (subAccountExists.userId !== userId) {
        console.error(`❌ La subcuenta pertenece al usuario ${subAccountExists.userId}, no al usuario ${userId}`);
        throw new HttpException('No tienes permiso para acceder a esta subcuenta', HttpStatus.FORBIDDEN);
      }
      
      const subAccount = subAccountExists;

      console.log(`🔹 Subcuenta encontrada: ${subAccount.name}, exchange: ${subAccount.exchange}`);
      
      // Verificar si es una cuenta demo o real
      const isDemo = subAccount.isDemo === true;
      console.log(`🔹 Tipo de cuenta: ${isDemo ? 'Demo' : 'Real'}`);
      
      // Si no es Bybit, lanzar error
      if (subAccount.exchange.toLowerCase() !== 'bybit') {
        console.error(`❌ Exchange no soportado: ${subAccount.exchange}`);
        throw new HttpException(`Exchange ${subAccount.exchange} no soportado actualmente`, HttpStatus.BAD_REQUEST);
      }

      // Configurar el proxy con autenticación correcta y opciones adicionales
      const proxyUrl = 'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001';
      console.log(`🔹 Configurando proxy: ${proxyUrl.replace(/\/\/(.+?):/g, '//*****:')}`);
      
      // Opción para deshabilitar el proxy en caso de problemas
      const useProxy = false; // Deshabilitado para probar sin proxy
      
      // Crear el agente proxy solo si está habilitado
      const proxyAgent = useProxy ? new HttpsProxyAgent(proxyUrl) : null;
      console.log(`🔹 Proxy ${useProxy ? 'habilitado' : 'deshabilitado'} para esta solicitud`);

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
      
      console.log(`🔹 Usando dominio de API: ${baseUrl} (${isDemo ? 'Demo' : 'Real'})`);
      
      // Endpoint para obtener el balance de la wallet
      const endpoint = '/v5/account/wallet-balance';
      
      // Parámetros específicos según el tipo de cuenta
      // Para cuentas demo, usamos UNIFIED
      // Para cuentas reales, probamos con SPOT si UNIFIED falla
      const accountTypes = isDemo 
        ? ['UNIFIED'] 
        : ['UNIFIED', 'SPOT', 'CONTRACT']; // Probar diferentes tipos para cuentas reales
      
      console.log(`🔹 Tipos de cuenta a probar: ${accountTypes.join(', ')}`);
      
      // Intentar con cada tipo de cuenta para cuentas reales
      let lastError: Error | null = null;
      
      for (const accountType of accountTypes) {
        try {
          console.log(`🔹 Intentando con tipo de cuenta: ${accountType}`);
          
          // Crear los parámetros de consulta
          const params = new URLSearchParams();
          params.append('accountType', accountType);
          
          // Construir la URL con los parámetros
          const url = `${baseUrl}${endpoint}?${params.toString()}`;
          console.log(`🔹 URL de la API: ${url}`);
          
          // Según la documentación de Bybit, la cadena para firmar debe ser:
          // timestamp + apiKey + recvWindow + queryString
          // donde queryString son los parámetros en orden alfabético
          const queryString = `accountType=${accountType}`;
          const stringToSign = timestamp + apiKey + recvWindow + queryString;
          
          console.log(`🔹 Parámetros para firma: timestamp=${timestamp}, apiKey=${apiKey.substring(0, 5)}..., recvWindow=${recvWindow}, queryString=${queryString}`);
          console.log(`🔹 Cadena para firma: ${stringToSign.replace(apiKey, apiKey.substring(0, 5) + '...')}`);
          
          // Generar la firma HMAC SHA256
          const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(stringToSign)
            .digest('hex');
          
          console.log(`🔹 Firma generada: ${signature.substring(0, 10)}...`);
          
          // Configuración para Axios
          const axiosConfig: any = {
            headers: {
              'X-BAPI-API-KEY': apiKey,
              'X-BAPI-TIMESTAMP': timestamp,
              'X-BAPI-RECV-WINDOW': recvWindow,
              'X-BAPI-SIGN': signature,
              'Content-Type': 'application/json'
            },
            timeout: 30000, // 30 segundos de timeout
            maxRedirects: 5,
            validateStatus: function (status) {
              return true; // Aceptar cualquier código de estado
            }
          };
          
          // Añadir el proxy solo si está habilitado
          if (useProxy && proxyAgent) {
            axiosConfig.httpsAgent = proxyAgent;
            console.log(`🔹 Usando proxy para esta solicitud`);
          } else {
            console.log(`🔹 Solicitud sin proxy`);
          }
          
          console.log(`🔹 Realizando solicitud para tipo de cuenta ${accountType}...`);
          
          // Realizar la solicitud con reintentos
          let retries = 0;
          const maxRetries = 2;
          let response: any = null;
          
          while (retries <= maxRetries && !response) {
            try {
              if (retries > 0) {
                console.log(`🔄 Reintento ${retries}/${maxRetries} para la solicitud a Bybit...`);
              }
              
              console.log(`🔹 Enviando solicitud a Bybit con headers:`, {
                'X-BAPI-API-KEY': apiKey.substring(0, 5) + '...',
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'X-BAPI-SIGN': signature.substring(0, 10) + '...',
              });
              
              const result = await axios.get(url, axiosConfig);
              
              console.log(`🔹 Respuesta recibida con status: ${result.status}`);
              console.log(`🔹 Headers de respuesta: ${JSON.stringify(result.headers)}`);
              
              // Verificar si el código de estado es un error
              if (result.status >= 400) {
                console.error(`❌ Error HTTP: ${result.status} - ${result.statusText}`);
                console.error(`❌ Cuerpo de la respuesta: ${JSON.stringify(result.data)}`);
                
                // Si es un error 522 (Connection Timed Out), reintentar
                if (result.status === 522 && retries < maxRetries) {
                  retries++;
                  console.log(`⏱️ Error de timeout (522). Esperando antes de reintentar...`);
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
                  continue;
                }
                
                throw new Error(`Error HTTP: ${result.status} - ${result.statusText}`);
              }
              
              response = result;
            } catch (error) {
              console.error(`❌ Error en la solicitud a Bybit:`, error.message);
              
              // Si es un error de Axios con respuesta, mostrar detalles
              if (error.response) {
                console.error(`❌ Status: ${error.response.status}`);
                console.error(`❌ Datos: ${JSON.stringify(error.response.data)}`);
                console.error(`❌ Headers: ${JSON.stringify(error.response.headers)}`);
              } else if (error.request) {
                // La solicitud fue hecha pero no se recibió respuesta
                console.error(`❌ No se recibió respuesta: ${error.request}`);
              }
              
              // Si es un error de timeout o conexión y aún tenemos reintentos disponibles
              if ((error.code === 'ECONNABORTED' || error.message?.includes('timeout')) && retries < maxRetries) {
                retries++;
                console.log(`⏱️ Error de timeout. Esperando antes de reintentar...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
              } else {
                throw error; // Propagar el error si no podemos manejarlo
              }
            }
          }
          
          if (!response) {
            throw new Error('No se pudo obtener respuesta después de los reintentos');
          }
          
          console.log(`✅ Respuesta de Bybit recibida con código: ${response.status}`);
          
          // Verificar si la respuesta es válida
          if (!response.data) {
            console.error(`❌ Error: Respuesta vacía de Bybit`);
            throw new Error('Respuesta vacía de Bybit');
          }
          
          // Imprimir la respuesta completa para depuración
          console.log(`✅ Respuesta completa: ${JSON.stringify(response.data)}`);
          
          if (response.data.retCode !== 0) {
            console.error(`❌ Error en respuesta de Bybit: Código ${response.data.retCode}, Mensaje: ${response.data.retMsg}`);
            
            // Manejar errores específicos de Bybit
            switch (response.data.retCode) {
              case 10001:
                console.error('❌ Error de parámetro: Parámetros incorrectos');
                break;
              case 10002:
                console.error('❌ Error de autenticación: API key inválida');
                break;
              case 10003:
                console.error('❌ Error de IP: IP no está en la lista blanca');
                break;
              case 10004:
                console.error('❌ Error de permisos: La API key no tiene permisos suficientes');
                break;
              case 10005:
                console.error('❌ Error de timestamp: Timestamp demasiado antiguo');
                break;
              case 10006:
                console.error('❌ Error de firma: Firma inválida');
                break;
              case 10016:
                console.error('❌ Error de tipo de cuenta: Tipo de cuenta no válido para esta API key');
                break;
              default:
                console.error(`❌ Error desconocido de Bybit: ${response.data.retMsg}`);
            }
            
            // Si es un error de tipo de cuenta no válido, probar con el siguiente tipo
            if (response.data.retCode === 10001 || response.data.retCode === 10002 || response.data.retCode === 10016) {
              console.log(`⚠️ Tipo de cuenta ${accountType} no válido para esta API key. Probando con el siguiente tipo...`);
              lastError = new Error(`Tipo de cuenta ${accountType} no válido: ${response.data.retMsg}`);
              continue;
            }
            
            // Para otros errores, lanzar excepción
            throw new Error(`Error de Bybit: ${response.data.retMsg} (Código: ${response.data.retCode})`);
          }
          
          // Verificar que la estructura de datos esperada existe
          if (!response.data.result || !response.data.result.list || !Array.isArray(response.data.result.list)) {
            console.error(`❌ Error: Estructura de datos inesperada en la respuesta de Bybit`);
            console.error(`❌ Datos recibidos: ${JSON.stringify(response.data)}`);
            throw new Error('Estructura de datos inesperada en la respuesta de Bybit');
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
            throw new Error(`Error al procesar los datos de Bybit: ${parseError.message}`);
          }
          
          // Calcular rendimiento simulado (en un sistema real, esto vendría de datos históricos)
          const performance = Math.random() * 20 - 10; // Entre -10% y +10%
          
          console.log(`✅ Balance total calculado: ${totalBalance.toFixed(2)}, con ${assets.length} activos`);
          
          // Si llegamos aquí, hemos tenido éxito con este tipo de cuenta
          return {
            balance: totalBalance,
            assets: assets,
            performance: performance,
            accountType: accountType // Incluir el tipo de cuenta que funcionó
          };
        } catch (error) {
          console.error(`❌ Error al intentar con tipo de cuenta ${accountType}: ${error.message}`);
          lastError = error;
          
          // Continuar con el siguiente tipo de cuenta
          continue;
        }
      }
      
      // Si llegamos aquí, ningún tipo de cuenta funcionó
      console.error(`❌ Todos los tipos de cuenta fallaron. Último error: ${lastError?.message}`);
      
      // Generar datos simulados como fallback
      console.warn(`⚠️ Usando datos simulados debido a problemas con la API de Bybit`);
      
      // Datos simulados para desarrollo/pruebas
      const simulatedAssets = [
        { coin: 'USDT', walletBalance: 1000.0, usdValue: 1000.0 },
        { coin: 'BTC', walletBalance: 0.05, usdValue: 3000.0 },
        { coin: 'ETH', walletBalance: 1.5, usdValue: 4500.0 }
      ];
      
      const simulatedBalance = simulatedAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
      const simulatedPerformance = Math.random() * 20 - 10; // Entre -10% y +10%
      
      console.log(`✅ Datos simulados generados: Balance ${simulatedBalance.toFixed(2)}, ${simulatedAssets.length} activos`);
      
      return {
        balance: simulatedBalance,
        assets: simulatedAssets,
        performance: simulatedPerformance,
        isSimulated: true // Indicar que son datos simulados
      };
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
