# Feature Specification: Documentos legales públicos limpios

**Feature Branch**: `work/pi-SPEC-343-documentos-legales-publicos`

**Created**: 2026-09-01

**Status**: IMPLEMENTADO

**Impacto en arquitectura:** ninguno estructural — sin cambios de schema, proxy,
navegación ni endpoints. Se añaden dos dependencias de render UI (react-markdown,
remark-gfm) y el plugin @tailwindcss/typography (revive clases `prose` existentes);
documentos legales públicos se sirven desde `public/legal/` y los borradores pasan
a `docs/legal/` (no servidos).

**Input**: User description: "PI · SPEC-343 — Documentos legales públicos limpios (I-232). Los documentos legales que ven padres y colegios en el modal de consentimiento son borradores internos con notas de trabajo visibles. Crear versiones públicas limpias, renderizar markdown real y seguro en el modal, apuntar los parámetros a los archivos nuevos sin re-pedir firma, y candar con tests que lo servido nunca contenga notas internas."

## Contexto (I-232)

Hoy el modal de consentimiento muestra a padres y colegios los archivos
`public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` y
`public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` **tal cual**, con:

- Notas internas de borrador: bloques "✅ CERRADO internamente", "⚠️ BORRADOR para revisión
  de un abogado", tablas de estado de decisiones y bloques de control del documento.
- 11 campos `[ABOGADO: …]` en el convenio y 3 bloques + 1 inline en la política.
- Markdown **crudo**: el padre ve `#`, `**`, `>` y tablas con pipes ilegibles, porque el modal
  parte el texto por líneas y lo pinta como párrafos planos.
- Además, al vivir en `public/`, los borradores internos completos son descargables por
  cualquiera vía URL directa (`/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md`).

Decisiones ya tomadas (Jelkin vía CEO, radicado I-232 y mensaje CEO 01-09-2026 01:00):

- **OPCIÓN A**: documentos públicos limpios, SIN línea de "en revisión jurídica".
- **Cláusula Responsabilidad del convenio**: se elimina del documento público (era 100 %
  un bloque `[ABOGADO]`) y se renumeran las cláusulas siguientes (14→13, 15→14).
  **Nota de ronda jurídica**: la cláusula de Responsabilidad queda pendiente de la ronda
  con el abogado; cuando exista redacción jurídica se restituye al convenio público con su
  numeración. Esta nota vive AQUÍ (en la spec), nunca en el documento servido.
- **Campos inline con valor sugerido**: se adoptan los valores sugeridos — notificación de
  incidentes **72 horas**, supresión post-terminación **30 días calendario**,
  confidencialidad **2 años** — coherentes con lo que la Política pública ya publica.
- **Originales**: NO se borran; se mueven a `docs/legal/` (dejan de ser servidos por la web).
- **`consentimiento.version_actual` NO cambia**: la sustancia legal no cambia, no se
  re-pide firma a quienes ya aceptaron. El UPDATE de los parámetros en BD de producción lo
  ejecuta el CEO pegado al deploy (ventana de segundos asumida por él); el PR debe dejar
  explícito ruta vieja → ruta nueva de los DOS parámetros.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El padre ve un documento legal limpio y legible (Priority: P1)

Un padre o tutor llega al modal de consentimiento (registro o camino guiado) y lee la
Política de Tratamiento de Datos. Ve un documento terminado: títulos, negritas, citas y
tablas formateadas; ninguna nota interna, ningún campo `[ABOGADO: …]`, ninguna marca de
borrador. La fecha de vigencia y la URL de la política son reales, no placeholders.

**Why this priority**: es el objetivo del radicado — la cara legal del producto ante el
usuario final. Un documento con notas de borrador destruye la confianza en una plataforma
de protección infantil.

**Independent Test**: abrir el modal como PARENT y verificar contenido y formato del
documento mostrado; grep de marcadores internos sobre el archivo servido.

**Acceptance Scenarios**:

1. **Given** un usuario PARENT sin consentimiento vigente, **When** abre el modal de
   consentimiento, **Then** el documento mostrado no contiene "[ABOGADO", "CERRADO
   internamente" ni "BORRADOR", ni tablas de estado/control internas.
2. **Given** el mismo modal, **When** el documento llega a la sección de vigencia,
   **Then** muestra la fecha real de publicación (1 de septiembre de 2026) y la URL real
   (https://pi.innovadataco.com/politica-datos) — sin `[FECHA…]` ni `[URL…]`.
3. **Given** el documento público de la política, **When** se compara con el borrador
   v0.4, **Then** conserva íntegras las secciones sustantivas 1–14 y el Aviso de
   Privacidad, con los tres ajustes de redacción aprobados (encabezado del régimen de
   autorización, título de retención sin "propuesta", columna "Período de retención").

---

### User Story 2 - El colegio ve un convenio limpio y coherente (Priority: P1)

Un administrador de colegio (SCHOOL_ADMIN o COMITE_CONVIVENCIA) abre el modal y lee el
Convenio de Transmisión y Tratamiento de Datos: 14 cláusulas continuas, sin campos de
abogado, con plazos concretos (72 horas / 30 días calendario / 2 años) donde el borrador
tenía campos por definir. Los espacios de identificación del colegio (`[NOMBRE DEL
COLEGIO]`, NIT, domicilio) permanecen, porque son parte de la plantilla del convenio.

**Why this priority**: mismo peso que US1 — es la otra mitad de la audiencia del modal.

**Independent Test**: abrir el modal como SCHOOL_ADMIN y verificar contenido; grep de
marcadores internos; verificar numeración continua 1–14.

**Acceptance Scenarios**:

1. **Given** un usuario SCHOOL_ADMIN sin consentimiento vigente, **When** abre el modal,
   **Then** el convenio mostrado no contiene "[ABOGADO", "CERRADO internamente" ni
   "BORRADOR", y sus cláusulas están numeradas 1–14 sin saltos.
2. **Given** el convenio público, **When** se leen las cláusulas de incidentes,
   terminación y confidencialidad, **Then** los plazos son "72 horas", "30 días
   calendario" y "2 años" respectivamente, sin corchetes ni sugerencias.
3. **Given** el convenio público, **When** se busca la cláusula de Responsabilidad del
   borrador, **Then** no existe y las cláusulas de ley aplicable y firmas quedaron
   renumeradas (14→13, 15→14).

---

### User Story 3 - El documento se lee como documento, también en móvil (Priority: P2)

Cualquier usuario del modal (padre o colegio) ve el markdown renderizado de verdad:
encabezados jerárquicos, negritas, citas, listas y tablas con celdas. En un teléfono
(≈375 px) las tablas anchas se desplazan horizontalmente dentro de su propio contenedor
sin romper el layout del modal. Si el documento contuviera HTML embebido, se muestra como
texto, nunca se ejecuta.

**Why this priority**: sin esto, incluso un documento limpio sigue siendo ilegible
(pipes y almohadillas). Va después de la limpieza porque el contenido correcto es
prerrequisito.

**Independent Test**: render del modal con un fixture markdown (títulos, tabla, HTML
malicioso) y aserciones sobre el DOM resultante.

**Acceptance Scenarios**:

1. **Given** el modal con un documento que contiene `## Título`, `**negrita**` y una
   tabla, **When** se renderiza, **Then** el usuario ve un encabezado, texto en negrita y
   una tabla real — no los símbolos `#`, `**` ni `|`.
2. **Given** un documento que contiene `<script>alert(1)</script>` o cualquier HTML,
   **When** se renderiza, **Then** el HTML aparece escapado como texto y no se ejecuta.
3. **Given** una pantalla de 375 px, **When** el documento incluye una tabla ancha,
   **Then** la tabla se desplaza dentro de su propio contenedor y el modal no genera
   scroll horizontal de página.
4. **Given** el requisito de scroll-hasta-el-final del modal (SPEC-241), **When** el
   documento se renderiza con el nuevo formato, **Then** el botón "Acepto" sigue
   habilitándose solo tras llegar al final del documento.

---

### User Story 4 - Los borradores internos dejan de estar en la web (Priority: P2)

Los borradores internos (con notas de trabajo y campos de abogado) ya no son accesibles
por URL pública: viven en la carpeta interna del repositorio (`docs/legal/`), donde el
equipo los sigue usando para la futura ronda jurídica.

**Why this priority**: cierra la fuga por URL directa; va tras las US1/US2 porque
depende de que existan los públicos nuevos.

**Independent Test**: verificar que `public/legal/` solo contiene los documentos
públicos limpios y que los originales existen en `docs/legal/`.

**Acceptance Scenarios**:

1. **Given** el árbol del repositorio tras el cambio, **When** se lista `public/legal/`,
   **Then** solo contiene los dos documentos públicos limpios.
2. **Given** los borradores v0.4 y el convenio original, **When** se buscan en el
   repositorio, **Then** existen íntegros bajo `docs/legal/` (sin modificar).

---

### User Story 5 - Nadie re-firma y el sistema sigue apuntando bien (Priority: P3)

Un usuario que ya aceptó el consentimiento vigente no vuelve a ver el modal. Los nuevos
usuarios aceptan sobre los documentos públicos limpios y su registro de aceptación
(hash del documento) refleja el documento que realmente leyeron.

**Why this priority**: protege la coreografía de despliegue y la trazabilidad; es
consecuencia de las decisiones ya tomadas (versión intacta).

**Independent Test**: test del servicio con las rutas nuevas sembradas; verificación de
que la versión vigente no cambió.

**Acceptance Scenarios**:

1. **Given** un usuario que ya aceptó la versión vigente, **When** vuelve a navegar,
   **Then** el sistema no le exige nueva aceptación (la versión vigente no cambió).
2. **Given** los parámetros sembrados, **When** el servicio de consentimiento carga el
   documento por rol, **Then** lee los archivos públicos nuevos y calcula el hash sobre
   su contenido.

---

### Edge Cases

- ¿Qué pasa si la ruta parametrizada apunta a un archivo inexistente (BD de producción
  aún sin actualizar tras el deploy)? → el servicio ya responde error controlado 500
  "Documento legal no disponible"; la ventana de segundos la asume el CEO ejecutando el
  UPDATE pegado al deploy. El PR documenta ruta vieja → ruta nueva de los DOS parámetros.
- ¿Qué pasa con un documento con líneas de tabla malformadas o markdown parcial? → se
  renderiza en modo degradado (texto), nunca rompe el modal.
- ¿Qué pasa si el documento contiene HTML embebido (accidental o malicioso)? → se muestra
  escapado como texto; nunca se interpreta.
- ¿Los enlaces markdown dentro del documento? → se muestran como texto enlazado; ninguno
  de los dos documentos públicos depende de enlaces relativos a archivos internos (las
  referencias internas se van con los bloques eliminados).
- ¿Aceptaciones históricas con hash del documento viejo? → permanecen válidas e
  inmutables en la auditoría; el hash registra lo que cada usuario leyó en su momento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE servir una versión pública limpia de la Política de
  Tratamiento de Datos (`public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md`) que
  conserve el contenido sustantivo del borrador v0.4 (secciones 1–14 + Aviso de
  Privacidad) y elimine: el encabezado interno (bloques de cierre interno y borrador,
  tabla de proyecto/estado, tabla "Estado de las decisiones del CEO" — líneas 2–35 del
  v0.4), los bloques `[ABOGADO]` (L92–95, L120–122, L148–149), la línea de confirmación
  de plazos (L114) y el bloque de control del documento (L165–175).
- **FR-002**: La política pública DEBE aplicar exactamente tres ajustes de redacción:
  encabezado "**Régimen de autorización:**" (antes "Propuesta de régimen… para
  validación del abogado"), título "## 13. Retención y supresión" (sin "— propuesta para
  validación") y columna "Período de retención" en la tabla de §13.
- **FR-003**: La política pública DEBE declarar la fecha real de publicación
  (1 de septiembre de 2026) en §14 Vigencia y la URL real
  `https://pi.innovadataco.com/politica-datos` en el Aviso de Privacidad.
- **FR-004**: El sistema DEBE servir una versión pública limpia del Convenio de Colegios
  (`public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md`) con la misma
  cirugía: sin encabezado interno (L2–26), sin bloques `[ABOGADO]` (L36–40, L137–140,
  L168–170, L197–199), sin bloque de control (L214–225), y con los campos inline
  resueltos a sus valores aprobados: **72 horas** (notificación de incidentes, cláusula
  5.5), **30 días calendario** (supresión post-terminación, cláusula 10) y **2 años**
  (confidencialidad, cláusula 12).
- **FR-005**: El convenio público DEBE omitir la cláusula de Responsabilidad del borrador
  (íntegramente un bloque `[ABOGADO]`) y renumerar las cláusulas siguientes: Ley
  aplicable 14→13 y Firmas 15→14. Los campos de plantilla del colegio
  (`[NOMBRE DEL COLEGIO]`, NIT, domicilio) se conservan.
- **FR-006**: Los borradores originales DEBEN moverse íntegros y sin modificar de
  `public/legal/` a `docs/legal/`; `public/legal/` DEBE quedar solo con los dos
  documentos públicos limpios.
- **FR-007**: Los parámetros de sistema sembrados `consentimiento.padre.documento_ruta`
  y `consentimiento.colegio.documento_ruta` DEBEN apuntar a los dos archivos públicos
  nuevos. `consentimiento.version_actual` NO DEBE cambiar. (El UPDATE en BD de
  producción lo ejecuta el CEO pegado al deploy; fuera del alcance del código.)
- **FR-008**: El modal de consentimiento DEBE renderizar el documento como markdown real
  — encabezados, negritas, citas, listas y tablas — en lugar de texto plano por líneas.
- **FR-009**: El render del modal DEBE ser seguro: cualquier HTML presente en el
  documento se muestra escapado como texto y nunca se interpreta ni ejecuta.
- **FR-010**: Las tablas del documento DEBEN ser legibles en móvil (≈375 px): se
  desplazan dentro de su propio contenedor sin producir scroll horizontal de página ni
  romper el mecanismo de scroll-hasta-el-final del modal.
- **FR-011**: Una prueba automática (test-candado) DEBE fallar si alguno de los
  documentos SERVIDOS (los apuntados por los parámetros sembrados) contiene "[ABOGADO",
  "CERRADO internamente" o "BORRADOR".
- **FR-012**: Las pruebas DEBEN cubrir además: el render del modal (formato + escape de
  HTML + tablas) y el servicio de consentimiento leyendo las rutas nuevas (incluido el
  cálculo de hash sobre el contenido nuevo).

### Key Entities

- **Documento legal público**: archivo markdown limpio servido a padres (política) o
  colegios (convenio); es lo único que un usuario final puede ver o descargar.
- **Borrador interno**: los originales con notas de trabajo y campos de abogado; viven
  en la carpeta interna del repo y alimentan la futura ronda jurídica. No se sirven.
- **Parámetro de sistema (rutas de consentimiento)**: par de claves que indican qué
  archivo se muestra a cada audiencia; sembradas en código, actualizadas en producción
  por el CEO junto al deploy.
- **Registro de aceptación**: fila inmutable de auditoría con versión y hash del
  documento aceptado; las históricas no se tocan, las nuevas reflejan el documento nuevo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 ocurrencias de "[ABOGADO", "CERRADO internamente" o "BORRADOR" en los
  documentos servidos, verificado por una prueba automática que corre en CI.
- **SC-002**: Un padre o colegio que abre el modal ve el documento con formato de
  documento (títulos, negritas, tablas); ninguna línea muestra símbolos crudos de
  markdown (`#`, `**`, `|`, `>`).
- **SC-003**: En una pantalla de 375 px, el documento completo se puede leer y las
  tablas se desplazan dentro de su contenedor; el botón "Acepto" sigue habilitándose
  solo al llegar al final.
- **SC-004**: Ningún usuario con consentimiento vigente vuelve a ver el modal tras el
  despliegue (la versión vigente no cambia).
- **SC-005**: Los borradores internos dejan de existir bajo la carpeta pública del sitio;
  siguen íntegros en la carpeta interna del repositorio.
- **SC-006**: El convenio público mantiene numeración continua de cláusulas (1–14) y
  plazos concretos en incidentes/terminación/confidencialidad.

## Implementación (2026-09-01 · Dev PI-2)

Entregado en la rama `work/pi-SPEC-343-documentos-legales-publicos` (commits: setup,
US1–US5, línea base, docs). Resultado contra los FR: documentos públicos v1.0 en
`public/legal/` (FR-001…FR-005), borradores movidos a `docs/legal/` con rename puro
(FR-006), seed apuntando a los públicos con versión intacta (FR-007), render
markdown seguro con react-markdown + remark-gfm y tablas con scroll propio
(FR-008…FR-010), test-candado `src/lib/legal/documentos-servidos.test.ts` (FR-011)
y suite de render/servicio actualizada (FR-012). Gate completo y recorrido real
documentados en [cierre.md](cierre.md). Hallazgo corregido de paso: las clases
`prose` del modal estaban muertas (plugin typography ausente en tailwind.config).
Pendiente externo: UPDATE de los 2 parámetros en BD prod (CEO, pegado al deploy) y
la cláusula de Responsabilidad del convenio cuando exista redacción jurídica.

## Assumptions

- La fecha de publicación de la política pública es la fecha del despliegue de esta spec
  (1 de septiembre de 2026), aprobada por el CEO.
- Nombres de archivo aprobados: `POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` (radicado) y
  `CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md` (hermano, mismo criterio).
- Destino de los internos: `docs/legal/` (aprobado por CEO 01-09-2026 01:00).
- La cláusula de Responsabilidad del convenio queda pendiente de la ronda jurídica y se
  restituirá al convenio público cuando el abogado la redacte (nota de spec, no de
  documento).
- El render markdown se resuelve con una biblioteca establecida que escapa HTML por
  defecto (react-markdown + remark-gfm, aprobada por CEO); no se habilita HTML crudo.
- El mecanismo de scroll-final del modal (SPEC-241) y el flujo de aceptación
  (`/api/consentimiento/aceptar`) no cambian de contrato; solo cambia el render del
  contenido.
- Los `.docx` mencionados por los borradores no existen en `public/legal/` (verificado:
  la carpeta solo contiene los dos `.md`); no hay más archivos que mover.
