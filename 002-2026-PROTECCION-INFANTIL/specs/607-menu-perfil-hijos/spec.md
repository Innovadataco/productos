# SPEC-607 · Menú definitivo del padre + «Mi perfil» unificado + hijos sin documento

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-09 · **Origen**: diseño final aprobado (`design/expediente-final-mockup.html`, «Expediente como módulo único»). Rama `work/pi-SPEC-607-menu-perfil-hijos`.

## Qué se aprueba

El mockup de diseño final fija tres cosas para el área del padre:

1. **Menú definitivo de 6 entradas** (módulos 1, 4, 5 y 7 del mockup): Inicio · A quién protejo · A quién vigilo · **Reportar** (grupo colapsable: Reportar, Mis expedientes) · **Ayuda profesional** (grupo colapsable: Encontrar psicólogo, Mis citas) · **Mi perfil** (ítem único, sin submódulos). Salen del menú: «Mis reportes» (`/mis-reportes` sigue existiendo por URL y enlaces internos), «Suscripción» y «Notificaciones» como ítems sueltos (viven dentro de Mi perfil).
2. **«Mi perfil» unificado** (módulo 7): UNA página `/dashboard/padre/perfil` con tres acordeones `<details>` nativos — Información general (formulario + email editable SPEC-590 + historial de cambios + «Crear contraseña» SPEC-598 si aplica), Notificaciones (el contenido de `/dashboard/padre/notificaciones`), Suscripción (el contenido de `/dashboard/padre/suscripcion`). Las rutas viejas redirigen con ancla (`#notificaciones`, `#suscripcion`) para no romper enlaces.
3. **Hijos sin documento** (módulo 5): el alta pide solo nombres* y apellidos*; edad, sexo y cuentas opcionales. **Ya implementado por SPEC-589** (06-09-2026): las columnas `Hijo.documentoTipo/documentoNumero` se ELIMINARON de la BD (migración `20260908000829_spec589_hijo_sin_documento`, excepción autorizada a la regla aditiva), el formulario (SPEC-601) y el wizard (SPEC-599) no las piden y `POST /api/padre/hijos` las ignora. Esta spec lo declara y le suma el candado de UI que faltaba.

## User Stories

### US-1 · Menú definitivo (P1)

Como padre, quiero un menú de 6 entradas con «Reportar» y «Ayuda profesional» agrupados, para encontrar todo sin ruido: lo de mi cuenta vive en «Mi perfil».

**Escenarios de aceptación**
- Dado el área del padre en escritorio, el lateral muestra exactamente: Inicio, A quién protejo, A quién vigilo, Reportar (con chevron y submódulos Reportar/Mis expedientes), Ayuda profesional (con chevron y submódulos Encontrar psicólogo/Mis citas), Mi perfil.
- Los grupos nacen expandidos y el chevron colapsa/expande (accesible: botón con `aria-expanded`).
- En móvil la barra inferior aplana los grupos: los 8 destinos quedan a un toque (Reportar a UN toque, I-38).
- «Mis reportes», «Suscripción» y «Notificaciones» ya NO aparecen como ítems sueltos.

### US-2 · Mi perfil unificado (P1)

Como padre, quiero una sola ventana «Mi perfil» con mis datos, mis avisos y mi plan en tres acordeones, para no buscarlos en tres pantallas.

**Escenarios de aceptación**
- `/dashboard/padre/perfil` renderiza 3 acordeones nativos (`<details>`): Información general (abierto por defecto con cobertura), Notificaciones y Suscripción.
- Sin suscripción activa (destino del guardián de vigencia), el acordeón «Suscripción» nace ABIERTO con el selector de planes / la espera de autorización — el muro de pago conserva su puerta.
- Cuenta OAuth sin clave local: «Crear contraseña» → `/cambiar-password` (SPEC-598); con clave propia no se muestra.
- `GET /dashboard/padre/notificaciones` → redirect de servidor a `/dashboard/padre/perfil#notificaciones`.
- `GET /dashboard/padre/suscripcion` → redirect de servidor a `/dashboard/padre/perfil#suscripcion` (conserva `?bienvenida=1`).

### US-3 · Hijos sin documento (P1 · ya en main, se candado)

Como padre, registro a mi hijo con solo su nombre y apellidos; el sistema no me pide su documento.

**Escenarios de aceptación**
- El formulario inline (`FormularioAltaHijo`, SPEC-601) no renderiza campos de documento.
- El alta con solo nombres + apellidos sale (201) y el payload no lleva `documentoTipo`/`documentoNumero` ni los exige la validación.

## Impacto en arquitectura: **SÍ** (navegación y guardias; schema NO cambia en este PR)

- **Navegación: SÍ cambia.** `PADRE_NAV_ITEMS` pasa de 11 ítems planos a 6 entradas con dos grupos expandibles; `PadreSideNav` gana submódulos colapsables; `PadreNavMovil` aplana; dos rutas del área (`/dashboard/padre/notificaciones`, `/dashboard/padre/suscripcion`) pasan de página a redirect. Las tablas generadas (`docs/architecture/02-roles-capacidades.md`, `03-pantallas.md`) NO viajan en el PR — convención SPEC-487/D-109: `npm run arch:check` valida representabilidad (VERDE en este PR) y el barrido post-merge las regenera.
- **Guardias: SÍ cambia.** `GUARDIAS_ACCESO.vigencia.PARENT.exentas` gana `/dashboard/padre/perfil` (la ruta vieja de suscripción redirige ahí: sin la exención, el padre sin vigencia rebotaría en bucle guardián→redirect→guardián, clase I-25) y `/api/notificaciones` (el acordeón los consume dentro de una página ahora exenta). El `destino` del guardián NO cambia (sigue siendo la ruta vieja, que redirige con ancla).
- **Schema: NO cambia en este PR.** Las columnas de documento del menor ya fueron eliminadas por SPEC-589 (DROP autorizado); no hay migración nueva. El documento del PADRE (`Usuario`) se conserva intacto.
- **Stack: no cambia.**

## Functional Requirements

- **FR-001**: El sistema DEBE pintar el menú del padre con exactamente las 6 entradas aprobadas, con «Reportar» y «Ayuda profesional» como grupos colapsables que nacen expandidos (botón `aria-expanded` + sublista).
- **FR-002**: El sistema NO DEBE mostrar «Mis reportes», «Suscripción» ni «Notificaciones» como ítems sueltos del menú. `/mis-reportes` DEBE seguir funcionando por URL.
- **FR-003**: La barra móvil DEBE aplanar los grupos: los 8 destinos a un toque, «Reportar» incluido (I-38).
- **FR-004**: `/dashboard/padre/perfil` DEBE renderizar los tres acordeones con ids `general`, `notificaciones` y `suscripcion` (contrato de los redirects con ancla) y el contenido íntegro de las antiguas pantallas.
- **FR-005**: Las rutas viejas DEBEN responder con redirect de servidor a `/dashboard/padre/perfil#notificaciones` y `#suscripcion` (conservando `?bienvenida=1`), nunca 404 ni doble contenido.
- **FR-006**: Sin cobertura (sin plan, vencido o `PENDIENTE_AUTORIZACION`), el acordeón «Suscripción» DEBE nacer abierto; con cobertura, «Información general». «Crear contraseña» DEBE aparecer solo en cuentas OAuth sin clave local.
- **FR-007**: El guardián de vigencia NO DEBE entrar en bucle con el redirect: `/dashboard/padre/perfil` y `/api/notificaciones` DEBEN ser exentos para PARENT.
- **FR-008 (ratchet)**: El alta de hijos NO DEBE pedir ni aceptar documento del menor: candados de UI (formulario sin campos, POST con solo nombre+apellidos) y de API (SPEC-589: campos ignorados) DEBEN quedar en verde permanente; devolver un input de documento al formulario = rojo.

## Criterios de éxito

- Menú con 6 entradas exactas y colapsables verificados por test (items, orden, chevron, activo).
- Perfil con 3 acordeones verificados por test (ids, contenido de cada sección, abierto por defecto según cobertura, «Crear contraseña» condicional, redirects con ancla).
- Alta de hijo sin documento verificada en UI y API.
- Gate completo verde: `tsc --noEmit`, `lint`, `test`, `build`, `arch:check`.

## Supuestos

- El mockup muestra «A quién vigilo» en `/dashboard/padre/circulo`; la ruta real es `/dashboard/padre/circulo-confianza` (no se renombra en esta spec).
- El mockup conserva el documento del PADRE en «Información general»: es `Usuario.documentoTipo/Numero`, intacto (SPEC-339 §2.3).
- «Mis citas» y «Encontrar psicólogo» conservan sus rutas; solo cambia su agrupación en el menú.

## Implementación

- `src/lib/nav-items.ts`: `PADRE_NAV_ITEMS` definitivo (6 entradas, `children` en `PadreNavItem`).
- `src/components/modules/padre/PadreSideNav.tsx`: grupos colapsables (nacen expandidos, chevron con `aria-expanded`, grupo del activo en cielo); íconos nuevos (protejo/vigilo/ayuda).
- `src/components/modules/padre/PadreNavMovil.tsx`: aplanado de grupos (8 destinos).
- `src/app/dashboard/padre/perfil/page.tsx`: una ventana con 3 acordeones nativos; absorbe la lógica de `/dashboard/padre/suscripcion` (vista activa, espera de autorización, selector de planes + server actions revalidando la nueva ruta); «Crear contraseña» condicional (SPEC-598).
- `src/app/dashboard/padre/suscripcion/page.tsx` y `notificaciones/page.tsx`: redirects de servidor con ancla (suscripción conserva `?bienvenida=1`).
- `src/lib/routing/guardias.ts`: exentas de vigencia PARENT += `/dashboard/padre/perfil`, `/api/notificaciones` (anti-bucle + acordeón funcional sin plan).
- Enlaces directos actualizados: `src/app/camino/listo/page.tsx` (avisos → perfil#notificaciones), `src/lib/padre/home-sugerencia.ts` (renovar → perfil#suscripcion).
- Tests: `PadreSideNav.test.tsx` y `PadreNavMovil.test.tsx` reescritos; `mis-citas.candado.test.ts` (6 entradas, «Mis citas» en el grupo); nuevos `perfil/page.test.tsx`, `suscripcion/page.test.tsx`, `notificaciones/page.test.tsx`, `FormularioAltaHijo.test.tsx`; `home-sugerencia.test.ts`.
- Arquitectura: `npm run arch:check` VERDE en el PR (modo representabilidad, SPEC-487/D-109); las tablas `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md` las regenera el barrido post-merge — no viajan en el PR.

## Deuda técnica

- `redireccionSuscripcion("PARENT")` y el `destino` del guardián siguen apuntando a la ruta vieja (un 307 + un redirect de servidor = dos saltos). Endurecerlo a `/dashboard/padre/perfil` directo queda como higiene opcional: exige tocar la invariante de `guardias.ts` y 4 suites del guardián.
- El centro de notificaciones in-app (campana del header) es otra superficie; no se toca.
