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

### Punto 3 · Año de nacimiento con rango real (el candado vive en el servidor)

I-262 ya nos había enseñado que la edad calculada en el cliente se salta con curl o DevTools. Acá el `min/max` del `<Input>` es UX (feedback inmediato); el candado real vive en Zod, y el test lo empuja con los 4 casos del radicado.

- **Backend / Zod** (`src/lib/schemas/identidad.ts`): `.gte(año-80).lte(año-18)` con mensajes explícitos. Antes: `.gte(1900).lte(año actual)` — permitía profesor de 5 años.
- **Carga por Excel** (`src/lib/colegio/carga-profesores/validator.ts:86`): mismo rango, mismo mensaje.
- **UI form individual** (`ProfesoresPageClient.tsx:449`): `<Input type="number" min={añoActual-80} max={añoActual-18}>` + validación en submit (`RANGO_ANIO_NACIMIENTO`) — UX/first-line.
- **UI form del paso** (`camino/colegio/profesores/page.tsx`): mismo rango y validación.
- **Test integración** `src/app/api/colegio/profesores/route.test.ts` (POST):
  - año actual + 1 → 400.
  - año actual − 17 → 400.
  - año actual − 18 → 201.
  - año actual − 80 → 201.

### Punto 4 · Paso «plan» — ancho y footer duplicado (impacto del layout compartido)

**Rutas bajo `/camino/**` y qué layout heredan** (verificado con `ls` sobre el árbol):

| Ruta | `camino/layout.tsx` | `camino/colegio/layout.tsx` |
|---|---|---|
| `/camino/datos` | sí | — |
| `/camino/hijos` | sí | — |
| `/camino/plan` | sí | — |
| `/camino/listo` | sí | — |
| `/camino/colegio/rector` | sí (colapsa) | sí |
| `/camino/colegio/plan` | sí (colapsa) | sí |
| `/camino/colegio/profesores` | sí (colapsa) | sí |
| `/camino/colegio/cursos` | sí (colapsa) | sí |
| `/camino/colegio/estudiantes` | sí (colapsa) | sí |
| `/camino/colegio/listo` | sí (colapsa) | sí |

- **Footer duplicado**: en las 6 rutas del colegio, los dos layouts pintaban CADA UNO el par «Salir · Este no es mi correo». Cuando el pathname empieza con `/camino/colegio`, el padre se reduce a `<>{children}</>` y el hijo es la fuente única del chrome. **Las 4 rutas del padre (datos, hijos, plan, listo del PADRE) NO se afectan** — el `startsWith` no las alcanza, siguen con SU footer y SU salida a `/registro`.
- **Ancho**: el layout colegio limita a `max-w-md` (mobile-first del brief). SÓLO `/camino/colegio/plan` pasa a `max-w-4xl` porque `PlanesSelector` renderea una grilla; el resto de pasos sigue en móvil. Es cambio de una sola ruta; no toca ancho de las 4 rutas del padre.
- Botón «Atrás» agregado también en `plan/page.tsx` y `estudiantes/page.tsx` (servidor).

## Candado — comportamiento, no palabras (los TRES callers)

**`src/lib/colegio/semilla-colegio.test.ts`** ejercita los tres callers de producción y afirma `curso.count(activo) === 11` para cada uno.

Para no correr el smoke completo contra producción desde CI (RIESGO CEO 04-09 13:31), extraje la creación del colegio del smoke a `crearColegioParaSmoke()` — función exportada, invocable, marcada con prefijo estable `[SMOKE]`. El test ejercita ESA función; el script del CLI queda como cáscara (`if (!process.env.VITEST) main()`).

**Regresión verificada en la mesa (muriendo con el defecto puesto)**:
- Sacar `await sembrarSemillaColegio(...)` de `admin/colegios/route.ts` → `caller 1` rojo con «Expected 0 to be 11».
- Sacar `await sembrarSemillaColegio(...)` de `registro-colegio.ts` → `caller 2` rojo.
- Sacar `await sembrarSemillaColegio(...)` de `smoke-prod-safe.ts::crearColegioParaSmoke` → `caller 3` rojo.

Los tres restauran verde al devolver la llamada.

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
