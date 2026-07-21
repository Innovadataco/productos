import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import TblActividadesAlistamiento from 'App/Infraestructura/Datos/Entidad/ActividadesAlistamiento'


export default class ActividadesAlistamientoSeeder extends BaseSeeder {
  public async run () {
    await TblActividadesAlistamiento.createMany([
        {
            id: 2,
            nombre: 'Tensión correas'
        },
        {
            id: 3,
            nombre: 'Ajuste de tapas'
        },
        {
            id: 5,
            nombre: 'Nivel agua limpiaparabrisas'
        },
        {
            id: 6,
            nombre: 'Aditivos de radiador'
        },
        {
            id: 7,
            nombre: 'Filtros húmedos y secos'
        },
        {
            id: 8,
            nombre: 'Baterías: niveles de electrolito, ajustes de bordes y sulfatación'
        },
        {
            id: 1,
            nombre: 'Fugas del motor'
        },
        {
            id: 9,
            nombre: 'Llantas: desgaste, presión de aire'
        },
        {
            id: 10,
            nombre: 'Equipo de carretera'
        },
        {
            id: 11,
            nombre: 'Botiquín'
        },
        {
            id: 4,
            nombre: 'Niveles de aceite de motor, transmisión, dirección, frenos'
        }
    ])
  }
}
