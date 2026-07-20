# Feature Specification: Configuración, guardado y mapa del Comité

**Feature Branch**: `[034-config-guardado-mapa-comite]`

**Created**: 2026-07-19

**Status**: CERRADA

**Input**: Correcciones y mejoras derivadas del cierre del spec 033: (1) `COMITE_VALIDACION` sigue cayendo en `/mis-reportes` tras login y muestra error al acceder a rutas de usuario final; (2) el editor de grupos de categoría usa autosave sobre un parámetro que no existe en BD, por lo que los cambios no persisten; (3) el mapa del dashboard público necesita rediseño visual (centro LATAM, leyenda, burbujas con etiquetas, mapeo de nombres de país y estilo pulido), manteniéndose offline.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Redirect y protección del rol Comité (Priority: P1)

Un usuario con rol `COMITE_VALIDACION` necesita que, tras iniciar sesión, el sistema lo lleve directamente a `/dashboard/admin/comite`, y no a `/mis-reportes` como ocurre hoy. Además, si un rol interno accede manualmente a `/mis-reportes` o `/dashboard/circulo-confianza`, el sistema debe redirigirlo a su área correspondiente sin mostrar errores.

**Why this priority**: Aunque el spec 033 corrigió el menú, el redirect post-login y las páginas de usuario final siguen tratando al comité como `PARENT`, generando una mala experiencia y errores visibles.

**Independent Test**: Un usuario `COMITE_VALIDACION` inicia sesión y es redirigido a `/dashboard/admin/comite`. Si accede manualmente a `/mis-reportes` o `/dashboard/circulo-confianza`, el navegador lo redirige a su área sin mostrar errores.

**Acceptance Scenarios**:

1. **Given** un usuario `COMITE_VALIDACION` que inicia sesión, **When** el login es exitoso, **Then** el sistema lo redirige a `/dashboard/admin/comite`.
2. **Given** un usuario `COMITE_VALIDACION`, **When** accede manualmente a `/mis-reportes`, **Then** es redirigido a `/dashboard/admin/comite` sin mostrar error.
3. **Given** un usuario `OPERADOR`, **When** accede manualmente a `/mis-reportes` o `/dashboard/circulo-confianza`, **Then** es redirigido a `/dashboard/admin`.
4. **Given** un usuario `PARENT`, **When** accede a `/mis-reportes` o `/dashboard/circulo-confianza`, **Then** ve su contenido normalmente.
5. **Given** un usuario `ADMIN` o `SCHOOL_ADMIN`, **When** accede manualmente a `/mis-reportes` o `/dashboard/circulo-confianza`, **Then** es redirigido a `/dashboard/admin`.

---

### User Story 2 - Configuración: guardado explícito con botón + confirmación (Priority: P1)

El administrador edita los grupos de categoría en el módulo de Configuración. Actualmente el editor usa autosave, pero el parámetro `ui.grupos_categoria` no existe en BD, por lo que el PATCH falla con 404 y los cambios no persisten. El administrador necesita un guardado explícito confiable, con confirmación y advertencia de cambios sin guardar.

**Why this priority**: Sin persistencia, la configuración de grupos de categoría no es usable en producción. El autosave oculta errores y genera inconsistencia con el resto del módulo Configuración, que ya usa botón de guardado.

**Independent Test**: Un admin abre el editor de grupos de categoría con `ui.grupos_categoria` vacío, realiza cambios, presiona "Guardar cambios", recibe confirmación, recarga la página y los cambios persisten.

**Acceptance Scenarios**:

1. **Given** que `ui.grupos_categoria` no existe en BD, **When** el admin abre el editor, **Then** se cargan los 5 grupos fallback sin mostrar error de "Parámetro no encontrado".
2. **Given** el editor con el fallback cargado, **When** el admin renombra un grupo, **Then** el botón "Guardar cambios" se habilita y aparece indicador de cambios sin guardar.
3. **Given** cambios sin guardar, **When** el admin intenta cerrar la pestaña del navegador, **Then** el navegador muestra una advertencia estándar.
4. **Given** el editor con cambios, **When** el admin presiona "Guardar cambios", **Then** el parámetro se crea o actualiza, y se muestra un mensaje de confirmación.
5. **Given** el editor tras guardar exitosamente, **When** el admin recarga la página, **Then** se muestra el valor guardado, no el fallback inicial.
6. **Given** el módulo Configuración con otros parámetros editados, **When** el admin intenta cerrar la pestaña sin guardar, **Then** aparece la advertencia de cambios sin guardar.

---

### User Story 3 - Rediseño visual del mapa del dashboard público (Priority: P2)

El mapa del dashboard público muestra contornos de países y puntos de ciudad, pero se ve poco pulido: usa colores básicos, no tiene leyenda, las burbujas no muestran números ni nombres, no mapea bien los nombres de países en español y el centro es mundial en lugar de LATAM. El sistema debe funcionar offline, sin tiles externos.

**Why this priority**: El mapa es una de las vistas más visibles para usuarios anónimos; un diseño pulido comunica confianza y mejora la comprensión de la distribución geográfica de reportes.

**Independent Test**: El dashboard público carga un mapa centrado en Colombia/LATAM, con países coloreados por cantidad, burbujas de ciudad con números y nombres, leyenda explicativa y popups claros, todo sin requerir internet.

**Acceptance Scenarios**:

1. **Given** que el dashboard público tiene datos por país y ciudad, **When** se carga el mapa, **Then** el centro/zoom por defecto es Colombia/LATAM y los países con reportes se colorean según la escala rojo/naranja/verde.
2. **Given** un país coloreado, **When** el usuario pasa el mouse sobre él, **Then** cambia de estilo (hover) y al hacer clic muestra un popup con nombre y cantidad de reportes.
3. **Given** una ciudad con reportes, **When** el usuario ve el mapa, **Then** aparece una burbuja con el número de reportes y el nombre de la ciudad (tooltip o etiqueta visible).
4. **Given** el mapa, **When** el usuario busca contexto de la escala de colores, **Then** ve una leyenda en una esquina que explica rojo/naranja/verde.
5. **Given** que el servidor no tiene internet, **When** se carga el dashboard, **Then** el mapa funciona porque el GeoJSON está en `public/geo`.
6. **Given** un país con nombre en español en la BD (ej. "Estados Unidos"), **When** se colorea el mapa, **Then** el sistema lo empareja con el nombre en inglés del GeoJSON.

---

### Edge Cases

- ¿Qué ocurre si el parámetro `ui.grupos_categoria` existe pero tiene JSON inválido? El editor debe caer al fallback y permitir guardar un nuevo valor válido.
- ¿Qué pasa si el admin edita un parámetro en ConfigPanel y otro en el editor de grupos? Cada componente debe advertir de cambios sin guardar de forma independiente.
- ¿Cómo se maneja un país en la BD cuyo nombre no coincide con ninguna entrada del diccionario? El país no se colorea, pero sigue apareciendo en la lista "Top países" y los puntos de ciudad siguen visibles.
- ¿Qué sucede si no hay datos geográficos? El mapa muestra el centro por defecto en Colombia/LATAM con un mensaje informativo.
- ¿Qué pasa si un usuario anónimo accede a `/dashboard/admin/comite`? El layout admin lo redirige a `/login`; no es parte de este spec.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE redirigir a un usuario `COMITE_VALIDACION` a `/dashboard/admin/comite` tras el login exitoso.
- **FR-002**: El sistema DEBE redirigir a usuarios con roles internos (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`) que accedan a `/mis-reportes` a su área correspondiente (`/dashboard/admin` o `/dashboard/admin/comite`).
- **FR-003**: El sistema DEBE redirigir a usuarios con roles internos que accedan a `/dashboard/circulo-confianza` a su área correspondiente.
- **FR-004**: El sistema DEBE permitir que usuarios con rol `PARENT` accedan normalmente a `/mis-reportes` y `/dashboard/circulo-confianza`.
- **FR-005**: El sistema DEBE soportar UPSERT en el endpoint `PATCH /api/config/parametros/[clave]` (crear si no existe, actualizar si existe).
- **FR-006**: El sistema DEBE aceptar metadatos del parámetro en el body del PATCH (`tipo`, `categoria`, `esPublico`, `esSecreto`, `descripcion`) para crear el parámetro si no existe.
- **FR-007**: El sistema DEBE registrar un audit log (`PARAM_UPDATE`) tanto en la creación como en la actualización del parámetro.
- **FR-008**: El editor de grupos de categoría DEBE reemplazar el autosave por un botón "Guardar cambios".
- **FR-009**: El editor de grupos de categoría DEBE mostrar una confirmación de guardado exitoso o error.
- **FR-010**: El editor de grupos de categoría DEBE advertir al usuario si intenta cerrar la pestaña con cambios sin guardar.
- **FR-011**: El editor de grupos de categoría DEBE cargar el fallback en silencio cuando el parámetro no existe, sin mostrar "Parámetro no encontrado".
- **FR-012**: El módulo Configuración (ConfigPanel) DEBE advertir al usuario si intenta cerrar la pestaña con cambios sin guardar.
- **FR-013**: El módulo Configuración DEBE mostrar un indicador visual de campos editados pero no guardados.
- **FR-014**: El mapa del dashboard público DEBE estar centrado por defecto en Colombia/LATAM.
- **FR-015**: El mapa DEBE colorear los países con escala rojo (mayor) / naranja (media) / verde (menor) e incluir una leyenda.
- **FR-016**: El mapa DEBE mostrar burbujas de ciudad con el número de reportes y el nombre de la ciudad.
- **FR-017**: El mapa DEBE mapear nombres de países en español de la BD a los nombres en inglés del GeoJSON.
- **FR-018**: El mapa DEBE funcionar sin conexión a internet, usando el GeoJSON empaquetado en `public/geo`.
- **FR-019**: El mapa DEBE tener estados de hover claros en países y popups informativos.

### Key Entities

- **Usuario**: roles relevantes `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`.
- **ParametroSistema**: clave `ui.grupos_categoria` y otros parámetros editables en Configuración.
- **GeoJSON de países**: `public/geo/world-countries.json` con nombres en inglés.
- **Reporte**: campos `pais`, `ciudad`, `lat`, `lng` para agregación geográfica.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario `COMITE_VALIDACION` es redirigido a `/dashboard/admin/comite` en menos de 1 segundo tras el login.
- **SC-002**: El 100% de intentos de acceso a `/mis-reportes` o `/dashboard/circulo-confianza` por roles internos resultan en redirección sin renderizar la página con error.
- **SC-003**: El editor de grupos de categoría crea/actualiza el parámetro `ui.grupos_categoria` correctamente cuando no existía previamente.
- **SC-004**: Al menos 80% de los países con reportes en la BD se colorean correctamente en el mapa mediante el diccionario de nombres.
- **SC-005**: El mapa carga sin errores con la conexión a internet deshabilitada en el servidor.
- **SC-006**: `npm run test` continúa pasando con 0 tests nuevos fallidos por este spec.

---

## Assumptions

- El rol `COMITE_VALIDACION` ya existe y tiene acceso al layout de administración.
- El parámetro `ui.grupos_categoria` puede no existir en BD; el fallback `GRUPOS_CATEGORIA_FALLBACK` es la fuente de verdad inicial.
- El dashboard público recibe datos agregados por país y ciudad desde `/api/estadisticas-publicas`.
- El servidor de producción no tiene salida a internet.
- El GeoJSON local `public/geo/world-countries.json` ya está disponible (creado en spec 033).
- No se requieren cambios en el modelo de datos de Prisma.

---

## Implementación

### Objetivo alcanzado

Se cerraron las 3 User Stories del spec 034:

- **US1**: `COMITE_VALIDACION` ya no cae en `/mis-reportes` tras login; es redirigido a `/dashboard/admin/comite`. Los roles internos (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`) son redirigidos limpiamente si acceden manualmente a `/mis-reportes` o `/dashboard/circulo-confianza`.
- **US2**: El endpoint `PATCH /api/config/parametros/[clave]` soporta upsert (crea el parámetro si no existe, actualiza si existe) y acepta metadatos opcionales en el body. El editor de grupos de categoría reemplazó el autosave por un botón "Guardar cambios" con estado dirty, advertencia `beforeunload` y mensaje de confirmación. El `ConfigPanel` añadió advertencia de cambios sin guardar y un indicador dirty por sección.
- **US3**: El mapa del dashboard público se rediseñó con centro/zoom por defecto en Colombia/LATAM, estilo cuidado (océano, tierra, bordes suaves), choropleth con escala rojo/naranja/verde, leyenda, burbujas de ciudad con número visible y tooltip con nombre y conteo, hover en países y mapeo de nombres español→inglés. Funciona offline usando `public/geo/world-countries.json`.

### Decisiones de diseño

- **Redirects client-side**: se resolvieron con guards en las páginas de Next.js (`login/page.tsx`, `mis-reportes/page.tsx`, `dashboard/circulo-confianza/page.tsx`) para no duplicar lógica en el middleware y mantener la experiencia en el cliente.
- **Upsert de parámetros**: se prefirió un mapa de defaults conocidos (`ui.grupos_categoria`) combinado con metadatos opcionales en el body, para que el endpoint sea usable sin cambiar todos los clientes existentes.
- **Guardado explícito**: se eliminó el autosave del editor de grupos para alinearlo con el patrón de botón "Guardar cambios" ya presente en `ConfigPanel`, reduciendo errores silenciosos y mejorando la percepción de control del administrador.
- **Mapa offline**: se mantuvo Leaflet + GeoJSON local (sin TileLayer externo) y se mejoró la presentación con CSS inline en el icono de ciudad, tooltip y leyenda, evitando nuevas dependencias.

### Endpoints / componentes afectados

- `src/app/login/page.tsx`
- `src/app/mis-reportes/page.tsx`
- `src/app/dashboard/circulo-confianza/page.tsx`
- `src/app/api/config/parametros/[clave]/route.ts`
- `src/app/api/config/parametros/[clave]/route.test.ts`
- `src/components/modules/CategoriaGruposEditor.tsx`
- `src/components/modules/ConfigPanel.tsx`
- `src/components/modules/MapaUbicaciones.tsx`
- `src/components/modules/PublicDashboard.tsx`

### Tests

- `npm run lint`: sin errores (2 warnings preexistentes no relacionadas).
- `npx tsc --noEmit`: sin errores.
- `npm run test`: 409 tests pasan, 0 fallidos.
- Test nuevo: upsert del parámetro y creación con metadatos en `src/app/api/config/parametros/[clave]/route.test.ts`.
- Pruebas manuales con `quickstart.md`:
  - Login de `COMITE_VALIDACION` devuelve el rol correcto; el código de redirect apunta a `/dashboard/admin/comite`.
  - PATCH de `ui.grupos_categoria` inexistente crea el parámetro y devuelve 200.
  - `/dashboard-publico` carga y `/api/estadisticas-publicas` devuelve datos por país y ciudad.
  - Healthcheck OK tras deploy limpio.

### Migraciones

No se requirieron migraciones. Los cambios son compatibles con el esquema actual; el upsert crea registros aditivos en `ParametroSistema` y los redirects no afectan datos.
