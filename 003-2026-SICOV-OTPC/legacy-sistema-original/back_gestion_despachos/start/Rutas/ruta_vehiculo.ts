import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Vehiculos/ControladorVehiculo'

Route.group(() => {
  Route.post('/importar', accion_path + '.importar')
}).prefix('api/v1/vehiculos').middleware('autenticacionJwt')


Route.get('/api/v1/vehiculos/plantillas/:archivo', accion_path+'.descargarPlantilla')