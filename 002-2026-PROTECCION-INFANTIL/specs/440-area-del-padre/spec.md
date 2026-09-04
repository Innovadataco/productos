# SPEC-440 · Correcciones del área del padre — punto 1 primero (I-306)

**Status**: IMPLEMENTADO (punto 1 · los otros 4 quedan como follow-up en tasks.md)
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: Jelkin probando en vivo el 04-09 ~15:4x. Radicado por CEO idc-66 con orden explícita: «punto 1 primero».

## Punto 1 · Datos personales en la barra de direcciones (I-306) 🔴

**Qué pasaba** (verificado por Jelkin en prod): al elegir psicólogo, la URL era `?u=ESTA_SEMANA&pres=Soy+Jelkin+Zair+Carrillo+Franco…con+mi+2+hijos+de+14+y+16+años`. Nombre completo del padre y edades de los menores en la barra de direcciones, historial del navegador, logs del servidor y `referer` de cada request saliente. Regla de la casa: **datos personales van en cuerpo o en estado de sesión; nunca en la URL**.

### Cambios

- **Nuevo helper `src/lib/padre/borrador-consulta.ts`**: `leerBorradorConsulta()` / `guardarBorradorConsulta()` / `borrarBorradorConsulta()`. Usa `sessionStorage` (sobrevive recargas y navegación dentro de la pestaña; muere al cerrarla; no aparece en logs). Tolerante a Safari privado, storage bloqueado y SSR (`typeof window === "undefined"`).
- **`PresentacionUrgenciaForm`**: al continuar, guarda el borrador en sessionStorage y navega a `/dashboard/padre/profesionales/directorio` sin `?u=&pres=`. Al montar, prellena desde el borrador (si el padre navegó atrás, no vuelve a contar la historia).
- **`DirectorioProfesionales`**: retirados los props `urgenciaInicial`/`presentacionInicial` y su propagación al perfil. El link al perfil sólo lleva IDs opacos (`expedienteId`, `heredarDe`).
- **`ProfesionalPerfil`** (client): retirados props `presentacionDelPadre`/`urgencia`. La lectura del borrador la hace `SolicitarCitaPanel` (client).
- **`SolicitarCitaPanel`**: al montar, lee el borrador (sólo si NO es reasignación); en el POST exitoso limpia el borrador con `borrarBorradorConsulta`.
- **Pages server** (`profesionales/page.tsx`, `directorio/page.tsx`, `[id]/page.tsx`): tipan `searchParams` SIN `u` ni `pres`. Cualquier PR futura que reintroduzca esos parámetros cae en el candado.

### Candado por conducta (ratchet permanente)

**`src/lib/padre/borrador-consulta.candado.test.ts`** escanea las 7 rutas del flujo del padre → profesional y falla si aparece cualquiera de:
- `q.set("pres", …)` / `q.set("u", …)`.
- `new URLSearchParams({ pres: …, u: … })`.
- Strings literales con `?pres=`, `&pres=`, `?u=`, `&u=`.
- Server components tipando `searchParams: { pres?: string; u?: string }`.

**Verificado en la mesa**: introduje `new URLSearchParams({ u, pres })` en el form → candado rojo con «presentación en URLSearchParams object». Restaurado.

## Verificación

- `tsc --noEmit`: verde.
- `arch:check`: VERDE en los 7 gates.
- `tokens:check`: piso 1079 intacto.
- `npm run lint`: 0 errors.
- Suites nuevas: `borrador-consulta.candado.test.ts` (2/2). Regresión probada.

## Impacto en arquitectura:

- Formaliza la regla «PII fuera de la URL» para el flujo del padre — helper y candado a la vez.
- `sessionStorage` es el mecanismo elegido para estado efímero del cliente en este flujo. Solución interina hasta que P5 persista la presentación en el perfil del padre — cuando eso se implemente, el helper puede seguir sirviendo como caché rápida y evitar un GET por navegación.

## Fuera de alcance (queda como P2..P5 en `tasks.md`)

- P2 · El círculo dibuja solo 4 personas (bug de layout con 5+ personas).
- P3 · `/mis-reportes` sin menú lateral «Mi protección».
- P4 · Perfil del padre editable (A-67 §59 · campos en Usuario).
- P5 · No pedir presentación cada vez — persistir en perfil.

Los 4 son mejoras separables del bloqueante I-306. CEO priorizó P1 explícitamente («punto 1 primero»); se abrirá follow-up para los otros.

## Referencias

- **I-306** (verificado por Jelkin en la URL del navegador de producción).
- **SPEC-392** — flujo original que introdujo los query params.
- Worktree `.worktrees/pi-SPEC-440` desde `origin/main d0b30369d`.
