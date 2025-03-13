import { Controller, Get, Param, UseGuards, Request, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubaccountsService } from '../subaccounts/subaccounts.service';

@Controller('positions')
export class PositionsController {
  private readonly logger = new Logger(PositionsController.name);

  constructor(
    private readonly positionsService: PositionsService,
    private readonly subaccountsService: SubaccountsService
  ) {}

  /**
   * Obtiene las posiciones abiertas de una subcuenta específica
   * @param req Request con el usuario autenticado
   * @param subaccountId ID de la subcuenta
   * @returns Posiciones abiertas de la subcuenta
   */
  @UseGuards(JwtAuthGuard)
  @Get('open/:subaccountId')
  async getOpenPositions(@Request() req, @Param('subaccountId') subaccountId: string) {
    try {
      const userId = req.user.sub;
      this.logger.log(`🔄 Obteniendo posiciones abiertas para subcuenta ${subaccountId} del usuario ${userId}`);

      // Verificar que la subcuenta existe y pertenece al usuario
      const subaccount = await this.subaccountsService.findOne(subaccountId, userId);
      
      if (!subaccount) {
        this.logger.error(`❌ Subcuenta ${subaccountId} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      // Obtener posiciones abiertas
      this.logger.log(`📊 Obteniendo posiciones abiertas para ${subaccount.name}...`);
      const openPositions = await this.positionsService.getBybitOpenPositions(subaccount);
      
      this.logger.log(`✅ Posiciones abiertas obtenidas para ${subaccount.name}`);
      return {
        message: 'Posiciones abiertas obtenidas exitosamente',
        subaccount: {
          id: subaccount.id,
          name: subaccount.name,
          exchange: subaccount.exchange,
          isDemo: subaccount.isDemo
        },
        positions: openPositions
      };
    } catch (error) {
      this.logger.error(`❌ Error al obtener posiciones abiertas:`, error.message);
      throw new HttpException(
        error.message || 'Error al obtener posiciones abiertas',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene las posiciones cerradas de una subcuenta específica
   * @param req Request con el usuario autenticado
   * @param subaccountId ID de la subcuenta
   * @returns Posiciones cerradas de la subcuenta
   */
  @UseGuards(JwtAuthGuard)
  @Get('closed/:subaccountId')
  async getClosedPositions(@Request() req, @Param('subaccountId') subaccountId: string) {
    try {
      const userId = req.user.sub;
      this.logger.log(`🔄 Obteniendo posiciones cerradas para subcuenta ${subaccountId} del usuario ${userId}`);

      // Verificar que la subcuenta existe y pertenece al usuario
      const subaccount = await this.subaccountsService.findOne(subaccountId, userId);
      
      if (!subaccount) {
        this.logger.error(`❌ Subcuenta ${subaccountId} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      // Obtener posiciones cerradas de los últimos 180 días (6 meses)
      this.logger.log(`📊 Obteniendo posiciones cerradas de los últimos 180 días para ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})...`);
      const closedPositions = await this.positionsService.getBybitClosedPositions(subaccount);
      
      // Guardar las posiciones cerradas en la base de datos
      let savedCount = 0;
      if (closedPositions && closedPositions.result && closedPositions.result.list && closedPositions.result.list.length > 0) {
        savedCount = await this.positionsService.saveClosedPositions(subaccount, closedPositions);
        this.logger.log(`✅ Se guardaron ${savedCount} posiciones cerradas para ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
      } else {
        this.logger.log(`⚠️ No se encontraron posiciones cerradas para ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
      }
      
      this.logger.log(`✅ Posiciones cerradas obtenidas para ${subaccount.name}`);
      return {
        message: 'Posiciones cerradas obtenidas exitosamente',
        subaccount: {
          id: subaccount.id,
          name: subaccount.name,
          exchange: subaccount.exchange,
          isDemo: subaccount.isDemo
        },
        positions: closedPositions,
        savedCount
      };
    } catch (error) {
      this.logger.error(`❌ Error al obtener posiciones cerradas:`, error.message);
      throw new HttpException(
        error.message || 'Error al obtener posiciones cerradas',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene todas las posiciones (abiertas y cerradas) de una subcuenta específica
   * @param req Request con el usuario autenticado
   * @param subaccountId ID de la subcuenta
   * @returns Todas las posiciones de la subcuenta
   */
  @UseGuards(JwtAuthGuard)
  @Get('all/:subaccountId')
  async getAllPositions(@Request() req, @Param('subaccountId') subaccountId: string) {
    try {
      const userId = req.user.sub;
      this.logger.log(`🔄 Obteniendo todas las posiciones para subcuenta ${subaccountId} del usuario ${userId}`);

      // Verificar que la subcuenta existe y pertenece al usuario
      const subaccount = await this.subaccountsService.findOne(subaccountId, userId);
      
      if (!subaccount) {
        this.logger.error(`❌ Subcuenta ${subaccountId} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      // Obtener posiciones abiertas
      this.logger.log(`📊 Obteniendo posiciones abiertas para ${subaccount.name}...`);
      const openPositions = await this.positionsService.getBybitOpenPositions(subaccount);
      
      // Obtener posiciones cerradas de los últimos 180 días (6 meses)
      this.logger.log(`📊 Obteniendo posiciones cerradas de los últimos 180 días para ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})...`);
      const closedPositions = await this.positionsService.getBybitClosedPositions(subaccount);
      
      // Guardar las posiciones cerradas en la base de datos
      let savedCount = 0;
      if (closedPositions && closedPositions.result && closedPositions.result.list && closedPositions.result.list.length > 0) {
        savedCount = await this.positionsService.saveClosedPositions(subaccount, closedPositions);
        this.logger.log(`✅ Se guardaron ${savedCount} posiciones cerradas para ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
      } else {
        this.logger.log(`⚠️ No se encontraron posiciones cerradas para ${subaccount.name} (${subaccount.isDemo ? 'DEMO' : 'REAL'})`);
      }
      
      this.logger.log(`✅ Todas las posiciones obtenidas para ${subaccount.name}`);
      return {
        message: 'Todas las posiciones obtenidas exitosamente',
        subaccount: {
          id: subaccount.id,
          name: subaccount.name,
          exchange: subaccount.exchange,
          isDemo: subaccount.isDemo
        },
        openPositions,
        closedPositions,
        savedCount
      };
    } catch (error) {
      this.logger.error(`❌ Error al obtener todas las posiciones:`, error.message);
      throw new HttpException(
        error.message || 'Error al obtener todas las posiciones',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 