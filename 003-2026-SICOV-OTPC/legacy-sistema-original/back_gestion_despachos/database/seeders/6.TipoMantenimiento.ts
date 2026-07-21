import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { DateTime } from 'luxon'
import { ROLES } from 'App/Dominio/DiccionarioAutorizacion'
import TblTipoMantenimiento from 'App/Infraestructura/Datos/Entidad/TipoMantenimiento'


export default class TipoMantenimientoSeeder extends BaseSeeder {
  public async run () {
    await TblTipoMantenimiento.createMany([
        {
            id: 1,
            descripcion: 'Mantenimiento Preventivo'
        },
        {
            id: 2,
            descripcion: 'Mantenimiento Correctivo'
        },
        {
            id: 3,
            descripcion: 'Alistamiento Diario'
        },
        {
            id: 4,
            descripcion: 'Autorizaciones'
        }
    ])
  }
}
