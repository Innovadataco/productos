# Feature Specification: Ingesta resiliente y documentos no indexables

**Feature Branch**: `013-ingesta-resiliente` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Aprobada con gate provisional de ZEUS (2026-07-24)** — hallazgo suyo, alcance
suyo. Ratificación del CEO pendiente.

**Input**: Hallazgo de ZEUS sobre la BD viva: documentos de Base Oficial con **0 chunks**, que
aparecen en el listado como cualquier otro pero son **invisibles para la búsqueda**. No son
casos de OCR: los errores son `Timeout extrayendo texto del PDF` e
`Invalid XRef stream header`. **SPEC-010 no los arregla.**

## Contexto: un documento que está y no está

Base Oficial existe para que una búsqueda encuentre la norma aplicable. Un documento con 0
chunks **no se puede encontrar nunca**, pero en el listado se ve igual que los demás. El
usuario cree que lo tiene. No lo tiene.

Es el mismo principio de D-025 —el sistema **sabe** qué documentos no puede leer y debe
decirlo— aplicado ahora al fallo de *parseo*, no al escaneo.

### Estado verificado sobre la BD viva (2026-07-24, tras la limpieza G4)

| Documento | Estado | Chunks | Texto | Error |
|---|---|---:|---:|---|
| RESOLUCIÓN 1234 de 2026 | `needs_review` | 1 | 292 | Sin modelo IA activo |
| **SuperTransporte Circular 164** | `needs_review` | **0** | **0** | **Timeout extrayendo texto del PDF** |
| ley 2199 de 2022 | `needs_review` | 68 | 88 162 | Sin modelo IA activo |

> **Precisión sobre el hallazgo.** ZEUS midió **3 de 6** documentos con 0 chunks. Al verificarlo
> tras la limpieza G4 del mismo turno —que retiró tres documentos, dos de ellos el mismo
> `Decreto_2263_de_1995` **duplicado**— queda **1 de 3**. Los dos casos de
> `Invalid XRef stream header` se fueron con esos duplicados. **El hallazgo es real y los dos
> modos de fallo también**: el que queda (`Timeout`) es justo el que esta spec puede reintentar,
> y el de XRef volverá en cuanto alguien suba otro PDF con la tabla de referencias rota.

### Las dos causas, que son distintas

1. **La extracción de la subida no reintenta.** `POST /api/documents` extrae el texto **en la
   petición**. Si falla, el documento queda `needs_review` y **nunca se encola**: los reintentos
   que la cola sí tiene (3, con espera creciente) no llegan a aplicarse jamás. Un `Timeout`
   pasajero condena el documento **para siempre**.
2. **`needs_review` no significa nada útil.** Hoy agrupa tres situaciones muy distintas: no se
   pudo leer el PDF, se leyó pero no había modelo de IA para enriquecerlo, y falló la
   vectorización. Los tres documentos de la tabla están en `needs_review` — **incluido uno con
   68 chunks, perfectamente buscable**. Un estado que vale para todo no informa de nada.

La pregunta que el usuario necesita responder no es "¿en qué estado técnico está?", sino
**"¿puedo encontrarlo si lo busco?"**. Y eso sí tiene respuesta exacta: **¿tiene chunks?**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un fallo pasajero no condena un documento (Priority: P1)

Como analista, quiero que la extracción de texto se reintente antes de darse por vencida, para
que un tropiezo momentáneo no deje una norma fuera del corpus para siempre.

**Why this priority**: es la causa por la que hay un documento invisible hoy mismo.

**Independent Test**: subir un PDF cuya extracción falle la primera vez y acierte a la segunda,
y comprobar que el documento entra normal.

**Acceptance Scenarios**:

1. **Given** una extracción que falla de forma pasajera, **When** se sube el documento,
   **Then** se **reintenta** hasta un límite antes de rendirse.
2. **Given** un reintento que tiene éxito, **When** ocurre, **Then** el documento sigue el
   camino normal: se encola y se indexa.
3. **Given** un PDF genuinamente ilegible, **When** se agotan los reintentos, **Then** se deja
   de insistir: reintentar sin límite convierte un error en una espera eterna.
4. **Given** los reintentos, **When** ocurren, **Then** quedan en **auditoría**: cuántos hubo y
   con qué se falló.

---

### User Story 2 - El sistema dice qué no se puede buscar (Priority: P1)

Como analista, quiero que un documento no indexable esté **marcado como tal**, para no creer
que lo tengo cuando no lo tengo.

**Why this priority**: es el daño real. Un hueco que no se ve es peor que un hueco visible: el
usuario busca, no encuentra y concluye que el sistema no tiene la norma.

**Independent Test**: mirar un documento con 0 chunks y ver, sin abrirlo, que no es buscable.

**Acceptance Scenarios**:

1. **Given** un documento sin fragmentos indexados, **When** se consulta, **Then** consta que
   **no es buscable**, y no como un detalle técnico escondido.
2. **Given** un documento no indexable, **When** se consulta, **Then** consta **por qué**: no se
   pudo leer el PDF, o se leyó pero no llegó a indexarse.
3. **Given** un documento con fragmentos, **When** se consulta, **Then** consta que **sí** es
   buscable, aunque su estado técnico sea `needs_review` por otra razón.
4. **Given** la distinción, **When** se calcula, **Then** sale del **hecho** de tener o no
   fragmentos, no de un campo que alguien deba acordarse de actualizar.

---

### User Story 3 - El listado los distingue (Priority: P1)

Como analista, quiero distinguir en el listado lo buscable de lo que no lo es, sin abrir cada
documento.

**Acceptance Scenarios**:

1. **Given** el listado del repositorio, **When** se muestra, **Then** un documento no
   indexable se **distingue a simple vista**.
2. **Given** un documento no indexable, **When** se mira, **Then** el motivo está a mano, en
   lenguaje llano.
3. **Given** un documento buscable en `needs_review` por falta de modelo IA, **When** se
   muestra, **Then** **no** se le señala como no buscable: no lo es.

### Edge Cases

- ¿Y un documento recién subido, aún en cola? → No es "no indexable": es "todavía no". No debe
  marcarse como roto mientras el pipeline trabaja.
- ¿Y si el reintento tarda y la subida se hace lenta? → El límite y la espera entre intentos
  deben ser cortos: es una petición de usuario, no un proceso de fondo.
- ¿Y si el PDF es un escaneo sin capa de texto? → Ése es **SPEC-010** (OCR). Aquí solo se marca
  como no indexable con su motivo; darle capa de texto es otro frente y exige turno.
- ¿Y los documentos que ya están rotos en la BD? → Quedan marcados por el mismo cálculo, sin
  migración ni backfill: la indexabilidad se **deriva**, no se guarda.

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1**: **no es SPEC-010.** Aquí no se hace OCR, no se instalan dependencias de sistema y no
  hay trabajo pesado.
- **RZ-2**: **sin migración.** La indexabilidad se deriva de un hecho ya almacenado (los
  fragmentos); un campo nuevo se desincronizaría en cuanto alguien olvidara actualizarlo.
- **RZ-3**: no se cambia el pipeline RAG ni el troceado: solo la resiliencia de la extracción y
  cómo se **informa** del resultado.
- **RZ-4**: toda ruta tocada conserva `verifyAuth`, `apiError` y sus códigos; cero `any`.

### Functional Requirements

- **FR-001**: la extracción de texto en la subida MUST **reintentar** con un **límite**, y MUST
  dejar de insistir al agotarlo.
- **FR-002**: el sistema MUST exponer, por documento, si es **indexable** y, si no lo es, **por
  qué**, derivándolo de si tiene fragmentos; MUST NOT depender de un campo que haya que
  mantener a mano.
- **FR-003**: el listado MUST distinguir a simple vista lo indexable de lo que no lo es, con el
  motivo en lenguaje llano.
- **FR-004**: un documento **en proceso** MUST NOT presentarse como no indexable.
- **FR-005**: los reintentos MUST quedar en auditoría (cuántos y con qué error).
- **FR-006**: `needs_review` MUST dejar de ser la única señal: un documento con fragmentos MUST
  poder verse como buscable aunque su estado sea `needs_review`.
- **FR-007**: ningún cambio MUST tocar el pipeline RAG, Base Oficial como dato, ni otros
  productos.

## Success Criteria *(mandatory)*

- **SC-001**: un PDF corrupto **no** queda como `needs_review` silencioso: consta como **no
  buscable**, con motivo, en la API y en el listado.
- **SC-002**: **enmienda propuesta a SC-006 de la SPEC-003.** Aquel criterio decía "documentos
  sin chunks = 0" y **hoy no se cumple en la BD viva**. Se propone reformularlo: *"todo
  documento **indexable** tiene al menos un fragmento; los no indexables están **marcados** y
  contabilizados aparte"*. Queda **propuesto**; la enmienda la firma ZEUS.
- **SC-003**: una extracción que falla una vez y acierta a la siguiente termina indexada.
- **SC-004**: los reintentos se agotan y no se insiste indefinidamente.
- **SC-005**: un documento con fragmentos consta como buscable aunque esté en `needs_review`.
- **SC-006**: la suite pasa sin BD ni red y **no baja** de la línea base (506).
- **SC-007**: `tsc` limpio, `eslint src` en 0, sin dependencias nuevas y **sin migración**.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/013-ingesta-resiliente/` con spec, plan, tasks y checklist |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-003, SC-004, SC-005 con test; SC-006 |
| 4 | Despliegue accesible y probable | El CEO abre el repositorio **en el contenedor** y ve marcado el documento que hoy es invisible |
| 5 | Revisión de arquitectura de ZEUS | SC-002 (la enmienda) y RZ-2 (que no haya migración) |

## Assumptions

- El documento que hoy falla (`Timeout`) puede o no recuperarse al reintentar: el `Timeout`
  sugiere que sí; el `Invalid XRef` de los duplicados retirados, que no. Esta spec **no promete
  recuperarlos**, promete **reintentar** y **marcar** lo que no se pueda.
- Reprocesar a mano los documentos ya rotos queda fuera: se marcan, que es lo urgente.
- El corpus es pequeño (3 documentos), así que derivar la indexabilidad al leer no es un
  problema de rendimiento. Si creciera, se revisa.

## Out of Scope

- **OCR** (SPEC-010): darle capa de texto a un escaneo. Aquí solo se marca.
- Reprocesar en lote los documentos ya rotos.
- Cambiar el troceado, los embeddings o la búsqueda.
- Reescribir la máquina de estados del documento: se **añade** una señal derivada, no se
  sustituye `status`.
