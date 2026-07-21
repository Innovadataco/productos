/*
|--------------------------------------------------------------------------
| Validating Environment Variables
|--------------------------------------------------------------------------
|
| In this file we define the rules for validating environment variables.
| By performing validation we ensure that your application is running in
| a stable environment with correct configuration values.
|
| This file is read automatically by the framework during the boot lifecycle
| and hence do not rename or move this file to a different location.
|
*/

import Env from '@ioc:Adonis/Core/Env'

export default Env.rules({
  HOST: Env.schema.string({ format: 'host' }),

  SMTP_HOST: Env.schema.string({format: 'host'}),
  SMTP_PASSWORD: Env.schema.string(),
  SMTP_USERNAME: Env.schema.string(),
  SMTP_PORT: Env.schema.number(),

  EMAIL_ALIAS: Env.schema.string(),

  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string(),
  DRIVE_DISK: Env.schema.enum(['local'] as const),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),

  JWT_SECRET_KEY: Env.schema.string(),

  // Credenciales y URL para login en aplicativo externo
  EXTERNAL_APP_LOGIN_URL: Env.schema.string(),
  EXTERNAL_APP_USER: Env.schema.string(),
  EXTERNAL_APP_PASSWORD: Env.schema.string(),

  TIMEZONE_OFFSET_HOURS: Env.schema.number.optional()
  ,
  // Nombre de archivo del logo (ubicado en uploads/logos o public/logos según tu estrategia)
  LOGO: Env.schema.string.optional(),

  // Activa el bloqueo de credenciales por intentos fallidos
  BLOQUEO_CREDENCIALES: Env.schema.boolean.optional()
})
