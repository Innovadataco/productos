import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

/**
 * Capa legacy NgModule. La UI de despachos vive en `src/app/features/salidas` y
 * `src/app/features/llegadas` (componentes standalone). Este módulo conserva imports
 * mínimos por compatibilidad; los servicios usan `providedIn: 'root'`.
 */
@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
  ],
})
export class DespachosModule {}
