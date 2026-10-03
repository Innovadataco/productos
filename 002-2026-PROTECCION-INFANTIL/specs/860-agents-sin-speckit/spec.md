# SPEC-860 · AGENTS.md sin el mandato de Spec-Kit

> Nota de feature **opcional** (estrena la convención que esta misma SPEC fija: `specs/NNN-slug/` es un home opcional de notas, sin set de artefactos obligatorio). Docs-only.

## Qué

Quitar de los `AGENTS.md` del repo `productos` el mandato de **Spec-Kit** (Spec-Driven ceremonial) y la nomenclatura **ZEUS/ODIN**, y dejarlos consistentes con el **flujo vigente**: radicado del CEO → rama `work/pi-SPEC-<N>-<slug>` desde `main` fresco → PR con CI verde + revisión adversarial + certificación (Diseño el render, Calidad el recorrido).

## Por qué

Los `AGENTS.md` los lee toda sesión de IA que trabaje el repo. Mandaban un ciclo (`specify → clarify → plan → tasks → analyze → implement → validate → close`), un set obligatorio de artefactos, `.specify/memory/constitution.md` y un protocolo de señales ZEUS↔ODIN que **ya no se usan**. El flujo real desde hace semanas es radicado → rama → PR. Un documento de arranque que describe un proceso muerto desalinea a cada sesión fresca.

## Alcance (docs-only, sin código)

- `002-2026-PROTECCION-INFANTIL/AGENTS.md`:
  - Restricciones de producto: se dejan (invariantes de negocio) pero su fuente ya no es `.specify/memory/constitution.md` sino el repo de gestión (`REGISTROS/DECISIONES.md`).
  - Bloque de estructura: `specs/` pasa a «notas opcionales por SPEC»; se retira la línea `.specify/`.
  - Sección «Metodología: Spec-Kit» → «Metodología (flujo vigente)» (5 pasos: radicado → rama → candado → push único/PR+CI → certificación). Cae el escalón ceremonial de `Status`.
  - «Reglas de cierre» → las 5 Reglas de Oro vigentes (conservando `./scripts/dev-restart.sh` y la verificación en vivo).
  - «Protocolo de señales (ZEUS ↔ ODIN)» → «(Dev ↔ CEO)», con las seis señales del canal y el test binario de la Nota.
- `AGENTS.md` (raíz del repo, compartido por todos los productos):
  - «Lider · ZEUS» → «Responsable · CEO»; «Uso por ODIN» → «Flujo de trabajo»; metodología «PM2 + Spec Kit / dos agentes ZEUS·ODIN» → flujo vigente + roles del modelo de 7; «Reporte a ZEUS» → «Reporte al CEO».
- `specs/README.md` → sección «Convención de archivos por spec» (plegada por VEREDICTO del CEO, 03-10 04:05): la obligación de `spec.md`+`plan.md`+`cierre.md` por spec cerrada pasa a **notas OPCIONALES de la feature**. Solo esa sección narrativa; la tabla autogenerada (marcadores `SPEC-413:BEGIN/END`) NO se toca.

Las menciones a ZEUS/ODIN/Spec-Kit que quedan son **explicativas** («era el nombre viejo», «quedó atrás»): no reescriben el histórico, enrutan al lector (misma regla que `CLAUDE.md` en gestión).

## Fuera de alcance (hallazgos para el CEO)

- `.specify/` sigue en disco (legacy). No se borra: el radicado es docs de AGENTS.md/README, no limpieza de archivos.
- El índice `specs/README.md` conserva menciones históricas a ZEUS/ACTA-VALIDACION en su prólogo y en estados de specs viejas — es registro histórico del índice (lo regenera el barrido post-merge), no se reescribe acá.

## Verificación

Docs-only: no hay código, schema, ni endpoints que ejercer. El CI skipea casi todo (como #855). Control positivo del cambio: `grep` de los tokens del mandato (Spec-Kit obligatorio, `constitution`, `.clinerules`, `quickstart`, ZEUS/ODIN como roles vivos) devuelve **0** ocurrencias de mandato en ambos archivos; solo quedan las menciones explicativas de retiro.
