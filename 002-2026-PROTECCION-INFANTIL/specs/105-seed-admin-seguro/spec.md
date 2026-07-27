# Feature Specification: Seed del admin inicial sin credencial literal (I-31)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-27

**Status**: FINALIZADO (SIN desplegar, pendiente release + ACTA)

**Input**: "Fast-follow Crítico I-31: prisma/seed.ts siembra el ADMIN de producción con la
contraseña como LITERAL versionado en el repo, con `debeCambiarPassword:false` y bloque
`update:` que la REESCRIBE a la pública en cada corrida del seed. Sacar el literal del repo,
sembrar solo si no existe, forzar cambio de contraseña, barrer el repo por otras
credenciales literales y agregar test de regresión."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin inicial sembrado sin secreto en el repo (Priority: P1)

Como responsable de seguridad del producto, quiero que el administrador inicial se siembre
únicamente desde una variable de entorno y solo cuando no existe, de modo que ninguna
credencial viva esté escrita en el repositorio y ninguna corrida del seed pueda pisar una
contraseña ya rotada.

**Why this priority**: Hay un admin de PRODUCCIÓN cuya contraseña está publicada en git
(I-31, Crítica). Cada corrida del seed la reescribe al valor público: mientras el seed
tenga el literal, rotar la credencial no sirve.

**Independent Test**: Con la base vacía y la variable definida, correr el seed crea el
admin con la contraseña de la variable y `debeCambiarPassword=true`; correrlo de nuevo con
la contraseña ya cambiada manualmente NO la modifica; correr el seed SIN la variable no crea
admin (y no rompe el resto del seed); el repo no contiene ninguna contraseña literal.

**Acceptance Scenarios**:

1. **Given** base vacía y variable de entorno definida, **When** corre el seed, **Then** el
   admin existe con esa contraseña y `debeCambiarPassword=true`.
2. **Given** admin existente con contraseña rotada manualmente, **When** corre el seed,
   **Then** la contraseña rotada se conserva intacta (el seed no la pisa).
3. **Given** la variable de entorno ausente, **When** corre el seed, **Then** no se crea el
   admin (se registra la omisión) y el resto del seed completa sin error.
4. **Given** el repositorio, **When** se inspecciona el seed, **Then** no existe ninguna
   contraseña literal (ni de admin ni de otro usuario).

---

### User Story 2 - Inventario de credenciales literales del repo (Priority: P2)

Como responsable de seguridad, quiero un barrido del repositorio (seeds, fixtures, scripts,
docs) que reporte cualquier otra credencial literal, sin publicar sus valores, para
tratarlas una por una.

**Why this priority**: I-31 demuestra que el patrón "credencial en el repo" existe; hay que
saber si está en más sitios antes de darlo por cerrado.

**Independent Test**: El barrido produce una lista de hallazgos (archivo:línea, tipo de
credencial) sin valores; cada hallazgo queda clasificado (real vs placeholder de
documentación/test).

**Acceptance Scenarios**:

1. **Given** el árbol del repo, **When** corre el barrido, **Then** todo literal con pinta
   de credencial (contraseñas, claves, tokens) queda reportado con ubicación y tipo, nunca
   con el valor.
2. **Given** un placeholder legítimo (ej. `cambiar-en-produccion` o valores dummy de test),
   **When** se clasifica, **Then** queda marcado como aceptable con su justificación.

---

### User Story 3 - Guarda de regresión anti-literal (Priority: P3)

Como mantenedor, quiero una prueba automatizada que falle si el seed (o el repo) vuelve a
traer una contraseña literal, para que I-31 no se reintroduzca.

**Why this priority**: Sin guarda automatizada, la regresión es cuestión de tiempo.

**Independent Test**: La prueba falla si se reintroduce una contraseña literal en el seed;
pasa con el seed corregido.

**Acceptance Scenarios**:

1. **Given** el seed corregido, **When** corre la suite, **Then** la guarda pasa.
2. **Given** una contraseña literal reintroducida en el seed, **When** corre la guarda,
   **Then** falla señalando el archivo.

---

### Edge Cases

- El seed corre en un entorno sin la variable (dev nuevo): debe omitir el admin sin romper
  el resto del seed ni dejar una credencial por defecto.
- La variable existe pero está vacía o es demasiado débil: el seed la rechaza (mínimo de
  longitud coherente con la política de contraseñas del producto).
- El admin existe pero desactivado: el seed NO lo reactiva ni lo toca.
- Documentación con ejemplos de contraseñas: se clasifica como placeholder aceptable solo si
  es evidentemente ficticia y no es la credencial viva de ningún entorno.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El repositorio NO debe contener la contraseña del administrador inicial (ni de
  ningún otro usuario) como literal; el admin inicial se siembra SOLO desde variable de
  entorno documentada en la plantilla de entorno (sin valor).
- **FR-002**: El seed debe crear el admin únicamente cuando NO existe (operación de creación
  pura): NUNCA debe sobrescribir, reactivar ni modificar una credencial o cuenta existente.
- **FR-003**: El admin sembrado debe quedar con cambio de contraseña obligatorio en el
  primer ingreso (`debeCambiarPassword=true`).
- **FR-004**: Sin la variable de entorno, el seed debe omitir la creación del admin con un
  mensaje explícito y completar el resto del seed sin fallar.
- **FR-005**: Se debe ejecutar y documentar un barrido de credenciales literales en seeds,
  fixtures, scripts y docs del repo, reportando ubicación y tipo SIN publicar valores, con
  clasificación real vs placeholder.
- **FR-006**: Debe existir una prueba automatizada de regresión que falle si se reintroduce
  una contraseña literal en el seed.
- **FR-007**: Se debe entregar un procedimiento escrito para que el CEO rote la credencial
  viva de producción (la rotación la ejecuta el CEO personalmente; NO es parte de este
  trabajo).

### Key Entities

- **Usuario administrador inicial**: cuenta de arranque del panel; credencial solo desde
  entorno; cambio de contraseña forzado en primer ingreso.
- **Variable de entorno de seed**: nombre documentado en la plantilla (sin valor en git);
  ausencia = seed sin admin.

## Success Criteria *(mandatory)*

- **SC-001**: Un barrido automatizado del repo encuentra 0 contraseñas literales de usuarios
  (100% de las credenciales de seed provienen de variables de entorno).
- **SC-002**: Dos corridas consecutivas del seed tras una rotación manual conservan la
  contraseña rotada en el 100% de los casos (el seed nunca la pisa).
- **SC-003**: El admin sembrado exige cambio de contraseña en su primer inicio de sesión
  (100% de las siembras nuevas).
- **SC-004**: La prueba de regresión detecta la reintroducción de un literal en el 100% de
  los casos provocados (roja con literal, verde sin él).
- **SC-005**: El barrido de credenciales entrega un reporte con ubicación y tipo de cada
  hallazgo y 0 valores publicados.
- **SC-006**: El CEO dispone del procedimiento de rotación paso a paso (documento entregado).

## Assumptions

- La rotación de la credencial viva de producción la ejecuta el CEO personalmente
  (Metodología §7); este trabajo entrega código + procedimiento, no la rotación.
- La variable de entorno del seed se documenta en la plantilla del repo SIN valor; cada
  entorno la define fuera de git.
- Los demás usuarios sembrados (colegio/operador/comité reales del seed de prod) se revisan
  en el barrido: si tienen credencial literal, entran como hallazgos (su tratamiento puede
  requerir decisión aparte y se reporta, no se decide aquí).
- El seed de desarrollo local puede seguir creando el admin solo si la variable está
  definida; la comodidad de dev nunca justifica un literal.
