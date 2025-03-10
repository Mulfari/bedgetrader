import { Controller, Get, Param, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OpenOperationsResponse } from './operation.interface';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  /**
   * Obtiene las operaciones abiertas para una subcuenta específica
   * @param subAccountId ID de la subcuenta
   * @param req Objeto de solicitud con información del usuario autenticado
   * @returns Respuesta con las operaciones abiertas
   */
  @UseGuards(JwtAuthGuard)
  @Get('open/:subAccountId')
  async getOpenOperations(
    @Param('subAccountId') subAccountId: string,
    @Request() req,
  ): Promise<OpenOperationsResponse> {
    try {
      console.log(`🔍 Solicitud de operaciones abiertas para subcuenta ${subAccountId}`);
      
      if (!subAccountId) {
        throw new HttpException('ID de subcuenta requerido', HttpStatus.BAD_REQUEST);
      }
      
      const userId = req.user.userId;
      console.log(`👤 Usuario autenticado: ${userId}`);
      
      const operations = await this.operationsService.getOpenOperations(subAccountId, userId);
      
      return {
        success: true,
        operations,
        totalCount: operations.length,
      };
    } catch (error) {
      console.error(`❌ Error al obtener operaciones abiertas:`, error);
      
      return {
        success: false,
        operations: [],
        totalCount: 0,
        message: error.message || 'Error al obtener operaciones abiertas',
      };
    }
  }

  /**
   * Obtiene las operaciones abiertas para todas las subcuentas del usuario
   * @param req Objeto de solicitud con información del usuario autenticado
   * @returns Respuesta con las operaciones abiertas agrupadas por subcuenta
   */
  @UseGuards(JwtAuthGuard)
  @Get('open')
  async getAllOpenOperations(@Request() req): Promise<{ success: boolean; operations: { [subAccountId: string]: any[] }; message?: string }> {
    try {
      console.log(`🔍 Solicitud de operaciones abiertas para todas las subcuentas`);
      
      const userId = req.user.userId;
      console.log(`👤 Usuario autenticado: ${userId}`);
      
      const operationsBySubAccount = await this.operationsService.getAllOpenOperations(userId);
      
      // Contar el total de operaciones
      let totalOperations = 0;
      Object.values(operationsBySubAccount).forEach(operations => {
        totalOperations += operations.length;
      });
      
      console.log(`✅ Se encontraron ${totalOperations} operaciones abiertas en total`);
      
      return {
        success: true,
        operations: operationsBySubAccount,
      };
    } catch (error) {
      console.error(`❌ Error al obtener operaciones abiertas:`, error);
      
      return {
        success: false,
        operations: {},
        message: error.message || 'Error al obtener operaciones abiertas',
      };
    }
  }
} 