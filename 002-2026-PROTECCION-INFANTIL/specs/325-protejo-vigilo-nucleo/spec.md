# SPEC-325 · A quién protejo, a quién vigilo · NÚCLEO

> **Status**: DESARROLLO (Rama: work/pi-SPEC-325-protejo-vigilo-nucleo · Radicado: 002-PI-225 · Brief A-61 núcleo)

**Impacto en arquitectura:** Modelo Prisma nuevo `Hijo` + hija `IdentificadorHijo` (relación con `Usuario`, PII de menor con el criterio de `Estudiante`/`Alumno`), tabla puente `HijoPadre` para el caso dos-padres-un-niño (detección por documento). Campos nuevos en `ContactoConfianza` (`nombre`, `parentesco`) y ampliación de `@@unique` de `IdentificadorContacto` de scope-contacto a scope-padre (con warn+override). **Un solo mecanismo de monitoreo compartido:** función única `normalizarIdentificador()` usada en TODA escritura de identificador (hijo, contacto, y el `identificadorReportado` de ingesta de reporte) y en el cruce, de modo que protejo y vigilo comparten el MISMO cruce→alerta→normalización. Migración aditiva schema-to-schema (no `migrate dev` sobre la DB compartida). Fuera: §3.2 puente NIT (radicado aparte, gated A-58).

## Contexto

Verificado en fuente (candado 15 v5):
- **NO existe `model Hijo`** ni relación `Usuario`↔menores propios — el módulo "protejo" se construye.
- **"Vigilo" es `ContactoConfianza`** (`prisma/schema.prisma:1912`): tiene `etiqueta String?` opcional (no `nombre`/`parentesco`), `nota String?` **write-only** (se escribe en `contactos-mutaciones.ts:82` y nunca se lee en las vistas), `IdentificadorContacto` con `tipo String?` decorativo, `@@unique([contactoId, valor, plataformaId])` (`:1942`) — scope por contacto, **permite el mismo identificador en dos contactos del mismo padre**.
- **El "guardado normaliza toLowerCase" del brief es impreciso:** `contactos-mutaciones.ts:36` usa `valor.toLowerCase()` **solo para la clave de dedup en memoria**; el valor que se **persiste** (`:41`, `push({...i, valor})`) está solo `trim()`-eado (`:34`), **NO lowercased**. Es decir: hoy el valor almacenado conserva el case original.
- **El cruce usa valores crudos** contra `Reporte.identificador`/`identificadorReportado` crudos → `TioJuan1` guardado no cruza con `tiojuan1` reportado, **y no avisa** (defecto silencioso).
- **Patrón PII de menor:** `model Estudiante` (`:1230`, `@@map("Alumno")`): `nombre`, `apellidos`, `documentoTipo?`/`documentoNumero?` (set cerrado en Zod: RC|TI|CC|CE|PASAPORTE|OTRO), nunca consultado por id suelto, siempre acotado por el dueño.

## La decisión de arquitectura (CERRADA por el CEO · no reabrible)

**Dos modelos de entidad, UN mecanismo de monitoreo.**
- `Hijo` (protejo · documento/edad/sexo obligatorios) y `ContactoConfianza` (vigilo · sin datos obligatorios) = dos entidades separadas. Una sola tabla con campos condicionalmente-obligatorios rompería la validación de BD.
- **UN solo cruce identificador→alerta**, compartido. Si aparecen dos rutinas de cruce, dos pipelines de alerta o dos lugares de normalización, se rompió la decisión.

## Inventario del mecanismo compartido (candado 22 v5)

**Normalización — HOY (1 lugar, y NO persiste):**
| archivo:línea | qué hace hoy |
|---|---|
| `src/lib/dal/services/circulo-confianza/contactos-mutaciones.ts:36` | `valor.toLowerCase()` **solo** para la clave de dedup; el valor persistido (`:41`) NO se normaliza |

**Cruce identificador reportado — HOY (12 callsites, todos con valor crudo):**
| # | archivo:línea |
|---|---|
| 1 | `src/lib/dal/services/circulo-confianza/estado.ts:80` |
| 2 | `src/lib/dal/services/circulo-confianza/contactos.ts:56` |
| 3 | `src/lib/dal/services/circulo-confianza/agregado.ts:118` |
| 4 | `src/lib/dal/services/padre-home.ts:61` |
| 5 | `src/lib/dal/services/padre-home.ts:77` |
| 6 | `src/lib/dal/services/padre-home.ts:119` |
| 7 | `src/lib/dal/repositories/timeline-circulo-repository.ts:54` |
| 8 | `src/lib/dal/repositories/timeline-circulo-repository.ts:84` |
| 9 | `src/lib/dal/repositories/timeline-circulo-repository.ts:108` |
| 10 | `src/lib/dal/repositories/identificador-reportado.ts:62` |
| 11 | `src/lib/dal/repositories/semaforo-repository.ts:40` |
| 12 | `src/lib/dal/repositories/semaforo-repository.ts:66` |

**Helper del cruce compartido:** `whereReportesCirculo()` (`estado.ts:13`) — es el punto natural para centralizar, pero los valores llegan ya armados por cada callsite; la normalización debe aplicarse **al generar la lista de `valores`** y **al ingresar `identificadorReportado`**, en una sola función.

**Escritura de `identificadorReportado` (lado reporte):** `src/lib/dal/repositories/identificador-reportado.ts` (upsert `:77`) — hay que verificar en el plan si la ingesta normaliza; si no, es un segundo punto de escritura que debe usar la MISMA función.

## Alcance (núcleo · §3.1 + §3.3-3.5 · el §3.2 puente NIT NO va acá)

### US1 · A quién protejo — módulo `Hijo` nuevo (§3.1)
- Modelo `Hijo`: nombres, apellidos, **tipo+número de identificación OBLIGATORIOS** (mismo set cerrado que `Estudiante`), edad, sexo. **Identificadores OPCIONALES** (Roblox, teléfono, correo) en hija `IdentificadorHijo`.
- El padre registra hijos **y** familiares-que-no-son-hijos (van igual).
- **Para qué sirve:** si alguien reporta el identificador de un hijo, el padre se entera (vía el mecanismo compartido) + estadística.
- **PII de menor:** patrón `Estudiante` (sin exponer en URLs, sin logs con el dato en claro, acceso solo por el padre dueño). **No inventar criterio nuevo.**

### US1-bis · Dos padres, un niño (§3.1-bis)
- Detección **por documento**: si coincide, es el mismo menor → no se duplica; el 2º padre se vincula al registro existente (tabla puente `HijoPadre`).
- Datos del niño (incl. identificadores): **uno solo compartido**. Reportes/expediente/PDF: **privados de cada padre**. Alertas: **a los dos** (la alerta es del niño).
- **Conflicto de edición:** agregar identificador es libre; **quitar solo desvincula de la vista de quien lo quita, sin borrarlo para el otro.**
- **Límite DURO:** un padre nunca ve reportes/expedientes/contactos del otro.

### US2 · A quién vigilo — arreglar `ContactoConfianza` (§3.3)
- **`nombre` y `parentesco` como campos propios** (hoy solo `etiqueta` opcional).
- **`nota`:** hacerla visible+editable (hoy write-only) o quitarla.
- **`tipo`:** definirlo con sentido o quitarlo (hoy decorativo).
- **Gestión completa:** editar contacto; agregar/quitar/corregir identificadores post-alta; **activar/inactivar contacto Y cada identificador por separado** (`contactos-mutaciones.ts:167-172` ya lo soporta en backend, falta UI); **borrar contacto** (hoy `grep DELETE` en `src/app/api/circulo-confianza/**` = cero).
- **Unicidad ampliada:** un identificador no se repite entre dos personas del mismo padre → **warn con override** (dice a quién pertenece). Ampliar `@@unique([contactoId,valor,plataformaId])` (`:1942`) al scope del padre.

### US3 · 🔴 Normalizar el cruce (el defecto silencioso · §3.3)
- Una única `normalizarIdentificador(valor)` (trim + lowercase + regla de plataforma si aplica) usada en: escritura de identificador de hijo, escritura de identificador de contacto, ingesta de `identificadorReportado`, y armado de `valores` del cruce. **Un solo lugar.**
- **Test obligatorio** (candado 24 v2): `TioJuan1` guardado ⟷ `tiojuan1` reportado → **cruza**.

### US4 · Explicar para qué sirve (§3.4)
- Copy de padre (regla A-62), no literal: *"Aquí vinculás a los familiares y amigos cercanos a tus hijos. Si detectamos un reporte con riesgo, te avisamos."*

### US5 · Componentes muertos (§3.5)
- `SemaforoCirculo.tsx` no está montado; APIs semaforo (SPEC-305) y timeline (SPEC-306) sin consumidor. **Decisión en el plan:** si sirven a las vistas nuevas, conectarlos; si no, borrarlos.

## Fuera de alcance
- **§3.2 puente NIT con el colegio** → radicado aparte gated en A-58 desplegado.
- Expediente/reportes → A-60 · lenguaje/diseño visual → A-62.
- Cualquier cosa que haga obligatorio tener colegio.
- Solo-lectura: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`.

## Criterios de aceptación (evidencia §6 · candado 25)
1. Registrar hijo con documento e identificadores → aparece en "a quién protejo".
2. Registrar familiar no-hijo → entra igual.
3. Reporte contra el identificador de un hijo → el padre se entera (mecanismo compartido).
4. Padre sin colegio usa el módulo sin fricción.
5. Contacto vigilado con nombre+parentesco, editarlo, agregar identificador, **desactivar solo ese identificador**.
6. Mismo identificador en dos personas → warn+override (dice a quién pertenece).
7. **`TioJuan1` guardado + `tiojuan1` reportado → cruza** (fix del defecto silencioso).
8. Dos padres, un niño (mismo documento) → datos del niño compartidos, reportes/expediente privados, alerta a los dos.

## Compuerta §4
specify → plan → **PARA** (modelo `Hijo`, mecanismo compartido, dos-padres-un-niño = diseño real que revisa Fábrica PI-1) → tasks → `/speckit-analyze` (candado 21 v3) → implement.
