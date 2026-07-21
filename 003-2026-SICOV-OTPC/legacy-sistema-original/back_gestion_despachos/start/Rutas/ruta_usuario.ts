/* eslint-disable @typescript-eslint/naming-convention */
import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Usuario/ControladorUsuario'
const controlador = '../../../app/Presentacion/Usuarios/ControladorUsuario'

const controlador_modulos = '../../../app/Presentacion/Usuarios/ControladorUsuarioModulos'

Route.group(() => {
  Route.group(()=>{
    Route.patch('/:identificacion', `${accion_path}.actualizarUsuario`)
    Route.get('/categorizacion', `${accion_path}.categorizar`)
    Route.post('/registro', `${controlador}.guardarUsuario`)
    Route.get('/listar/:pagina?/:limite?', `${controlador}.listar`)
    Route.get('/usuario/:usuario', `${controlador}.obtenerUsuarioPorUsuario`)
    Route.get('/:id', `${controlador}.obtenerUsuarioPorId`)

    // Rutas para gestión de módulos por usuario
    Route.post('/:id/modulos', `${controlador_modulos}.asignarModulos`)
    Route.get('/:id/modulos', `${controlador_modulos}.obtenerModulos`)
    Route.delete('/:id/modulos', `${controlador_modulos}.removerModulos`)
    Route.delete('/:id/modulos/limpiar', `${controlador_modulos}.limpiarModulos`)
  }).middleware('autenticacionJwt')
  Route.group(()=>{
    Route.post('/registro-vigia', `${controlador}.guardarUsuarioVigia`)
  }).middleware('autenticacionVigia')
}).prefix('api/v1/usuarios')
Route.get('/', `${controlador}.obtenerVigilados`).prefix('api/v1/vigilados')
Route.get('/', `${controlador}.obtenerTodosVigilados`).prefix('api/v1/vigilados-todos')
Route.get('/', `${controlador}.obtenerUsuariosRol2`).prefix('api/v1/usuarios-clientes')
