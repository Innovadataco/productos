import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { ColasModule } from './colas/colas.module'
import { IntegracionesModule } from './integraciones/integraciones.module'
import { DespachosModule } from './despachos/despachos.module'
import { LlegadasModule } from './llegadas/llegadas.module'
import { MantenimientosModule } from './mantenimientos/mantenimientos.module'
import { CatalogosModule } from './catalogos/catalogos.module'
import { UsuariosModule } from './usuarios/usuarios.module'
import { DashboardModule } from './dashboard/dashboard.module'

@Module({
  imports: [
    PrismaModule,
    IntegracionesModule,
    ColasModule,
    AuthModule,
    DespachosModule,
    LlegadasModule,
    MantenimientosModule,
    CatalogosModule,
    UsuariosModule,
    DashboardModule,
  ],
})
export class AppModule {}
