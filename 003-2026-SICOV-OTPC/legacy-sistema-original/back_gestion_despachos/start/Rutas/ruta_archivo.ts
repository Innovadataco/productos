import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Archivos/ControladorArchivo'

Route.group(() => {
  Route.post('/', accion_path + '.archivos')
  Route.get('/', accion_path + '.obtenerArchivo')
}).prefix('api/v1/archivos')//.middleware('autenticacionJwt')


Route.group(() => {
  Route.post('/', accion_path + '.archivos')
  Route.get('/', accion_path + '.obtenerArchivo')
}).prefix('api/v2/archivos').middleware('autenticacionVigia')
