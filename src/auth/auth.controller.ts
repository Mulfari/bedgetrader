import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { SubaccountsService } from '../subaccounts/subaccounts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private subaccountsService: SubaccountsService
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
        
        // Obtener balances para cada subcuenta (sin obtener posiciones)
        console.log(`🔄 Obteniendo balances para todas las subcuentas...`);
        
        let totalBalance = 0;
        const subAccountsWithBalances = await Promise.all(
          subAccounts.map(async (subAccount) => {
            try {
              console.log(`🔍 Procesando subcuenta: ${subAccount.name} (${subAccount.exchange})`);
              
              // Obtener balance
              const balance = await this.subaccountsService.getSubAccountBalance(subAccount.id, user.id);
              totalBalance += balance.balance || 0;
              
              // Ya no obtenemos posiciones abiertas ni cerradas aquí
              // Esto se hará a través de un endpoint específico
              
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
