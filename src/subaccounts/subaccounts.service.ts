import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener subcuentas del usuario autenticado
  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({ where: { userId } });
    } catch (error) {
      throw new HttpException('Error al obtener subcuentas', HttpStatus.INTERNAL_SERVER_ERROR);
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
      // Buscar la subcuenta en la base de datos
      const subAccount = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId },
      });

      // Verificar si la subcuenta pertenece al usuario
      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      // Configurar proxy con SmartProxy
      const proxyAgent = new HttpsProxyAgent(
        'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001',
      );

      // Configurar headers para la API de Bybit
      const headers = {
        'X-BYBIT-API-KEY': subAccount.apiKey,
      };

      // Hacer solicitud a la API de Bybit para obtener el balance
      const response = await axios.get(
        'https://api.bybit.com/v2/private/wallet/balance',
        {
          headers,
          httpsAgent: proxyAgent,
        },
      );

      if (response.data.ret_code !== 0) {
        throw new HttpException('Error al obtener balance de Bybit', HttpStatus.BAD_REQUEST);
      }

      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo balance de Bybit:', error);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    try {
      return await this.prisma.subAccount.create({
        data: { userId, exchange, apiKey, apiSecret, name },
      });
    } catch (error) {
      throw new HttpException('Error al crear subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
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
