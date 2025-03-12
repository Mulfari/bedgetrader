import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import { PositionsService } from '../positions/positions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private subaccountsService: SubaccountsService,
    private positionsService: PositionsService
  ) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    try {
      const user = await this.authService.registerUser(body.name, body.email, body.password);
      return { message: "Usuario creado exitosamente", userId: user.id };
    } catch (error) {
      console.error("Error al crear usuario:", error);
      throw new HttpException('Error registering user', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      // Validar usuario y obtener información básica
      const user = await this.authService.validateUser(body.email, body.password);
      
      if (user) {
        console.log(`✅ Usuario autenticado: ${user.email}`);
        
        // Generar token JWT
        const payload = { email: user.email, sub: user.id };
        const access_token = this.jwtService.sign(payload);
        
        // Obtener subcuentas del usuario
        const subAccounts = await this.subaccountsService.getSubAccounts(user.id);
        console.log(`✅ Subcuentas encontradas: ${subAccounts.length}`);
        
        // Obtener balances para cada subcuenta
        console.log(`🔄 Obteniendo balances y posiciones para todas las subcuentas...`);
        
        let totalBalance = 0;
        const subAccountsWithBalances = await Promise.all(
          subAccounts.map(async (subAccount) => {
            try {
              console.log(`🔍 Procesando subcuenta: ${subAccount.name} (${subAccount.exchange})`);
              
              // Obtener balance
              const balance = await this.subaccountsService.getSubAccountBalance(subAccount.id, user.id);
              totalBalance += balance.balance || 0;
              
              // Obtener posiciones abiertas
              console.log(`📊 Obteniendo posiciones abiertas para ${subAccount.name}...`);
              const openPositions = await this.positionsService.getBybitOpenPositions(subAccount);
              
              // Obtener posiciones cerradas de los últimos 180 días (6 meses)
              console.log(`📊 Obteniendo posiciones cerradas de los últimos 180 días (6 meses) para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})...`);
              
              // Obtener posiciones cerradas para todas las cuentas (demo y reales)
              const closedPositions = await this.positionsService.getBybitClosedPositions(subAccount);
              
              if (closedPositions && closedPositions.result && closedPositions.result.list && closedPositions.result.list.length > 0) {
                console.log(`✅ Se encontraron ${closedPositions.result.list.length} posiciones cerradas para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})`);
              } else {
                console.log(`⚠️ No se encontraron posiciones cerradas para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})`);
              }
              
              // Obtener operaciones spot de los últimos 180 días (6 meses)
              console.log(`📊 Obteniendo operaciones SPOT de los últimos 180 días (6 meses) para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})...`);
              
              // Obtener operaciones spot para todas las cuentas (demo y reales)
              const spotExecutions = await this.positionsService.getBybitSpotExecutions(subAccount);
              
              if (spotExecutions && spotExecutions.result && spotExecutions.result.list && spotExecutions.result.list.length > 0) {
                console.log(`✅ Se encontraron ${spotExecutions.result.list.length} operaciones SPOT para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})`);
                
                // Guardar las operaciones spot en la base de datos
                const savedSpotCount = await this.positionsService.saveSpotExecutions(subAccount, spotExecutions);
                console.log(`✅ Se guardaron ${savedSpotCount} operaciones SPOT para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})`);
              } else {
                console.log(`⚠️ No se encontraron operaciones SPOT para ${subAccount.name} (${subAccount.isDemo ? 'DEMO' : 'REAL'})`);
              }
              
              // Combinar la subcuenta con su balance
              return {
                ...subAccount,
                balance: balance.balance || 0,
                assets: balance.assets || [],
                performance: balance.performance || 0,
                lastUpdate: balance.lastUpdate || Date.now()
              };
            } catch (error) {
              console.error(`❌ Error al procesar subcuenta ${subAccount.name}:`, error.message);
              
              // Si hay un error, devolver la subcuenta sin balance
              return {
                ...subAccount,
                balance: 0,
                assets: [],
                performance: 0,
                lastUpdate: Date.now(),
                error: error.message
              };
            }
          })
        );
        
        // Mostrar resumen de balances
        console.log(`💰 Balance total del usuario: $${totalBalance.toFixed(2)} USD`);
        
        // Mostrar resumen de subcuentas
        const accountSummary = subAccountsWithBalances.map(acc => {
          // Crear un objeto con las propiedades básicas
          const summary = {
            Nombre: acc.name,
            Exchange: acc.exchange,
            Tipo: acc.isDemo ? 'DEMO' : 'REAL',
            Balance: `$${acc.balance.toFixed(2)} USD`,
            Error: '-'
          };
          
          // Añadir el error si existe usando casting seguro
          if ('error' in acc) {
            summary.Error = (acc as any).error;
          }
          
          return summary;
        });
        
        console.log('📊 Resumen de subcuentas:');
        console.table(accountSummary);
        
        // Devolver respuesta completa con token, subcuentas y sus balances
        return {
          message: 'Autenticación exitosa',
          access_token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          subAccounts: subAccountsWithBalances
        };
      } else {
        throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
      }
    } catch (error) {
      console.error("❌ Error en login:", error.message);
      throw new HttpException(
        error.message || 'Error en la autenticación', 
        error.status || HttpStatus.UNAUTHORIZED
      );
    }
  }
}
