// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  //urlAlcoholimetria:'https://pruebasterminales.supertransporte.gov.co/api-procesos',
  urlAlcoholimetria:'http://127.0.0.1:5050',
  urlBackendDespachos: 'https://msdespachosback.thankfulbeach-21114078.eastus.azurecontainerapps.io',
  urlBackend: 'http://2.25.77.158/api',
  /* urlParametricas: 'https://msparametricasqa.thankfulbeach-21114078.eastus.azurecontainerapps.io', */
  urlParametricas: 'https://parametricasback.azurewebsites.net',
  urlBackendVigia: 'http://172.16.3.104:3334',
  urlBackendRutas: 'https://rutasbackend.azurewebsites.net',
  urlApiIntegradora: 'https://pruebasterminales.supertransporte.gov.co/api-integradora/resumen',
  urlBackendArchivos: 'https://archivosbackend.azurewebsites.net',
  tokenBackendArchivos: 'REDACTED-TOKEN-ARCHIVOS',
  llaveCaptcha: 'REDACTED-CAPTCHA-SITEKEY',
  /* urlVigia2: 'https://sinstfrontend.azurewebsites.net', */
  urlUTP: 'http://sinstqa.supertransporte.gov.co',
  /* urlProveedores: 'https://proveedoresbackend.azurewebsites.net', */

  /* urlSinst:'https://sinstbackend.azurewebsites.net', */
  urlApiIntegradoraV2: 'https://pruebasterminales.supertransporte.gov.co/api-procesos',

  tokenParametricas: 'REDACTED-TOKEN-PARAMETRICO'
};


/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
