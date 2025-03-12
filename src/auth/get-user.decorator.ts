import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador para obtener el usuario autenticado o una propiedad específica del usuario
 * @param property Propiedad del usuario a obtener (opcional)
 * @returns El usuario completo o la propiedad especificada
 */
export const GetUser = createParamDecorator(
  (property: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si se especifica una propiedad, devolver solo esa propiedad
    if (property) {
      return user?.[property];
    }

    // Si no se especifica una propiedad, devolver el usuario completo
    return user;
  },
); 