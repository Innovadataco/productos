import { Module } from '@nestjs/common'
import { ColasService } from './colas.service'
import { IntegracionesModule } from '../integraciones/integraciones.module'

@Module({
  imports: [IntegracionesModule],
  providers: [ColasService],
  exports: [ColasService],
})
export class ColasModule {}
