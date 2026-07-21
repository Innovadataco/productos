/* eslint-disable @typescript-eslint/naming-convention */
import Route from '@ioc:Adonis/Core/Route'

/**
 * EJEMPLO DE RUTAS CON VERIFICACIÓN DE MÓDULOS
 *
 * Este archivo muestra cómo proteger rutas usando el middleware 'verificarModulo'
 *
 * Sintaxis:
 * .middleware('verificarModulo:nombre_modulo1,nombre_modulo2')
 *
 * El usuario debe tener acceso a AL MENOS UNO de los módulos especificados
 */

const controlador = '../../../app/Presentacion/Ejemplo/ControladorEjemplo'

Route.group(() => {

  // Ruta que requiere el módulo "usuarios"
  Route.get('/usuarios', `${controlador}.listarUsuarios`)
    .middleware('autenticacionJwt')
    .middleware('verificarModulo:usuarios')

  // Ruta que requiere el módulo "mantenimiento"
  Route.get('/mantenimiento', `${controlador}.mantenimiento`)
    .middleware('autenticacionJwt')
    .middleware('verificarModulo:mantenimiento')

  // Ruta que permite acceso con "usuarios" O "administracion"
  Route.get('/reportes', `${controlador}.reportes`)
    .middleware('autenticacionJwt')
    .middleware('verificarModulo:usuarios,administracion')

  // Ruta sin restricción de módulo (solo requiere estar autenticado)
  Route.get('/perfil', `${controlador}.perfil`)
    .middleware('autenticacionJwt')

}).prefix('api/v1/ejemplo')

/**
 * NOTAS IMPORTANTES:
 *
 * 1. El middleware 'verificarModulo' siempre debe ir DESPUÉS de 'autenticacionJwt'
 *    porque necesita el payload JWT para identificar al usuario
 *
 * 2. Puedes especificar múltiples módulos separados por comas
 *    El usuario solo necesita tener UNO de ellos
 *
 * 3. Los nombres de módulos deben coincidir con la columna 'mod_nombre'
 *    en la tabla 'tbl_modulos'
 *
 * 4. Si un usuario tiene módulos personalizados, solo se verifican esos
 *    Si no tiene módulos personalizados, se verifican los de su rol
 */
