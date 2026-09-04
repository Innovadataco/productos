# Plan · SPEC-400b · análisis guardias `/api/**`

**Status**: DESARROLLO
**Fecha**: 2026-09-04 · **Dev**: Infra (idc-c0)

## Decisiones

**El generador se registra en `artefactos.ts` — no hay step nuevo en `verificaciones`.** El sistema de línea base (SPEC-126) ya tiene un `arch:check` que recorre todos los artefactos y hace drift byte-a-byte. Añadirlo al array integra automáticamente el candado — cero cambios de workflow. Alternativa descartada: un step propio; hubiera duplicado el mecanismo.

**El artefacto es `04-guardias-api.md`, no `03-guardias-api.md`.** El CEO nombró "03" en su mensaje, pero `03-pantallas.md` ya existe. Uso el slot libre 04. Sin conflicto de intención; con conflicto de nombre.

**El generador IMPORTA los helpers reales, no los duplica.** `esRutaPublica`, `esExentaConsentimiento`, `esExentaCamino`, `esExentaVigencia`, `tieneVigencia`, `esTitularDelDato`, `tieneCaminoGuiado` — todos vienen de `src/lib/routing/guardias.ts` y `src/lib/routing/roles-titulares.ts`. Si un helper cambia, el generador ve el cambio y `arch:check` lo delata al día siguiente.

**Fail-closed se recomienda por prefijo, con "decidir" abierto.** El catálogo de exentas se lista explícito en el script (18 prefijos). Las 12 rutas `decidir` son un prefijo separado que devuelve texto con las dos opciones — el generador no elige. Regla del CEO: "no decidas: marcala 'decidir' con las dos opciones".

**La matriz de cookie-ausente se emite pero los tests NO se escriben.** El scope es análisis. Los 24 tests que faltan (4 guardianes × 6-8 roles) se implementan en el PR de SPEC-400b código, con la matriz de este documento como especificación. Escribir tests acá sería empezar el fix.

**Roles listados incluyen los que existirán, no solo los que existen.** `VERIFICADOR` está en SPEC-408 (en desarrollo). Se incluye en la matriz para que el día que aterrice no haya que re-generar. Cost cero.

**Comentarios `//` en el script, no JSDoc `/** */`.** Aprendizaje del SPEC-413: esbuild + tsx tiene bug de parsing con `-->` y `--` en JSDoc. Comentarios `//` evitan el problema.

**Comillas dobles en literales de string, o `«»`.** Aprendizaje también del SPEC-413: comillas dobles sin escapar dentro de strings de comillas dobles rompen el parse. Usar `«»` es preferible en el texto humano; escapar cuando sea necesario.

## Archivos

- **NUEVO** `scripts/arch/generar-guardias-api.ts` — el generador.
- **EDIT** `scripts/arch/artefactos.ts` — fila nueva para `04-guardias-api.md`.
- **NUEVO** `docs/architecture/04-guardias-api.md` — el artefacto generado.
- **EDIT** `docs/architecture/00-INDICE.md` — regenerado para incluir la nueva fila.
- **EDIT** `specs/README.md` — regenerado con el generador de SPEC-413 (fila 400b sale sola).
- **NUEVO** `specs/400b-analisis-guardias-api/{spec,plan,tasks}.md`.

## Riesgos

- **El generador se atrasa cuando cambian las exentas**: cazado por `arch:check` — quien toque las listas de `GUARDIAS_ACCESO` verá el drift y regenerará. Es exactamente el mecanismo que el CEO quiere.
- **Un helper nuevo (por ejemplo un guardián 7)**: hay que editar el generador para listarlo. No es un "descubrimiento silencioso" — es un cambio explícito con drift esperado.
- **`arch:check` no distingue "cambio de política" de "drift accidental"**: si alguien cambia una lista de exentas, el drift indica QUÉ cambió pero no POR QUÉ. Convención del proyecto: quien cambie una lista de exentas commitea juntos `guardias.ts` + `04-guardias-api.md` + explicación en el commit.
