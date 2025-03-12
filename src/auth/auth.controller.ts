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
        // Generar token JWT
        const payload = { email: user.email, sub: user.id };
        const access_token = this.jwtService.sign(payload);
        
        // Obtener subcuentas del usuario
        const subAccounts = await this.subaccountsService.getSubAccounts(user.id);
        
        // Obtener balances para cada subcuenta
        const subAccountsWithBalances = await Promise.all(
          subAccounts.map(async (subAccount) => {
            try {
              console.log(`🔄 Obteniendo balance para subcuenta ${subAccount.id}`);
              const balance = await this.subaccountsService.getSubAccountBalance(subAccount.id, user.id);
              
              // Obtener posiciones abiertas para todas las subcuentas
              console.log(`🔄 Obteniendo posiciones abiertas para subcuenta ${subAccount.id} (${subAccount.isDemo ? 'DEMO' : 'REAL'})`);
              await this.positionsService.getBybitOpenPositions(subAccount);
              
              // Combinar la subcuenta con su balance
              return {
                ...subAccount,
                balance: balance.balance || 0,
                assets: balance.assets || [],
                performance: balance.performance || 0,
                lastUpdate: balance.lastUpdate || Date.now()
              };
            } catch (error) {
              console.error(`❌ Error al obtener balance para subcuenta ${subAccount.id}:`, error.message);
              
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
        
        console.log(`✅ Obtenidos balances para ${subAccountsWithBalances.length} subcuentas`);
        
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
      console.error("Error en login:", error);
      throw new HttpException(
        error.message || 'Error en la autenticación', 
        error.status || HttpStatus.UNAUTHORIZED
      );
    }
  }
}
