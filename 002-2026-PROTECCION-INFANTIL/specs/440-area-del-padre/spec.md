# SPEC-440 · Correcciones del área del padre — punto 1 primero (I-306) + puntos 2/4/5 (ola 2)

**Status**: IMPLEMENTADO (P1 en PR #351; P2/P3/P4/P5 en esta ola)
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: Jelkin probando en vivo el 04-09 ~15:4x. Radicado por CEO con orden explícita: «punto 1 primero».

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

## Ola 2 (04-09-2026 tarde) · P2 · P4 · P5 (P3 esperando decisión CEO)

### P2 · El círculo del padre pinta hasta 20 personas
`IlustracionCirculo.tsx` antes hacía `slice(0, 4)` incondicional — un padre con 5 personas veía solo 4. Ahora:
- Con N ≤ 4 conserva la doble diagonal actual + lugares libres (composición estable que el brief valida).
- Con 5 ≤ N ≤ 20 distribuye equidistante en el anillo. Radio del avatar y font adaptativos (más chicos con más gente).
- Sin etiquetas de nombre cuando N > 6 (evita pisado); el nombre sigue vivo en el detalle.
- `aria-label` reporta el total real («7 personas»).
- Nuevo `IlustracionCirculo.test.tsx` (7 tests, unit) — cuenta los puestos dibujados con 0/3/4/5/10/20. **Verificado por mutación**: volver a `slice(0, 4)` mata 4 tests.

### P4 · Perfil del padre editable — enlazado en el nav
La pantalla `/dashboard/padre/perfil` con `PerfilPadreForm` (los 7 campos del brief A-67 §59) ya existía completa desde SPEC-334. SPEC-317 la había RETIRADO del nav lateral por hueco temporal — el padre no podía llegar. Fix quirúrgico: reincorporar `"/dashboard/padre/perfil"` a `PADRE_NAV_ITEMS`; `PadreSideNav.test.tsx` actualizado.

### P5 · La presentación se guarda en el perfil («no volver a pedirla cada vez»)
- **Prisma**: `Usuario.presentacionEstandar String?` + `Usuario.urgenciaEstandar String?` (aditivos, nullable). Sin enum para no atascar `bi_replica` (memoria vigente 04-09).
- **Migración**: `20260904171604_spec_440_presentacion_estandar_padre` con `ADD COLUMN IF NOT EXISTS`.
- **DAL**: `UsuarioRepository.obtenerPerfilPadre` y `actualizarPerfilPadre` incluyen los 2 nuevos campos.
- **API**: `PATCH /api/padre/perfil` extendido con validación Zod (`presentacionEstandar` min 10 max 500; `urgenciaEstandar` enum «ESTA_SEMANA» | «SIN_APURO»). El GET los devuelve.
- **UI**: `PresentacionUrgenciaForm` — al montar, si sessionStorage está vacío cae al perfil; el borrador GANA cuando existe (es lo más fresco). Al enviar, `guardarBorradorConsulta` + PATCH al perfil (fire-and-forget: el PATCH no bloquea la navegación).
- **Nuevo `PresentacionUrgenciaForm.test.tsx`** (4 tests unit) — prellena desde perfil, borrador gana, PATCH al enviar, PATCH que falla no bloquea. **Verificado por mutación**: quitar el PATCH mata el test específico.
- **`route.test.ts`** de `/api/padre/perfil` — +4 tests: persiste, GET devuelve, rechaza urgencia inválida, rechaza presentación corta.

### Reparación en prod (post-merge)
La migración `20260904171604_spec_440_presentacion_estandar_padre` es aditiva idempotente. `prisma migrate deploy` la aplica sin backfill (los usuarios existentes ven `presentacionEstandar = NULL` y el form arranca vacío). No hay riesgo de lockout ni migración de datos.

### P3 · `/mis-reportes` reusa el shell del área del padre (CEO 17:1x · opción B)
Radicado literal (Jelkin, 04-09): «Todas las pantallas del padre traen la barra "Mi protección"; esta no. Misma barra, mismo componente». `/mis-reportes` era la única página del padre sin shell — `src/app/mis-reportes/layout.tsx` solo aplicaba la guarda de vigencia. CEO decidió opción (B): se AGREGA el sidebar, no se le quita al resto.

- **`src/app/mis-reportes/layout.tsx`** extendido con la misma estructura que `/dashboard/padre/layout.tsx`: `PadreSideNav` a la izquierda + `PadreNavMovil` en móvil + banner de vigencia en `EN_GRACIA`. Preserva la guarda SPEC-119 (padre vencido → `ServicioVencidoScreen`). Anónimos y roles internos que entren por link de seguimiento pasan sin shell (backwards compat, no fuerzan sidebar del padre a quien no lo es).
- **`src/app/mis-reportes/layout.candado.test.ts`** (unit, 4 tests) verifica que el layout monta `PadreSideNav` + `PadreNavMovil`, usa `theme-padre` (coherencia visual), y preserva `verificarVigenciaCliente` + `ServicioVencidoScreen`. Verificado por conducta: retirar el import de `PadreSideNav` cae el candado.

## Referencias

- **I-306** (verificado por Jelkin en la URL del navegador de producción).
- **SPEC-392** — flujo original que introdujo los query params.
- Worktree `.worktrees/pi-SPEC-440` desde `origin/main d0b30369d`.
