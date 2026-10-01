# SPEC-826 · Borrar los 10 huérfanos viejos de SPEC-654 (deuda con dueño, no limpieza)

**Feature Branch**: `work/pi-SPEC-826-borrar-huerfanos-654`
**Created**: 2026-10-01
**Status**: DESARROLLO
**Base**: `main` (`7aea8d429`)
**Origen**: la auditoría de los 21 huérfanos (medición Dev-3). 10 entradas de SPEC-654 llevaban 20 días
declaradas como «candidato a limpieza» / «VERIFICAR y borrar» — deuda con dueño, no funcionalidad perdida.

## Alcance — borrar 10 módulos huérfanos (0 importadores de producción, verificado)

**componente-muerto (residuo de rediseños):**
- `LandingFeatures.tsx` · `RegistroForm.tsx` · `VerificacionForm.tsx` · `padre/ExpedienteDetalleClient.tsx` ·
  `padre/SemaforoItem.tsx` (+ su test propio).

**infra-test-muerta:** `lib/test-auth.ts` (sin ningún importador, ni tests).

**servicio-superseded (verificado leyendo el reemplazo, no el comentario):**
- `expediente/lectura-capa1.ts` (+ test) — su criterio (Bogotá=UTC-5, no UTC) vive en `armar-payload.ts`
  (`franjaDe`). Nota: el reemplazo usa 4 bloques de 6 h vs los 8 de 3 h del muerto → en rigor es CÓDIGO
  MUERTO (su salida no la usa nadie), no «superseded» estricto; igual seguro de borrar (0 importadores).
- `analytics/usuarios-query.ts` — `construirWhereUsuarios` sin un solo importador; el panel admin arma su
  propio where en el DAL.
- `colegio/carga-profesores/importer.ts` — `importarCargaProfesores` superseded por la persistencia INLINE
  de `carga-profesores/confirmar/route.ts` (loop + dedup P2002 → duplicadosRace + consumirSesionRoster).
- `notificaciones/admin-service.ts` — duplicado; `dal/services/notificacion-admin.ts` existe y es el que
  usan las rutas.

## El barrido — TRES clases de candado por módulo (un grep de imports no ve las últimas dos)

- **Import:** cero (los 10 son huérfanos verificados contra `origin/main`).
- **Lector de FUENTE por ruta (candados que abren el archivo por su path):**
  - `voz-cuenta.candado.test.ts` listaba `LandingFeatures.tsx` → entrada retirada.
  - `forms-publicos-sin-color-crudo-estado.candado.test.ts` tenía `RegistroForm`/`VerificacionForm` en
    `CLAVE` → salen con el archivo (mismo patrón que RegistroColegioForm/SPEC-636).
  - `url-privacy.test.ts` tenía `ExpedienteDetalleClient` en `EXENTOS_SPEC_233` (la lista SOLO ENCOGE) → fuera.
  - `colegio-inicio-color-por-valor.candado.test.tsx` leía `SemaforoItem.tsx` por `fs.readFileSync` (la
    contraprueba de rubí) → retirada; se limpiaron los imports `fs`/`path`/`SRC` que quedaron sin uso.
- **Meta/doc:** comentario «Mismo criterio que lectura-capa1.ts» en `armar-payload.ts` → actualizado (ya no
  referencia un archivo borrado). `modulos-huerfanos.ts` lo cita como EJEMPLO HISTÓRICO (sigue siendo cierto) → se deja.

## Catálogo de BD

Ninguno de los 10 crea/usa un objeto de base (son componentes UI + servicios de código; `usuarios-query`
arma un `WhereInput` de Prisma, no un objeto de BD). No hay radio en `pg_depend`/`pg_publication`/
`pg_constraint`/`pg_index`/`pg_trigger`. Cero `CASCADE`.

## Allowlist — además del borrado, dos correcciones de clasificación (de la auditoría)

- **11 `registro-columnas-sensibles.ts` (765): RE-CLASIFICADA** de `hueco-funcional` a **`fuente-de-invariante`**
  (categoría nueva, documentada en la `descripcion`). NO espera cableo: su consumidor vivo es su candado;
  el de producción está descartado por decisión del CEO. SIN salida exigida. (El allowlist mezclaba dos
  deudas distintas bajo una etiqueta; esta es «existe para ser verificado», no «para ser cableado».)
- **13 `copy-correccion-relato.ts` (780): nota actualizada** a la PREGUNTA ABIERTA (qué superficie lo muestra;
  el CEO la mandó a Diseño) en vez de «cuando se construya el canal».

## Impacto en arquitectura:

- **Esquema / proxy / datos:** SIN cambios (no toca schema, migraciones ni objetos de BD).
- **Navegación:** los 5 componentes borrados eran huérfanos (0 importadores) → no estaban en ninguna pantalla
  ni menú; `arch:check` (menú honesto + huérfanos) VERDE.
- **Tests:** se borran 2 tests propios (SemaforoItem, lectura-capa1) con sus módulos; se podan 4 candados de
  los módulos borrados (sin perder cobertura de lo vivo). Allowlist encoge 10 + 1 re-clasificada.
