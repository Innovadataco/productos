import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { AutenticacionService } from './autenticacion.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const redirectIfAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};

// Guard por roles: usa data.roles = [1,2,...]
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const autApi = inject(AutenticacionService);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  const permitidos = (route.data?.['roles'] as Array<number> | undefined) ?? undefined;
  if (!permitidos || !permitidos.length) return true;
  const rolId = Number(autApi.getRol()?.id ?? 0);
  if (permitidos.includes(rolId)) return true;
  return router.createUrlTree(['/dashboard']);
};

// Entrada a "Usuarios": si el rol es 2, redirige a subusuarios
export const usuariosEntryGuard: CanActivateFn = () => {
  const router = inject(Router);
  const autApi = inject(AutenticacionService);
  const rolId = Number(autApi.getRol()?.id ?? 0);
  if (rolId === 2) {
    return router.createUrlTree(['/dashboard/subusuarios']);
  }
  return true;
};
