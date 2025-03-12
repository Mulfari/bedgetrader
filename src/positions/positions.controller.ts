import { Controller, Get, Param, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import { GetUser } from '../auth/get-user.decorator';

@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(
    private readonly positionsService: PositionsService,
    private readonly subaccountsService: SubaccountsService,
  ) {}

  /**
   * Obtiene las operaciones cerradas de una subcuenta en un intervalo de tiempo
   * @param subAccountId ID de la subcuenta
   * @param days Número de días hacia atrás para obtener las operaciones (máximo 7 días)
   * @param userId ID del usuario autenticado
   * @returns Operaciones cerradas de la subcuenta
   */
  @Get('closed/:subAccountId')
  async getClosedPositions(
    @Param('subAccountId') subAccountId: string,
    @Query('days') days: string = '7',
    @GetUser('userId') userId: string,
  ) {
    try {
      // Verificar que la subcuenta pertenece al usuario
      const subAccount = await this.subaccountsService.findOne(subAccountId, userId);
      
      if (!subAccount) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      // Convertir days a número y validar
      const daysNum = parseInt(days, 10);
      if (isNaN(daysNum) || daysNum <= 0 || daysNum > 7) {
        throw new HttpException('El parámetro days debe ser un número entre 1 y 7', HttpStatus.BAD_REQUEST);
      }
      
      // Obtener las operaciones cerradas
      const closedPositions = await this.positionsService.getBybitClosedPositions(subAccount, daysNum);
      
      if (!closedPositions) {
        return {
          success: false,
          message: 'No se pudieron obtener las operaciones cerradas',
          data: []
        };
      }
      
      return {
        success: true,
        message: `Operaciones cerradas obtenidas correctamente para los últimos ${daysNum} días`,
        data: closedPositions.result.list,
        metadata: {
          category: closedPositions.result.category,
          nextPageCursor: closedPositions.result.nextPageCursor,
        }
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener las operaciones cerradas',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 