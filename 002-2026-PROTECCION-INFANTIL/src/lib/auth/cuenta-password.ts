/**
 * SPEC-609 (I-371 · «una cuenta, una puerta») — ¿la cuenta NO tiene contraseña local?
 *
 * Fuente ÚNICA del predicado, para que el perfil y el flujo de «olvidé mi contraseña» no se
 * desincronicen. El invariante está escrito en el schema (model Usuario): «passwordHash existe» es
 * «googleSub == null O passwordCreadaEn != null». Por lo tanto una cuenta NO tiene contraseña propia
 * exactamente cuando fue creada por Google (`googleSub`) y nunca creó una clave local
 * (`passwordCreadaEn == null`). El `passwordHash` de esas cuentas es un secreto aleatorio, no usable.
 *
 * Para estas cuentas «olvidé mi contraseña» no tiene sentido (no hay contraseña que restablecer) y
 * ofrecerles «crear contraseña» sin que la pidan confunde (reparos 2 y 3 de Jelkin, revierte SPEC-598).
 *
 * SPEC-616 (I-375): también es la fuente única en el CLIENTE — el `NavHeader` la usa para no ofrecer
 * «Crear contraseña» en el menú. El servidor la llama con `passwordCreadaEn: Date`; el cliente, con la
 * forma serializada (`string`). Por eso el parámetro acepta ambas: el predicado solo mira si es nula.
 */
export function cuentaSinContrasenaLocal(usuario: {
    googleSub?: string | null;
    passwordCreadaEn?: Date | string | null;
}): boolean {
    return Boolean(usuario.googleSub) && usuario.passwordCreadaEn == null;
}
