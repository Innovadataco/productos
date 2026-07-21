import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Despachos/ControladorDespachos'

Route.group(() => {
  Route.get('', accion_path + '.Listar')
  Route.get('listados', accion_path + '.Listados')
  Route.post('', accion_path + '.Crear')
  Route.post('guardar-despacho', accion_path + '.GuardarDespacho')
  Route.put('', accion_path + '.Edita')
  Route.patch('', accion_path + '.Desactivar')
  Route.get('placa/:placa', accion_path + '.BuscarPorPlacaVehiculo') // Nueva ruta para buscar por placa
  Route.get(':id', accion_path + '.BuscarPorId') // Nueva ruta
}).prefix('api/v1/despachos').middleware('autenticacionJwt')

Route.group(() => {
  Route.post('validar-integradora', accion_path + '.ValidarIntegradora');
}).prefix('api/v1/despachos-integradora')
