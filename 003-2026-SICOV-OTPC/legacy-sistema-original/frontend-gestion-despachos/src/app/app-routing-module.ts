import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { DashboardHomeComponent } from './features/dashboard/dashboard-home.component';
import { authGuard, redirectIfAuthGuard, roleGuard, usuariosEntryGuard } from './core/auth.guard';
import { MantenimientosPageComponent } from './features/mantenimientos/mantenimientos-page.component';
import { AlistamientosPageComponent } from './features/alistamientos/alistamientos-page.component';
import { AutorizacionesPageComponent } from './features/autorizaciones/autorizaciones-page.component';
import { SalidasPageComponent } from './features/salidas/salidas-page.component';
import { LlegadasPageComponent } from './features/llegadas/llegadas-page.component';
import { UsuariosPageComponent } from './features/usuarios/usuarios-page.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [redirectIfAuthGuard],
    title: 'Iniciar sesión',
  },
  {
    path: 'recuperar',
    component: ForgotPasswordComponent,
    canActivate: [redirectIfAuthGuard],
    title: 'Recuperar contraseña',
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    title: 'Dashboard',
    children: [
      { path: '', pathMatch: 'full', component: DashboardHomeComponent, title: 'Inicio' },
      { path: 'inicio', component: DashboardHomeComponent, title: 'Inicio' },
      { path: 'mantenimientos', component: MantenimientosPageComponent, title: 'Mantenimientos' },
      {
        path: 'mantenimientos/registro-preventivo',
        loadComponent: () =>
          import('./features/mantenimientos/preventivos/registro-preventivo.component').then(
            (m) => m.RegistroPreventivoComponent
          ),
        title: 'Registro preventivo',
      },
      {
        path: 'mantenimientos/registro-correctivo',
        loadComponent: () =>
          import('./features/mantenimientos/correctivos/registro-correctivo.component').then(
            (m) => m.RegistroCorrectivoComponent
          ),
        title: 'Registro correctivo',
      },
      { path: 'alistamientos', component: AlistamientosPageComponent, title: 'Alistamientos' },
      { path: 'autorizaciones', component: AutorizacionesPageComponent, title: 'Autorizaciones' },
      { path: 'salidas', component: SalidasPageComponent, title: 'Salidas' },
      { path: 'llegadas', component: LlegadasPageComponent, title: 'Llegadas' },
      {
        path: 'crear-usuarios',
        component: UsuariosPageComponent,
        title: 'Usuarios',
        canActivate: [usuariosEntryGuard, roleGuard],
        data: { roles: [1, 2] },
      },
      {
        path: 'subusuarios',
  loadComponent: () => import('src/app/features/usuarios/subusuarios-page.component').then(m => m.SubusuariosPageComponent),
        title: 'Subusuarios',
        canActivate: [roleGuard],
        data: { roles: [1, 2] },
      },
      { path: '**', component: DashboardHomeComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
