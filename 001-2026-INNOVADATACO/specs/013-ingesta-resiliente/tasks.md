# Tasks: Ingesta resiliente y documentos no indexables

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md)

**Sin migración, sin dependencias, sin trabajo pesado.**

---

## Phase 1: Verificar el hallazgo (§1.1)

- [x] T001 Medir sobre la BD viva antes de escribir. Resultado: el hallazgo de ZEUS es **real**;
      la cifra cambió por la limpieza G4 del mismo turno (retiró 3 documentos, dos de ellos el
      mismo `Decreto_2263` duplicado), así que de **3 de 6** queda **1 de 3**. Los dos casos de
      `Invalid XRef` se fueron con los duplicados; el `Timeout` sigue ahí.
- [x] T002 Localizar la causa: la extracción de la subida **no reintenta**, y el documento que
      falla **nunca se encola**, así que los 3 reintentos de la cola no se aplican jamás.
- [x] T003 Segundo hallazgo, no previsto: **`needs_review` no informa**. Los tres documentos
      vivos están en ese estado, incluido uno con **68 fragmentos**, perfectamente buscable.

---

## Phase 2: Reintento (US1)

- [x] T004 `src/lib/reintento.ts`: `conReintento` con límite, aviso por fallo y relanzado del
      **último** error. → FR-001
- [x] T005 `src/lib/reintento.test.ts` (7 casos): recupera al segundo intento (SC-003), deja de
      insistir al agotarlos (SC-004), no espera tras el último fallo, avisa de cada uno (FR-005).
- [x] T006 Aplicarlo en `POST /api/documents` con 3 intentos y 500 ms, y **auditar** los
      reintentos en la metadata del registro de subida. → FR-001, FR-005

---

## Phase 3: Indexabilidad (US2, US3)

- [x] T007 `src/lib/indexabilidad.ts`: `evaluarIndexabilidad` → buscable / en proceso / motivo
      en lenguaje llano, derivado de los fragmentos. → FR-002
- [x] T008 `src/lib/indexabilidad.test.ts` (8 casos), con los **casos reales de la BD viva**:
      el de 68 fragmentos en `needs_review` sale buscable (SC-005); el del `Timeout` sale no
      buscable con motivo (SC-001); los de la cola salen "en proceso" (FR-004).
- [x] T009 `GET /api/documents` añade `indexabilidad` por documento vía `_count.chunks`,
      calculado al leer. → FR-002
- [x] T010 Tests de la ruta sobre los tres casos. → SC-001, SC-005, FR-004
- [x] T011 El listado marca **"No buscable"** (o **"Indexando"**) con el motivo debajo. → FR-003

---

## Phase 4: Gates

- [x] T012 Suite **523/63** (línea base 506), `tsc` limpio, `eslint src` en **0**.
- [x] T013 Sin migración, sin dependencias nuevas, sin tocar el pipeline RAG.

---

## Resultado (2026-07-24, turno D-068)

| Gate | Resultado |
|---|---|
| Suite | **523/63** (base 506) |
| `tsc` / `eslint src` | limpio / **0** |
| Migración / dependencias | **ninguna** / **ninguna** |
| Documento invisible de la BD viva | queda marcado **"No buscable"** con su motivo |

### Cierre de ACTA-013 (turno 015, radicado 001-IDC-015)

- **B0.1 — enmienda SC-006 APLICADA (D-071).** ZEUS firmó la reformulación. Vive ya en
  `specs/003-pipeline-rag/spec.md` (SC-006) y en `src/lib/indexabilidad.test.ts` como criterio
  medible: *"ningún documento buscable tiene cero fragmentos; los no buscables están marcados y
  se cuentan aparte"*.
- **B0.2 — reproceso del documento vivo con `Timeout`.** `scripts/reprocesar-documento.mjs`
  vuelve a leer el PDF con reintento y, si extrae, lo encola; si no, lo deja marcado. Ejecutado
  sobre `SuperTransporte Circular 164`: **genuinamente no legible** (3 intentos, `Timeout` en
  todos; es un PDF malformado que `pdf2json` no parsea). Queda `needs_review`, 0 chunks, con
  audit `reproceso_ingesta` que documenta el intento, y **la indexabilidad derivada lo muestra
  "No buscable" con motivo** — que es el resultado honesto que B0.2 admitía.

### SC-002 · Enmienda **propuesta** a SPEC-003 (histórico — ya aplicada, ver arriba)

SC-006 de la SPEC-003 decía *"documentos con texto y cero fragmentos = 0"* y no se cumplía en la
BD viva. Se propuso reformularlo:

> *"Todo documento **indexable** tiene al menos un fragmento. Los no indexables están
> **marcados** como tal y se contabilizan aparte."*

Se deja **propuesto**, no aplicado: enmendar el criterio de otra spec no es cosa de ODIN.

### No se hizo, y no es olvido

- **Reprocesar los documentos ya rotos**: quedan marcados, que es lo urgente. Reprocesar en
  lote es otro frente (y para el escaneo, SPEC-010 con turno).
- **El `Timeout` del documento vivo no se ha reintentado**: el reintento actúa **en la subida**,
  y ese documento ya está subido. Volver a intentarlo exige la acción de reproceso, que está
  fuera de alcance. Hoy, al menos, **se ve** que no es buscable.
