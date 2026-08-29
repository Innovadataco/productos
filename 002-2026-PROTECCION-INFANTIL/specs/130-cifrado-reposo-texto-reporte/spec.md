# Feature Specification: SPEC-130 — Cifrado en reposo del texto del reporte (BL-4)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-053 (radica ZEUS). La constitución §6.3 exige el texto del
reporte CIFRADO EN REPOSO + anonimización/purga garantizada en todo camino terminal.
Es dato sensible de menores; bloquea la apertura a usuarios reales.
**Precisión de fuente (verificada):** `Reporte.textoOriginal` YA se cifra al crear
(`encryptParameter`, SPEC-110) — el hueco real es `Reporte.texto` (la copia de trabajo
que lee el pipeline), que queda EN CLARO para todos los reportes, y que la anonimización
solo ocurre cuando el detector marca PII: spam, duplicados y reportes sin PII conservan
texto en claro indefinidamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ningún texto de reporte queda en claro en la base de datos (Priority: P1)

Como responsable de protección de datos, quiero que el texto de TODO reporte se almacene
cifrado en reposo (AES-256-GCM, misma clave y patrón que `textoOriginal` y la evidencia
de apelaciones), de modo que un acceso a la base de datos no exponga narraciones sobre
menores.

**Why this priority**: Es la exigencia directa de la constitución §6.3 y el bloqueante
declarado para abrir. El texto del reporte es el dato más sensible del sistema.

**Independent Test**: en BD, los campos `texto`/`textoOriginal` de un reporte nuevo son
cifrado GCM (prefijo detectado por `isEncryptedValue`); el pipeline y las pantallas
autorizadas leen el texto plano transparentemente (descifrado en la capa de datos).

**Acceptance Scenarios**:

1. **Given** un reporte nuevo, **When** se persiste, **Then** `texto` y `textoOriginal`
   quedan cifrados con AES-256-GCM (misma clave actual; BL-2 la gestiona el CEO).
2. **Given** el pipeline de procesamiento (embedding, deduplicación, clasificación,
   guardas, anonimización), **When** lee el texto, **Then** recibe el plano por la capa
   de datos sin cambiar su lógica (la clasificación NO cambia).
3. **Given** una pantalla autorizada (expediente admin, revisión del operador,
   seguimiento del padre), **When** muestra el texto, **Then** lo obtiene descifrado por
   la capa de datos; ninguna respuesta pública expone el texto (se mantiene).
4. **Given** la BD con reportes históricos en claro, **When** corre la migración,
   **Then** todos quedan cifrados y el estado verificable (sin texto plano restante).

---

### User Story 2 — Anonimización/purga garantizada en todo camino terminal (Priority: P1)

Como responsable de protección de datos, quiero que TODO camino que cierra un reporte
garantice que el texto queda anonimizado o purgado según la política de cada estado, de
modo que no se conserve texto identificable donde ya no hace falta.

**Why this priority**: Hoy la anonimización solo ocurre con PII detectado; spam,
duplicados y reportes sin PII conservan texto identificable para siempre. La
constitución lo prohíbe ("no se conserva texto identificable").

**Independent Test**: para cada estado terminal (CLASIFICADO, CORREGIDO, REVISION_MANUAL,
POSIBLE_SPAM, DUPLICADO, REQUIERE_ANONIMIZACION) existe una regla ejecutada y testeada
que deja el texto anonimizado/purgado cuando el flujo cierra (ver tabla de política en
research.md); los caminos con lectura humana pendiente NO se anonimizan antes de tiempo.

**Acceptance Scenarios**:

1. **Given** un reporte que termina en DUPLICADO, **When** el pipeline lo cierra,
   **Then** su texto queda anonimizado/purgado (ya no hay uso posterior).
2. **Given** un reporte en REVISION_MANUAL o POSIBLE_SPAM, **When** el humano resuelve
   (confirmar, corregir, dar de baja), **Then** la resolución aplica la regla de
   anonimización/purga definida; antes de resolver, el operador puede leerlo (descifrado).
3. **Given** un reporte CLASIFICADO/CORREGIDO, **When** se consulta su texto,
   **Then** está cifrado en reposo y la anonimización sigue aplicándose cuando hay PII
   (comportamiento actual, reforzado con garantías de cobertura de la detección).
4. **Given** la baja de un reporte (lifecycle), **When** se ejecuta, **Then** la purga
   cubre también los textos según la política (documentada en research.md).

---

### Edge Cases

- Reportes históricos sin `textoOriginal` (pre-SPEC-110): la migración lo pobla cifrando
  el texto plano existente (nunca altera la semántica del original).
- Reportes en PROCESANDO durante la migración: la migración es idempotente y por lotes;
  el pipeline los descifra/re-cifra sin conflicto.
- Clave ausente o inválida: la app ya truena al arrancar (fail-closed, patrón S-1);
  rotación de clave FUERA de alcance (BL-2, del CEO).
- Operador resolviendo un caso DURANTE la migración: la lectura descifra transparente;
  ninguna acción humana re-cifra a mano.
- Texto ya cifrado que vuelve a pasar por el flujo (idempotencia: `isEncryptedValue`
  evita doble cifrado, patrón existente en anonimización).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `Reporte.texto` DEBE almacenarse cifrado con AES-256-GCM (misma clave y
  utilidades de `param-encryption.ts`) en TODA escritura (creación, pipeline, corrección,
  anonimización, reactivación).
- **FR-002**: La lectura del texto plano DEBE ocurrir SOLO en la capa de datos
  (DAL/servicios autorizados); el pipeline y las pantallas la consumen sin cambiar su
  lógica de clasificación (candado: la clasificación NO cambia).
- **FR-003**: La evidencia original NUNCA se altera en su semántica: se cifra, no se
  modifica (redacción científica: `textoOriginal` conserva el contenido íntegro).
- **FR-004**: TODO estado terminal DEBE tener una regla ejecutada de
  anonimización/purga según la tabla de política aprobada (research.md §Política):
  DUPLICADO al cierre del pipeline; REVISION_MANUAL/POSIBLE_SPAM/REQUIERE_ANONIMIZACION
  a la resolución humana; CLASIFICADO/CORREGIDO conservan texto cifrado (anonimización
  por PII ya vigente) con garantías documentadas.
- **FR-005**: DEBE existir un script de migración EXPLÍCITO, idempotente y por lotes,
  que cifre los textos históricos en claro y pueble `textoOriginal` donde falte, con
  conteo verificable (cero textos planos restantes).
- **FR-006**: Los logs y auditoría NUNCA incluyen el texto (ni plano ni cifrado completo);
  se mantiene la regla vigente (solo metadatos).
- **FR-007**: La clave sigue siendo la misma (`PARAM_ENCRYPTION_KEY`) y su gestión/respaldo
  es del CEO (BL-2); esta spec NO rota ni persiste claves nuevas.
- **FR-008**: La suite existente DEBE seguir verde sin debilitarse; los tests nuevos
  cubren cifrado en reposo, lectura transparente y la política por estado terminal.

### Key Entities *(include if feature involves data)*

- **`Reporte.texto`**: copia de trabajo del texto (pipeline/operador) → pasa a cifrado
  GCM en reposo, descifrado solo en la capa de datos.
- **`Reporte.textoOriginal`**: evidencia íntegra (ya cifrada al crear) → la migración la
  pobla donde falta; nunca se altera su contenido.
- **Política por estado terminal**: tabla estado → acción (anonimizar al cierre,
  anonimizar a la resolución, conservar cifrado) aprobada por ZEUS en compuerta.
- **`PARAM_ENCRYPTION_KEY`**: clave única vigente (CEO, BL-2).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Consulta de verificación: 0 filas de `Reporte` con `texto` o `textoOriginal`
  en claro (todas las nuevas y las migradas), medible en dev y prod tras la migración.
- **SC-002**: El pipeline completo procesa un reporte cifrado sin cambio de resultado
  (los tests del procesamiento siguen verdes; la clasificación no cambia).
- **SC-003**: Cada estado terminal tiene su regla testeada (duplicado al cierre;
  revisión/spam a la resolución; conservación cifrada en clasificado/corregido).
- **SC-004**: Migración ejecutada en dev con conteo impreso (cifrados, ya-cifrados,
  textoOriginal poblado) y segunda corrida = 0 cambios (idempotente).
- **SC-005**: Suite completa + `tsc --noEmit` + build + `arch:check` verdes.

## Assumptions

- `PARAM_ENCRYPTION_KEY` está configurada y respaldada por el CEO (BL-2); no hay rotación
  en esta spec.
- El valor cifrado cabe en `@db.Text` (GCM añade IV+TAG+base64; no hay límite práctico).
- La clasificación NO cambia: descifrar antes del pipeline y cifrar al persistir es
  transparente para el motor (candado del instructivo).
- Los estados REVISION_MANUAL/POSIBLE_SPAM necesitan lectura humana ANTES de resolver:
  la anonimización aplica a la resolución, no a la transición (a confirmar por ZEUS).
- La migración corre UNA vez por entorno (dev, prod) con verificación; el deploy la
  deja cableada como paso manual documentado (patrón 048).

## Impacto en arquitectura

Impacto en arquitectura: TOCA la capa de datos del agregado Reporte (repositorios/
servicios del DAL: creación, pipeline, lifecycle, corrección), añade un helper de
cifrado/descifrado de texto de reporte (patrón `param-encryption.ts`), la política de
anonimización por estado terminal en finalización/resolución, y un script de migración
idempotente en `scripts/`. NO toca schema (los campos ya son `@db.Text`), ni la lógica de
clasificación, ni la visibilidad pública, ni el motor de IA.

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (compuerta §4 APROBADA por ZEUS
con la política terminal D4 y las condiciones O-1..O-5, registradas aquí).

- **Helper único** (`src/lib/texto-reporte-cifrado.ts`, AES-256-GCM, misma clave
  `PARAM_ENCRYPTION_KEY` — BL-2 del CEO): idempotente en lectura Y escritura (O-3, sin
  doble cifrado), marcador constante no-identificable para la purga (O-2: las vistas lo
  muestran tal cual; nunca se cifra ni se descifra).
- **Cifrado en reposo**: la creación y la anonimización escriben `texto` cifrado; el
  pipeline, resolvers (spam, correcciones), expediente y bandejas leen el plano SOLO por
  `descifrarTextoReporte` en caminos autorizados. La clasificación NO cambió (O-5).
- **Política D4 (decisión ZEUS)**: purga de `texto` a marcador en DUPLICADO (al cierre del
  pipeline) y en `darDeBajaReporte` (baja y spam confirmado — resoluciones que no terminan
  CLASIFICADO/CORREGIDO); CLASIFICADO/CORREGIDO conservan `texto` cifrado;
  `textoOriginal` SIEMPRE cifrado y nunca purgado; `reactivarReporte` restaura la copia
  de trabajo desde la evidencia.
- **Guarda de frontera (O-1)**: `texto-reporte-frontera.test.ts` falla si alguna ruta
  lee o escribe `Reporte.texto` sin pasar por el helper.
- **Migración** (`scripts/migrar-cifrado-texto-reportes.ts`): validada en DEV — 2
  cifrados + 2 `textoOriginal` poblados, 0 texto plano restante, segunda corrida 0
  cambios (idempotente), integridad del contenido verificada al descifrar. **PROD NO se
  corrió (O-4)**: queda como paso manual documentado en `quickstart.md`, pendiente de
  que el CEO confirme BL-2 (llave respaldada).
- Tests ajustados al nuevo contrato (descifrado conserva el contenido íntegro — no se
  debilitó ninguno). Gates: suite completa verde, `tsc --noEmit`, build y `arch:check`
  verdes.
