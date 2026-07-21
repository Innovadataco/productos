import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { v4 as uuid } from "uuid"
import TblRoles from 'App/Infraestructura/Datos/Entidad/Autorizacion/Rol'
import { DateTime } from 'luxon'

export default class RolesSeeder extends BaseSeeder {
  public async run() {
    await TblRoles.createMany([
      {
        id: 1,
        nombre: 'administrador',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 2,
        nombre: 'cliente',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 3,
        nombre: 'operador',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      }

    ])
  }
}
