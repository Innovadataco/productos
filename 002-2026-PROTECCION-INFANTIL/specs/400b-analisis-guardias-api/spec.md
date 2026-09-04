# SPEC-400b · FASE DE ANÁLISIS — el borde que se abre solo cada 5 minutos (I-236 · I-239)

**Status**: DESARROLLO
**Fecha**: 2026-09-04 · **Dev**: Infra (idc-c0) · **Origen**: veredicto CEO 00:09 (traspaso desde Dev 01, sin rama previa)

## Para qué

`middleware.ts` evalúa los guardianes 4 (`consentimiento`), 5 (`cambio-de-password` + `camino`) y 6 (`vigencia`) SOLO cuando puede leer la cookie firmada `sesion_estado`. Si la cookie **no está** (caducó a los 5 min, es de antes del despliegue, o el navegador la perdió), el bloque `if (estado) { … }` es falso y las tres etapas **se saltan enteras**: la request PASA sin evaluar. Para pantallas HTML de `PARENT` y `SCHOOL_ADMIN` existe un rebote explícito a `/api/sesion/al-dia` (SPEC-339 · A-67), pero **ese rebote NO cubre `/api/**`**: cualquier `/api/**` sin cookie pasa. Ese es el "borde que se abre solo cada 5 minutos".

Jelkin decidió que la corrección se hace con **análisis previo, no como hotfix**. Este PR es solo el análisis: la implementación (código en `middleware.ts`, `proxy.ts`, tests nuevos) se radica aparte con este inventario en la mano.

## Qué trae

### 1) `scripts/arch/generar-guardias-api.ts` (nuevo)

Sigue el patrón de la línea base de arquitectura (`scripts/arch/generar-*.ts`): registrado en `scripts/arch/artefactos.ts` como fila `04-guardias-api.md`. `npm run arch:check` verifica el drift automáticamente sin step nuevo en `verificaciones`.

**Enumeración**: recorre `src/app/api/**/route.ts(x)` con `inventarioRutasApp()` (helper de SPEC-126) — 385 rutas. Candado 22 v5 cumplido: enumeración completa, no muestreo.

**Evaluación por ruta** (usando los helpers reales de `src/lib/routing/guardias.ts`, sin duplicar lógica):

- Si es pública (`esRutaPublica`) → `P` (no llega a los guardianes).
- Si es de sesión (`esRutaSesion`) → `S` (no llega a los guardianes).
- Si es regular: para cada guardián, `SÍ` si la ruta **no** está en la lista de exentas correspondiente.
- Camino y vigencia se ramifican por rol: se listan las dos ramas relevantes (`PARENT` vs `SCHOOL_ADMIN` para camino; roles con vigencia en columnas).

**Fail-open sin cookie**: TODAS las rutas `/api/**` pasan sin evaluar los guardianes 4/5/6 (medido leyendo `middleware.ts:192-296`). Se documenta en la columna para dejarlo explícito.

**Fail-closed propuesto** por ruta:

- `exenta` (48): pública, ruta de sesión, `/api/auth/**`, `/api/sesion/al-dia`, `/api/vigencia/refresh`, `/api/health`, `/api/monitor/notif`, `/api/webhooks/**`, `/api/publico/**`, catálogos (`/api/plataformas`, `/paises`, `/departamentos`, `/ciudades`, `/config/parametros/publicos`), `/api/consulta`, `/api/reportes`, `/api/estadisticas-publicas`, `/api/docs`, `/api/me`, `/api/consentimiento`.
- `decidir` (12): pagos y suscripción. Dos opciones legítimas — SPEC-400b implementación decide con Jelkin/CEO:
  - `(a)` tratar como cualquier `/api/` y exigir vigencia.
  - `(b)` exenta explícita porque **pagar SIN vigencia es cómo se sale de la vencida**.
- `bloquear` (325): el resto — default de "cualquier /api/ regular".

### 2) `docs/architecture/04-guardias-api.md` (nuevo, generado)

Cinco secciones:

1. **Fenómeno medido** — descripción textual de I-236/I-239 con el punto exacto de `middleware.ts` donde ocurre.
2. **Resumen** — totales por veredicto.
3. **Guardianes que aplican HOY (con cookie)** — tabla de 385 filas × 7 columnas (ruta + tipo + 5 guardianes) con `SÍ`/`no`/`—`.
4. **Recomendación fail-closed por ruta** — tabla de 385 filas con `bloquear`/`exenta`/`decidir` + motivo humano por fila.
5. **Decisiones abiertas** — solo las 12 `decidir` con las dos opciones.
6. **Matriz de pruebas de cookie-ausente por guardián × rol** — 24 filas (4 guardianes × 6-8 roles) con "hoy responde 200 (fail-open)" vs "con fail-closed debería responder `403 { code: … }`". Los tests que faltan se implementan en el PR de SPEC-400b, no acá.

### 3) `scripts/arch/artefactos.ts` — registro de la nueva fila

`04-guardias-api.md` se registra junto a los otros artefactos de la línea base. Todo `npm run arch:check` de aquí en adelante lo verifica sin cambios en el workflow.

### 4) `docs/architecture/00-INDICE.md` — regenerado

Índice de la línea base regenerado para incluir la fila 04 nueva.

## Candados

- **SPEC-400b es análisis, no fix**: cero cambios en `middleware.ts`, `proxy.ts`, `guardias.ts`, `roles-titulares.ts`, `middleware-api-guardias.test.ts` o cualquier código de producción.
- **Enumeración completa (candado 22 v5)**: los 385 archivos `route.ts` de `src/app/api/**` se listan y evalúan, uno por uno.
- **Sin duplicar lógica**: el generador IMPORTA los helpers reales de `guardias.ts`. Si mañana `esExentaVigencia` cambia, el generador ve el cambio y el drift lo delata en `arch:check`.
- **Determinístico**: mismo commit → mismo output byte-a-byte. `encabezadoGenerado()` no incluye timestamp por diseño.
- **Sin decidir por Jelkin**: las 12 rutas `decidir` se listan con las dos opciones. El generador NO elige.
- **Cero deps nuevas**.

## Impacto en arquitectura: no

Un script nuevo bajo `scripts/arch/`, un artefacto autogenerado en `docs/architecture/`, una fila en `artefactos.ts`. Sin schema, sin API, sin runtime, sin tests de producción.

## Cómo se probó

- Ejecutado local: `npx tsx scripts/arch/generar-guardias-api.ts` → 385 rutas listadas, resumen `325 bloquear · 48 exenta · 12 decidir`. Las 12 `decidir` son todas de `/api/pagos/` y `/api/(padre|colegio)/suscripcion` — coincide con la anticipación del CEO.
- `npm run arch:check` verde tras regenerar el índice (`00-INDICE.md`). Cazará cualquier drift futuro.

## DoD

- [x] Generador escrito con enumeración completa + helpers reales.
- [x] Artefacto generado con las 5 secciones y las 12 decisiones abiertas.
- [x] Registro en `artefactos.ts` y `00-INDICE.md` regenerado.
- [x] `npm run arch:check` verde local.
- [ ] `tsc` + `lint` limpios.
- [ ] `specs-discipline` + generador de README de SPEC-413 se cumplen (fila 400b sale sola).
- [ ] CI del PR verde.

## Siguiente paso (SPEC-400b implementación — PR aparte)

- Decidir con Jelkin/CEO las 12 rutas `decidir`.
- Escribir el fail-closed en `middleware.ts` (bloque nuevo cuando `!estado` para `/api/**` regulares, con excepciones desde el catálogo del análisis).
- Añadir los 24 tests de la matriz de cookie-ausente en `middleware-api-guardias.test.ts`.
- Documentar la migración en un plan aparte (rollout gradual con `feature-flag`).
