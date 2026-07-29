# Feature Specification: SPEC-126 — Línea base de arquitectura generada desde el código

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: PLANEADO

**Input**: Instructivo 002-PI-042 (radica ZEUS). Los fallos aparecen ENTRE features y la
documentación escrita a mano miente (`docs/ARCHITECTURE.md` citaba un permiso ya borrado).
Cero prosa a mano: lo que se genera del código, se genera.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Documentación de arquitectura que no puede mentir (Priority: P1)

Como responsable técnico del producto (ZEUS/CEO/ODIN), quiero que la documentación de
arquitectura se GENERE leyendo el código (schema de datos, proxy, navegación, catálogo de
módulos, stack) en artefactos versionados en `docs/architecture/`, de modo que cualquier
cambio en el código se refleje al regenerar, sin intervención manual.

**Why this priority**: La doc a mano ya mintió una vez (citaba un permiso borrado) y los
fallos del piloto aparecieron ENTRE features, no dentro de ellas. Sin una línea base viva,
cada spec nueva trabaja sobre un mapa viejo del territorio.

**Independent Test**: Ejecutar el comando de generación produce los 5 artefactos en
`docs/architecture/` solo leyendo el código (determinista, sin IA), y ejecutarlo dos veces
seguidas produce salida idéntica.

**Acceptance Scenarios**:

1. **Given** el repo en estado limpio, **When** se ejecutan los generadores, **Then** existen
   `00-INDICE.md`, `01-modelo-datos.md`, `02-roles-capacidades.md`, `03-pantallas.md` y
   `06-stack.md` en `docs/architecture/`, generados íntegramente desde las fuentes de código.
2. **Given** los artefactos commiteados, **When** se regeneran sin cambios en el código,
   **Then** el contenido es idéntico byte a byte (salvo marcas de fecha si las hubiera, que
   deben excluirse del diff para que el gate sea estable).
3. **Given** el modelo de datos actual, **When** se genera `01-modelo-datos.md`, **Then**
   el total de modelos coincide con el oráculo (47) y la sección de huérfanos coincide con
   la lista de excepciones documentada (Plan, Subscription, BillingCycle).

---

### User Story 2 — Compuerta CI que mantiene la línea base viva (Priority: P1)

Como responsable de calidad, quiero que el pipeline falle cuando la documentación generada
difiere de lo commiteado, cuando aparece un modelo huérfano no declarado, o cuando la puerta
de acceso (proxy) y el menú se contradicen, de modo que el drift se detecte en el PR que lo
introduce y no en una sesión de validación manual.

**Why this priority**: Una línea base sin compuerta vuelve a mentir en semanas. Las dos
aserciones de permisos (puerta ≡ predicado, menú que no miente) son exactamente la clase de
fallo que el CEO encontró a mano dos veces (I-35, I-36/I-38).

**Independent Test**: Alterar artificialmente un modelo del schema pone el gate en ROJO
(detecta drift); revertirlo lo deja en VERDE. Las aserciones A y B corren sobre el inventario
real y reportan veredicto o lista de desalineos.

**Acceptance Scenarios**:

1. **Given** artefactos commiteados y código intacto, **When** corre el gate en CI, **Then**
   regenera los 5 y pasa (idénticos en árbol limpio).
2. **Given** un modelo nuevo sin relaciones, **When** corre el gate, **Then** falla salvo que
   el modelo esté en la lista de excepciones declarada.
3. **Given** el inventario (rol × ruta) real, **When** corre la aserción A, **Then**
   `proxyCore` y `esDestinoPermitidoPorRol` dan el MISMO veredicto en cada combinación, o el
   gate lista los desalineos y falla.
4. **Given** los href que el header/menú pinta por rol, **When** corre la aserción B, **Then**
   todo href es alcanzable para ese rol según el proxy, o el gate lista los muertos y falla.

---

### User Story 3 — Disciplina de impacto arquitectónico en specs (Priority: P2)

Como revisor de specs, quiero que toda spec nueva declare su impacto en arquitectura y que
la guía del repo obligue a leer `docs/architecture/` antes de tocar `src/`, de modo que la
línea base se use de verdad y se actualice con conocimiento.

**Why this priority**: La línea base solo se mantiene viva si el flujo de trabajo la consulta
y la alimenta. Es barato y evita que vuelva a ser un artefacto decorativo.

**Independent Test**: El gate de disciplina de specs exige la línea "Impacto en arquitectura:"
en cada `spec.md` nuevo, y `AGENTS.md` contiene la regla de lectura.

**Acceptance Scenarios**:

1. **Given** una spec nueva sin la línea de impacto, **When** corre el gate de disciplina,
   **Then** falla indicando la spec infractora.
2. **Given** `AGENTS.md`, **When** se lee la sección de arquitectura, **Then** existe la regla
   "antes de tocar `src/`, leer `docs/architecture/`".

---

### Edge Cases

- El gate NO debe ser inestable por marcas de tiempo o rutas absolutas de la máquina: la
  salida generada es determinista y portable (o el diff excluye explícitamente esas marcas).
- Si una aserción A/B sale ROJA en la primera corrida sobre el código actual, NO se silencia
  tocando las fuentes (`proxy.ts`, `nav-items.ts`, `NavHeader.tsx`, `permisos-catalogo.ts`
  se LEEN, no se tocan): es un fallo real escondido — se reporta a ZEUS y se para.
- El eje de módulos (`PermisoModulo`) y el eje de rutas (proxy) NO se reconcilian en esta
  spec: son ejes distintos y la decisión es de ZEUS; la línea base los documenta por separado.
- Los campos de score/riesgo de `IdentificadorReportado` están vivos en datos pero prohibidos
  de cara al usuario (I-29): se rotulan como tales, no se eliminan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE generar `00-INDICE.md` con el mapa de los demás artefactos.
- **FR-002**: El sistema DEBE generar `01-modelo-datos.md` leyendo `prisma/schema.prisma`:
  los 47 modelos agrupados por dominio, un diagrama ER en Mermaid derivado de las `@relation`,
  y una sección "huérfanos" (modelos sin relación entrante ni saliente). DEBE rotular
  `IdentificadorReportado.{score, scoreAnonimo, scoreAutenticado, scoreAjustado, nivelRiesgo}`
  como "vivo en datos, prohibido de cara al usuario" (I-29).
- **FR-003**: El sistema DEBE generar `02-roles-capacidades.md` leyendo `src/lib/proxy.ts`
  (listas de rutas), `src/lib/nav-items.ts`, `src/lib/permisos-catalogo.ts`,
  `src/components/modules/NavHeader.tsx` y el árbol `src/app/**`: matriz rol × ruta →
  veredicto (incluido rol anónimo) y tabla módulo → ruta → rol.
- **FR-004**: El sistema DEBE generar `03-pantallas.md` leyendo `src/app/**`, `proxy.ts` y
  `nav-items.ts`: pantallas por rol, grafo de transiciones y home-por-rol (`homeForRole`).
- **FR-005**: El sistema DEBE generar `06-stack.md` leyendo `package.json`, `Dockerfile` /
  `docker-compose` y la configuración de puertos.
- **FR-006**: Los generadores DEBEN ser scripts deterministas ejecutables localmente
  (sin llamadas a IA ni servicios externos) y su salida DEBE ser estable entre corridas.
- **FR-007**: El sistema DEBE proveer un comando de verificación (`npm run arch:check` o
  equivalente) cableado al workflow de CI de la raíz del monorepo, que en cada PR:
  (a) regenere los 5 artefactos y FALLE si difieren de lo commiteado;
  (b) FALLE si un modelo huérfano nuevo no está en la lista de excepciones declarada;
  (c) aserción A: para cada (rol, ruta) del inventario, `proxyCore` y
      `esDestinoPermitidoPorRol` dan el mismo veredicto, o ROJO con la lista de desalineos;
  (d) aserción B: todo href que el header/menú pinta para un rol es alcanzable para ese rol
      según el proxy, o ROJO con la lista de href muertos.
- **FR-008**: El gate de disciplina de specs DEBE exigir la línea "Impacto en arquitectura: …"
  en cada `spec.md` (con lista de excepciones para specs históricas, que solo encoge).
- **FR-009**: `AGENTS.md` DEBE incluir la regla "antes de tocar `src/`, leer
  `docs/architecture/`".
- **FR-010**: Las fuentes (`proxy.ts`, `nav-items.ts`, `NavHeader.tsx`,
  `permisos-catalogo.ts`) DEBEN permanecer intactas: esta spec las LEE, no las toca. Si una
  aserción sale roja sobre el código actual, se reporta y se para (no se reconcilia).

### Key Entities *(include if feature involves data)*

- **Artefacto generado**: documento markdown en `docs/architecture/` producido solo desde
  fuentes de código; atributos: fuente(s), fecha de generación (excluida del diff), contenido.
- **Inventario rol × ruta**: producto del enum `RolUsuario` + anónimo por el árbol `src/app/**`
  y las listas del proxy; base de las aserciones A y B.
- **Lista de excepciones de huérfanos**: conjunto declarado (hoy: Plan, Subscription,
  BillingCycle) que el gate respeta; solo cambia por decisión explícita.
- **Veredicto de acceso**: resultado (permitir / bloquear / redirigir) que producen
  `proxyCore` y `esDestinoPermitidoPorRol` para un (rol, ruta); la aserción A exige igualdad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `arch:check` en árbol limpio termina VERDE en local y en CI (5 artefactos
  idénticos a lo commiteado).
- **SC-002**: Alterar un modelo del schema (añadir/quitar uno) pone `arch:check` en ROJO en
  la siguiente corrida — drift detectado el 100% de las veces.
- **SC-003**: La aserción A corre sobre el inventario real completo (5 roles + anónimo ×
  rutas) y pasa, o lista el 100% de los desalineos con rol y ruta.
- **SC-004**: La aserción B corre sobre header/menú y pasa, o lista el 100% de los href
  muertos con rol y destino.
- **SC-005**: Toda spec creada después de esta feature incluye la línea de impacto en
  arquitectura (excepciones solo históricas), y `AGENTS.md` contiene la regla de lectura.

## Assumptions

- El workflow de CI vive en la raíz del monorepo (`productos/.github/workflows/`) y filtra
  por paths de este producto; la compuerta nueva se cablea ahí o en un job equivalente.
- La salida generada puede incluir fecha de generación siempre que el check la excluya del
  diff (o no la incluya); lo innegociable es la estabilidad del gate.
- El total-oráculo de modelos (47) y la lista de huérfanos actuales son el punto de partida;
  el gate no los congela: permite crecer actualizando artefacto + excepciones en el mismo PR.
- La documentación generada es en español, como el resto del repo.
- Los oráculos numéricos citados (47 modelos, 3 huérfanos) se verifican al implementar; si el
  conteo real difiere al escribir el generador, prevalece el conteo real documentado con su fecha.

## Impacto en arquitectura

CREA la línea base: `docs/architecture/` (5 artefactos generados), scripts generadores en
`scripts/arch/`, `npm run arch:check`, job en el workflow de CI de la raíz, línea de impacto
en `spec.md` futuras y regla de lectura en `AGENTS.md`. NO toca `src/` de producto salvo
`AGENTS.md` y, si hiciera falta, el test de disciplina de specs.
