/**
 * Resolución de la bandera `Secure` de la cookie de sesión (spec 004, FR-004 / D-036).
 *
 * Es una **característica de despliegue**, no un parámetro de negocio: se lee
 * exclusivamente de la variable de entorno `AUTH_COOKIE_SECURE` y NUNCA de
 * `ModuleSetting` ni de ningún ajuste editable desde la interfaz. Un control de
 * seguridad de la sesión no puede poder apagarse desde la UI de la aplicación.
 *
 * Esta es la excepción explícita a la precedencia general de la constitución §0.7
 * (BD/UI > entorno > default): aquí el entorno es la única fuente admitida.
 *
 * Tampoco depende de `NODE_ENV`: la imagen fija `NODE_ENV=production` mientras el
 * servicio se consume por `http://localhost`, y esa combinación hacía que Safari
 * descartara la cookie (incidencia I-005).
 *
 * Default **seguro**: solo el valor explícito `"false"` la desactiva. Cualquier otro
 * contenido —ausente, vacío, "sí", "1", basura— deja la bandera activada.
 */
export function cookieSecure(): boolean {
  return (process.env.AUTH_COOKIE_SECURE ?? "").trim().toLowerCase() !== "false";
}
