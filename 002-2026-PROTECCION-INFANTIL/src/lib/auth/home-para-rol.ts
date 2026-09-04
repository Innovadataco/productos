/**
 * SPEC-319 (002-PI-219 · I-212) — Fuente ÚNICA del destino de inicio por rol (cliente).
 *
 * Antes existían tres copias divergentes de este mapa (`login/page.tsx`,
 * `cambiar-password/page.tsx`, `mis-reportes/page.tsx`) y las tres omitían
 * `COMITE_CONVIVENCIA`, así que el comité caía al default `/mis-reportes` (pantalla
 * del padre) con error. Además dos de ellas se contradecían para `OPERADOR`.
 * Esta función es la única fuente de verdad del landing, consumida por los tres sitios.
 *
 * COHERENTE CON `homeForRole` (src/lib/proxy.ts) — que quedó fuera del runtime del
 * landing (SPEC-287). Si cambia el mapa canónico, actualizar AMBOS y NO importar uno
 * desde el otro: `proxy.ts` arrastra dependencias de edge/middleware que no deben
 * entrar a un componente cliente.
 *
 * Decisión A (CEO 2026-08-30, cierra deuda A-54/SPEC-317): `PARENT → /dashboard/padre`.
 * Cualquier rol NO mapeado cae al default `/mis-reportes` como fallback neutro: es una
 * página que no re-dispara un guard de rol, así que no genera loop de rebote.
 *
 * OJO — NO confundir con el rebote de `/mis-reportes`: esta función decide EL LANDING
 * (a dónde va un rol al entrar). El rebote de `/mis-reportes` es un guard aparte, por
 * lista explícita de roles con panel propio (excluye PARENT); ver `mis-reportes/page.tsx`.
 */
export function homeParaRol(rol: string | undefined): string {
    switch (rol) {
        case "ADMIN":
            return "/dashboard/admin";
        case "OPERADOR":
            // Unifica la contradicción previa (login decía /dashboard/admin/operadores).
            return "/dashboard/admin";
        case "SCHOOL_ADMIN":
            return "/dashboard/colegio";
        case "COMITE_VALIDACION":
            return "/dashboard/admin/comite";
        case "COMITE_CONVIVENCIA":
            return "/dashboard/colegio/comite";
        // SPEC-408 (A-75 · brief §9): el Verificador aterriza en su cola de
        // trabajo — es el único módulo que tiene.
        case "VERIFICADOR":
            return "/dashboard/admin/verificacion";
        // SPEC-425 (A-75 · L5): el profesional aterriza en SU panel. SPEC-424 lo
        // había apuntado a `/perfil-profesional/verificacion` —lo único que
        // existía— para cerrar el rebote al área del padre sin esperar este
        // lote; ahora que el panel existe, la línea se mueve a su casa.
        case "PROFESIONAL":
            return "/dashboard/profesional";
        case "PARENT":
            // Decisión A: el padre aterriza en su dashboard, no en la lista vieja.
            return "/dashboard/padre";
        // SPEC-424 (I-299): el profesional aterriza en su propia área. Su panel
        // (SPEC-425 · lote L5, Dev 02) todavía no existe; hasta que exista,
        // aterriza en su pantalla de verificación (la única que ya tiene).
        // **Cuando SPEC-425 mergee, cambiá esta línea a `/dashboard/profesional`.**
        // Es UNA línea — no hay más callsites que actualizar acá.
        case "PROFESIONAL":
            return "/perfil-profesional/verificacion";
        default:
            // Rol desconocido/futuro: fallback neutro que no dispara rebote (sin loop).
            return "/mis-reportes";
    }
}
