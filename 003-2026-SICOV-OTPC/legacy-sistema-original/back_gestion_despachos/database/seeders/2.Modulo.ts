import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import TblModulos from 'App/Infraestructura/Datos/Entidad/Autorizacion/Modulo'
import { DateTime } from 'luxon'

export default class ModulosSeeder extends BaseSeeder {
  public async run () {
    await TblModulos.createMany([
      {
        id: 1,
        nombre: 'usuarios',
        nombreMostrar: 'Usuarios',
        ruta:'/dashboard/crear-usuarios',
        icono: 'bi-person-gear',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 2,
        nombre: 'Mantenimientos',
        nombreMostrar: 'Mantenimientos',
        ruta: '/dashboard/mantenimientos',
        icono: 'bi-nut',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 3,
        nombre: 'Alistamientos',
        nombreMostrar: 'Alistamientos',
        ruta: '/dashboard/alistamientos',
        icono: 'bi-box-seam',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 4,
        nombre: 'Autorizaciones',
        nombreMostrar: 'Autorizaciones',
        ruta: '/dashboard/autorizaciones',
        icono: 'bi-shield-lock',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
      {
        id: 5,
        nombre: 'Novedades',
        nombreMostrar: 'Novedades',
        ruta: '/dashboard/salidas',
        icono: 'bi-car-front',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      },
     /*  {
        id: 6,
        nombre: 'Llegadas',
        nombreMostrar: 'Llegadas',
        ruta: '/dashboard/llegadas',
        icono: 'bi-car-front-fill',
        estado: true,
        actualizacion: DateTime.now(),
        creacion: DateTime.now(),
      } */

    ])
  }
}
