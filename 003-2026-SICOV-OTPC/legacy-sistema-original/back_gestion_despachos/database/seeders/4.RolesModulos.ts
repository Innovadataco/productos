import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import {  ROLES } from 'App/Dominio/DiccionarioAutorizacion'
import Database from '@ioc:Adonis/Lucid/Database'


export default class RolesModulosSeeder extends BaseSeeder {
  public async run () {
    await Database
    .table('tbl_roles_modulos')
    .multiInsert([
        {
          rom_id: 1,
          rom_rol_id: ROLES.ADMINISTRADOR,
          rom_modulo_id: 1,
        },


        {
          rom_id: 7,
          rom_rol_id: ROLES.CLIENTE,
          rom_modulo_id: 2,
        },
        {
          rom_id: 8,
          rom_rol_id: ROLES.CLIENTE,
          rom_modulo_id: 3,
        },
        {
          rom_id: 9,
          rom_rol_id: ROLES.CLIENTE,
          rom_modulo_id: 4,
        },
        {
          rom_id: 10,
          rom_rol_id: ROLES.CLIENTE,
          rom_modulo_id: 5,
        },
        /* {
          rom_id: 11,
          rom_rol_id: ROLES.CLIENTE,
          rom_modulo_id: 6,
        }, */
        {
          rom_id: 12,
          rom_rol_id: ROLES.CLIENTE,
          rom_modulo_id: 1,
        },
    ])
  }
}
