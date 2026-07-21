import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import TblFuncionalidades from 'App/Infraestructura/Datos/Entidad/Autorizacion/Submodulo'
import { DateTime } from 'luxon'

export default class FuncionalidadesSeeder extends BaseSeeder {
  public async run() {
    await TblFuncionalidades.createMany([
      {
        id: 1,
        nombre: 'crear',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 2,
        nombre: 'leer',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 3,
        nombre: 'actualizar',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 4,
        nombre: 'eliminar',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
    ])
  }
}
