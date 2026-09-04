# SPEC-442 · El camino del colegio, sin callejones — cierra I-307

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: Jelkin en vivo 04-09 ~16:0x con la cuenta del rector, textual: *«pésima usabilidad»*, *«acá no puedo continuar, estoy trabado»*. Radicado por CEO idc-66. Verifiqué en fuente: `admin/colegios/route.ts` (POST) NO invocaba `crearCursosPorDefecto` — el hueco de alta está VIVO hoy, no es sólo historia (`sagrado corazon`).

## Para qué

1. **El rector del colegio real quedó trabado en el paso 4**: la pantalla afirma *«Le dejamos los 11 grados»* y muestra 0. Continuar exige ≥1, no había forma de crear uno y no había botón atrás.
2. En el paso 3, **«Agregar profesor» sacaba al rector fuera del camino** al panel `/dashboard/colegio/profesores?crear=1`.
3. **El selector de año de nacimiento** permitía años futuros y menores de edad.
4. En el paso «plan», los planes se veían apilados (`max-w-md`) y aparecían **dos footers duplicados** («Salir y seguir después · Este no es mi correo»).

## Cambios

### Punto 1 · Semilla obligatoria + pantalla honesta + salida siempre

- **`src/lib/colegio/semilla-colegio.ts`** (nuevo): `sembrarSemillaColegio(colegioId, cliente, opciones?)` que agrupa materias + cursos + onboarding en un solo lugar. Idempotente (cursos por `findFirst→create`; materias por unique; onboarding chequea fila única).
- **Los tres callers que crean `Colegio` en producción pasan por el helper**:
  - `src/app/api/admin/colegios/route.ts:265` (alta por administración — **el hueco vivo que originó I-307**; antes sembraba solo materias).
  - `src/lib/dal/services/registro-colegio.ts:311` (registro público del rector — antes tres llamadas separadas).
  - `scripts/smoke-prod-safe.ts` (smoke contra prod — antes creaba colegio efímero SIN cursos; si el smoke se interrumpía dejaba huérfano).
- **`src/app/camino/colegio/cursos/page.tsx`**: título y copia **derivados del conteo real** — «Cargando…» / «No hay cursos configurados. Cree uno para continuar.» / «Tiene N cursos activos.» Nunca promete N sin haberlo contado. CTA «Crear un curso» in-place (POST `/api/colegio/cursos`). Botón «Atrás» al paso profesores.
- **Reparación hacia atrás**: `scripts/spec-442-reparar-colegios-sin-cursos.ts` recorre `Colegio` activos con 0 cursos y llama al helper. Idempotente: NO duplica sobre lo que el CEO ya reparó a mano (`sagrado corazon` ya en 11).

### Punto 2 · «Agregar profesor» sin salir del camino

- **`src/app/camino/colegio/profesores/page.tsx`**: reemplazado el `<Link href="/dashboard/colegio/profesores?crear=1">` con **formulario individual in-place** — 8 campos (nombre, apellidos, tipoDoc, número, año, sexo, email, teléfono). POST `/api/colegio/profesores` + recarga. El wizard Excel ya vivía dentro del paso. Botón «Atrás» al paso plan.

### Punto 3 · Año de nacimiento con rango real

- **UI form individual** (`ProfesoresPageClient.tsx:449`): `<Input type="number" min={añoActual-80} max={añoActual-18} step={1}>` + validación en submit (`RANGO_ANIO_NACIMIENTO`).
- **UI form del paso** (`camino/colegio/profesores/page.tsx`): mismo rango, misma validación.
- **Backend / Zod** (`src/lib/schemas/identidad.ts`): `.gte(año-80).lte(año-18)` con mensajes explícitos. Antes: `.gte(1900).lte(año actual)` — permitía profesor de 5 años.
- **Carga por Excel** (`src/lib/colegio/carga-profesores/validator.ts:86`): mismo rango, mismo mensaje.

### Punto 4 · Paso «plan» — ancho y footer duplicado

- **Footer duplicado**: los dos layouts anidados (`camino/layout.tsx` + `camino/colegio/layout.tsx`) pintaban CADA UNO el par «Salir y seguir después · Este no es mi correo». En el flujo colegio, el layout padre se reduce a `<>{children}</>` (el hijo pinta todo el chrome).
- **Ancho**: el layout colegio limita a `max-w-md` (mobile-first del brief). SÓLO el paso plan pasa a `max-w-4xl` porque `PlanesSelector` renderea una grilla; el resto de pasos sigue en móvil.
- Botón «Atrás» agregado también en `plan/page.tsx` y `estudiantes/page.tsx` (servidor).

## Candado — comportamiento, no palabras

**`src/lib/colegio/semilla-colegio.test.ts`** ejercita los DOS callers de producción (admin + registro público) y afirma `curso.count(activo) === 11`. Verificado en la mesa: si borro la línea `await sembrarSemillaColegio(...)` de `admin/colegios/route.ts`, el test `caller 1` se pone rojo. No es grep del nombre — es la conducta lo que muere. El `scripts/smoke-prod-safe.ts` no corre en la suite; su candado es su propio hard-coded «después del `prisma.colegio.create` llamo al helper», visible en el diff del PR.

## Verificación

- `tsc --noEmit`: verde.
- `arch:check`: VERDE en los 7 gates.
- `tokens:check`: piso 1079 intacto.
- `npm run lint`: 0 errors.
- **Suite nueva** `semilla-colegio.test.ts` — 2/2. Regresión verificada: sacar la llamada al helper de `admin/colegios/route.ts` → test rojo listando «Expected 0 to be 11». Restaurado.

## Impacto en arquitectura:

- **Un solo lugar** para la semilla obligatoria del `Colegio` (`sembrarSemillaColegio`). Si aparece un cuarto camino de alta, sabe qué llamar y no puede olvidarse.
- La página del paso 4 pasa de «pantalla que promete» a «pantalla que cuenta y ofrece salida», patrón que aplica al resto del camino: NO expulsar, SIEMPRE ofrecer atrás.
- Ancho del layout colegio se convierte en función de la ruta (excepción para `plan`). Cuando aparezca otro paso con contenido más ancho, se agrega al mismo lugar.

## Fuera de alcance

- Estudiantes también expulsan al rector (`/dashboard/colegio/cursos/unificado`, `/dashboard/colegio/cursos`). El radicado nombró SOLO profesores; agregué botón «Atrás» al paso estudiantes pero no cambié el flujo. Queda pendiente convertirlo en carga in-place (SPEC follow-up).
- Nombre del helper (`sembrarSemillaColegio`) queda intocable hacia atrás — mover el archivo requiere migrar los tres callers y el candado.

## Referencias

- **I-307** (verificado por CEO en fuente + BD prod).
- **SPEC-344** — origen de `crearCursosPorDefecto`; el commit `7ef2ccca0` la agregó al registro público.
- **SPEC-162** — materias por defecto.
- **SPEC-169** — OnboardingColegio (fila única).
- Worktree `.worktrees/pi-SPEC-442` desde `origin/main d0b30369d`.
