import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/ArchivosProgramas/ControladorArchivosProgramas'

Route.group(() => {
  Route.get('/', accion_path + '.listar')
  Route.post('/', accion_path + '.guardar')
}).prefix('api/v1/archivos_programas').middleware('autenticacionJwt')


Route.group(() => {
  Route.get('/', accion_path + '.listar')
  Route.post('/', accion_path + '.guardar')
}).prefix('api/v2/archivos_programas').middleware('validacionProveedor').middleware('autenticacionVigia')
