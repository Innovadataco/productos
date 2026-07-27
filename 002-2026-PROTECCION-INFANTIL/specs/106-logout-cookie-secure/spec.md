# Feature Specification: Cerrar sesión de verdad (cookie `__Host-` y enrutado público del logo)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-27

**Status**: PLANEADO (en compuerta §4 — pendiente aprobación de ZEUS)

**Input**: "Alta en producción: 'Cerrar sesión' no cierra la sesión. POST /api/auth/logout
responde 200 y emite el borrado de `__Host-token` SIN el atributo `Secure`; el navegador
rechaza entero un Set-Cookie `__Host-` sin `Secure`, la sesión sobrevive en silencio. Borrar
con los mismos atributos con que se crea; test sobre la CABECERA Set-Cookie (no sobre el
status); y ajuste del enrutado por rol del logo: solo dentro de /dashboard/**, en rutas
públicas el logo va al home público — sin reabrir I-25."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El borrado de sesión llega al navegador (Priority: P1)

Como usuario autenticado (cualquier rol), quiero que "Cerrar sesión" elimine mi sesión de
verdad, para que al salir nadie pueda seguir usando mi cuenta en ese navegador.

**Why this priority**: Es una falla de seguridad activa en producción: el usuario cree que
salió y su sesión sigue viva (el servidor dice 200 pero el navegador descarta el borrado).

**Independent Test**: La respuesta de logout incluye la cabecera de borrado de la cookie de
sesión con los mismos atributos con que se creó (httpOnly, secure cuando aplica, sameSite,
path) y expiración pasada; un navegador estándar la acepta y destruye la cookie.

**Acceptance Scenarios**:

1. **Given** una sesión con cookie `__Host-token` (esquema seguro), **When** se llama
   logout, **Then** la cabecera Set-Cookie de borrado incluye `Secure`, `Path=/` y una
   expiración en el pasado (y `HttpOnly` y `SameSite` según el esquema de creación).
2. **Given** una sesión con cookie legacy `token` (esquema no seguro), **When** se llama
   logout, **Then** su borrado lleva los atributos que le corresponden a ESE esquema (sin
   `Secure`, `Path=/`, expiración pasada).
3. **Given** el flujo de login existente, **When** se revisa el diff, **Then** la creación
   de la cookie (auth.ts) no cambia: solo se corrige el borrado.

---

### User Story 2 - El logo no secuestra al admin en la app pública (Priority: P2)

Como ADMIN autenticado, quiero poder navegar las páginas públicas (incluido "Reportar
anónimo") sin que el logo del header me devuelva al panel, manteniendo intacto el enrutado
por rol cuando estoy dentro del panel.

**Why this priority**: Es el segundo síntoma de la misma causa: con la sesión viva (o por
diseño), el enrutado por rol del logo aplicado también en rutas públicas impide al admin
usar la app pública como un ciudadano más.

**Independent Test**: En una ruta pública (home, /reportar, /consulta), el logo apunta al
home público aunque haya sesión de ADMIN; en una ruta /dashboard/**, el logo apunta al home
del rol como hoy.

**Acceptance Scenarios**:

1. **Given** un ADMIN autenticado en la home pública, **When** mira el logo, **Then** apunta
   al home público (`/`).
2. **Given** el mismo ADMIN en una ruta /dashboard/**, **When** mira el logo, **Then**
   apunta al home de su rol (comportamiento SPEC-100 intacto).
3. **Given** el panel de colegio, **When** se revisa el diff, **Then** el botón "Cerrar
   sesión" del panel y el enrutado dentro de /dashboard/** no cambian (I-25 NO se reabre).

---

### Edge Cases

- Petición de logout sin sesión: responde igual de bien (borrado idempotente con los mismos
  atributos).
- Esquema no seguro (dev http): la cookie `token` se borra sin `Secure` (coherente con su
  creación); la `__Host-token` siempre con `Secure`.
- Usuario sin rol (anónimo) en rutas públicas: el logo al home público, como hoy.
- Navegadores que ignoran prefijos: el borrado con atributos completos funciona igual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El borrado de la cookie de sesión DEBE usar los mismos atributos con que se
  crea: `__Host-token` con `HttpOnly`, `Secure`, `SameSite` y `Path=/` (esquema seguro) y
  `token` con los del esquema no seguro, ambos con expiración pasada; NO `delete()` a secas.
- **FR-002**: El flujo de login y la creación de la cookie (auth.ts) NO se tocan.
- **FR-003**: Debe existir un test de regresión sobre la CABECERA Set-Cookie del logout que
  verifique `Secure`, `Path=/` y expiración pasada en el borrado de `__Host-token` (y los
  atributos del esquema legacy para `token`) — no un test de status 200.
- **FR-004**: El enrutado por rol del logo del header DEBE aplicar SOLO dentro del área
  autenticada (/dashboard/**); en rutas públicas el logo apunta al home público con o sin
  sesión.
- **FR-005**: I-25 NO se reabre: el botón "Cerrar sesión" del panel de colegio y el enrutado
  por rol dentro de /dashboard/** quedan intactos (si el plan los tocara, debe declararse y
  justificarse — no es el caso).

### Key Entities

- **Cookie de sesión**: `__Host-token` (esquema seguro) y `token` (legacy no seguro);
  atributos de creación = atributos de borrado.
- **Ruta**: pública vs área autenticada (/dashboard/**) para el destino del logo.

## Success Criteria *(mandatory)*

- **SC-001**: El 100% de los borrados de cookie de sesión incluyen los atributos completos
  del esquema correspondiente (verificado por test sobre Set-Cookie).
- **SC-002**: Tras logout, un navegador estándar destruye la cookie (el Set-Cookie es
  aceptado: prefijo `__Host-` satisfecho).
- **SC-003**: En rutas públicas, el logo apunta al home público con sesión de cualquier rol;
  en /dashboard/** apunta al home del rol (0 cambios respecto a SPEC-100 en esa área).
- **SC-004**: Login y creación de cookie bit a bit idénticos (diff sin tocar auth.ts).
- **SC-005**: Gate verde (lint + test + tsc + build).

## Assumptions

- La causa raíz verificada por ZEUS se toma como dada (no se re-investiga): la asimetría
  crear/borrar es el origen; el navegador rechaza el Set-Cookie `__Host-` sin `Secure`.
- El despliegue lo autoriza el CEO/ZEUS en el lote correspondiente (esta spec entrega
  código y pruebas).
