/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/naming-convention */
import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Rol/ControladorRol'

Route.group(() => {
  //Route.post('/', accion_path + '.guardarRol')
  Route.get('', accion_path + '.listar')
  Route.get('modulos', accion_path + '.listarModulos')

  /* Route.get('/:id', accion_path + '.obtenerRolPorId')
  Route.patch('/:id', accion_path + '.actualizarRol')
  Route.put('/estado/:id', accion_path + '.cambiarEstado') */
}).prefix('api/v1/rol').middleware('autenticacionJwt')
