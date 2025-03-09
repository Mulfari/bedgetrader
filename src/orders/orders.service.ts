import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class OrdersService {
  // URL de la API de Bybit (testnet para pruebas)
  private readonly bybitApiUrl = 'https://api-testnet.bybit.com/v5/order/create';
  
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, orderData: any) {
    try {
      // Aquí puedes obtener las credenciales del usuario desde la base de datos
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          subAccounts: {
            where: {
              exchange: 'bybit'
            },
            select: {
              apiKey: true,
              secretKey: true
            }
          }
        },
      });

      if (!user || !user.subAccounts || user.subAccounts.length === 0) {
        throw new HttpException('Credenciales de API de Bybit no encontradas', HttpStatus.BAD_REQUEST);
      }

      const bybitAccount = user.subAccounts[0];
      const apiKey = bybitAccount.apiKey;
      const apiSecret = bybitAccount.secretKey;

      // Preparar los parámetros para la solicitud a Bybit
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // Crear la firma para la autenticación
      const signature = this.generateSignature(
        timestamp,
        apiKey,
        apiSecret,
        recvWindow,
        orderData
      );

      // Realizar la solicitud a la API de Bybit
      const response = await axios.post(
        this.bybitApiUrl,
        orderData,
        {
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'X-BAPI-SIGN': signature,
            'Content-Type': 'application/json',
          },
        }
      );

      // Simplemente devolvemos la respuesta de Bybit sin almacenar en nuestra base de datos
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: 'Error al crear la orden en Bybit',
            details: error.response.data,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  private generateSignature(
    timestamp: string,
    apiKey: string,
    apiSecret: string,
    recvWindow: string,
    data: any,
  ): string {
    // Ordenar los parámetros alfabéticamente y crear la cadena para firmar
    const queryString = Object.keys(data)
      .sort()
      .map(key => `${key}=${data[key]}`)
      .join('&');
    
    const stringToSign = timestamp + apiKey + recvWindow + queryString;
    
    // Generar la firma HMAC SHA256
    return crypto
      .createHmac('sha256', apiSecret)
      .update(stringToSign)
      .digest('hex');
  }
} 