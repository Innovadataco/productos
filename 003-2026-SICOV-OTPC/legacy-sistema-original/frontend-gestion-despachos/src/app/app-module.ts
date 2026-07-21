import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { ChangePasswordComponent } from './features/auth/change-password.component';
import { ModalComponent } from './shared/ui/modal.component';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { LoginComponent } from './features/auth/login.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { AuthTokenInterceptor } from './core/auth-token.interceptor';

@NgModule({
  declarations: [App, LoginComponent, ForgotPasswordComponent, DashboardComponent, SidebarComponent, ChangePasswordComponent],
  imports: [BrowserModule, RouterModule, AppRoutingModule, ReactiveFormsModule, NgOptimizedImage, HttpClientModule, ModalComponent],
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthTokenInterceptor, multi: true },
  ],
  bootstrap: [App],
})
export class AppModule {}
