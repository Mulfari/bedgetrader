import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PositionsService } from '../positions/positions.service';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import { Logger } from '@nestjs/common';

@Controller('operations')
export class OperationsController {
  private readonly logger = new Logger(OperationsController.name);

  constructor(
    private readonly positionsService: PositionsService,
    private readonly subaccountsService: SubaccountsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('open')
  async getOpenOperations(@Req() req) {
    try {
      const userId = req.user.userId;
      this.logger.log(`🔍 Obteniendo operaciones abiertas para usuario ${userId}`);

      // Obtener todas las subcuentas del usuario
      const subAccounts = await this.subaccountsService.getSubAccounts(userId);
      
      if (!subAccounts || subAccounts.length === 0) {
        this.logger.log(`⚠️ No se encontraron subcuentas para el usuario ${userId}`);
        return {
          success: true,
          message: 'No se encontraron subcuentas',
          operations: {}
        };
      }

      this.logger.log(`✅ Se encontraron ${subAccounts.length} subcuentas para el usuario ${userId}`);
      
      // Objeto para almacenar las operaciones por subcuenta
      const operationsBySubAccount = {};
      
      // Obtener posiciones abiertas para cada subcuenta
      for (const subAccount of subAccounts) {
        try {
          this.logger.log(`🔄 Obteniendo posiciones abiertas para subcuenta ${subAccount.name} (${subAccount.id})`);
          
          // Obtener posiciones abiertas de Bybit
          const openPositions = await this.positionsService.getBybitOpenPositions(subAccount);
          
          if (!openPositions || !openPositions.result || !openPositions.result.list || openPositions.result.list.length === 0) {
            this.logger.log(`ℹ️ No se encontraron posiciones abiertas para subcuenta ${subAccount.name}`);
            operationsBySubAccount[subAccount.id] = [];
            continue;
          }
          
          // Transformar las posiciones al formato de operaciones
          const operations = openPositions.result.list.map(position => {
            // Calcular profit/loss no realizado en USD
            const unrealizedPnl = parseFloat(position.unrealisedPnl);
            
            // Calcular porcentaje de ganancia/pérdida manualmente
            let profitPercentage = 0;
            if (position.avgPrice && parseFloat(position.avgPrice) > 0) {
              const entryPrice = parseFloat(position.avgPrice);
              const currentPrice = parseFloat(position.markPrice);
              const leverage = parseFloat(position.leverage);
              
              if (position.side.toLowerCase() === 'buy') {
                profitPercentage = ((currentPrice - entryPrice) / entryPrice) * 100 * leverage;
              } else {
                profitPercentage = ((entryPrice - currentPrice) / entryPrice) * 100 * leverage;
              }
            }
            
            return {
              id: position.positionIdx + '-' + position.symbol, // Crear un ID único
              subAccountId: subAccount.id,
              symbol: position.symbol,
              side: position.side.toLowerCase(),
              type: 'market', // Por defecto asumimos market
              status: 'open',
              price: parseFloat(position.avgPrice),
              quantity: parseFloat(position.size),
              leverage: parseFloat(position.leverage),
              openTime: new Date(parseInt(position.createdTime)),
              profit: unrealizedPnl,
              profitPercentage: profitPercentage,
              exchange: subAccount.exchange,
              isDemo: subAccount.isDemo,
              // Campos adicionales específicos de Bybit
              positionValue: parseFloat(position.positionValue),
              markPrice: parseFloat(position.markPrice),
              liqPrice: position.liqPrice ? parseFloat(position.liqPrice) : null,
              positionIM: position.positionIM ? parseFloat(position.positionIM) : null,
              positionMM: position.positionMM ? parseFloat(position.positionMM) : null,
            };
          });
          
          this.logger.log(`✅ Se encontraron ${operations.length} posiciones abiertas para subcuenta ${subAccount.name}`);
          
          // Guardar las operaciones para esta subcuenta
          operationsBySubAccount[subAccount.id] = operations;
        } catch (error) {
          this.logger.error(`❌ Error al obtener posiciones abiertas para subcuenta ${subAccount.name}:`, error);
          operationsBySubAccount[subAccount.id] = [];
        }
      }
      
      return {
        success: true,
        message: 'Operaciones abiertas obtenidas correctamente',
        operations: operationsBySubAccount
      };
    } catch (error) {
      this.logger.error('❌ Error al obtener operaciones abiertas:', error);
      return {
        success: false,
        message: 'Error al obtener operaciones abiertas',
        error: error.message
      };
    }
  }
} 