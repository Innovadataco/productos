/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/naming-convention */
import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Verificador/ControladorVerificador'


Route.group(() => {
  Route.get('listar', accion_path + '.listar')
}).prefix('api/v1/verificador').middleware('autenticacionJwt')
