import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Novedadesconductor/ControladorNovedadesconductor'

Route.group(() => {
  Route.get('', accion_path + '.Listar')
  Route.post('', accion_path + '.Crear')
  Route.put('', accion_path + '.Edita')
  Route.patch('', accion_path + '.Desactivar')

}).prefix('api/v1/novedadesconductor').middleware('autenticacionJwt')
