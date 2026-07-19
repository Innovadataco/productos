# Feature Specification: Correcciones de vistas y roles

**Feature Branch**: `[033-correcciones-vistas-roles]`

**Created**: 2026-07-19

**Status**: EN DESARROLLO

**Input**: Tres correcciones de prioridad P1/P2 detectadas en fase de desarrollo: (1) el rol `COMITE_VALIDACION` cae en el menú de usuario final y recibe errores 403; (2) el editor de grupos de categoría arranca vacío y no coincide con el fallback que usan los usuarios; (3) el mapa del dashboard público no muestra contornos geográficos reales y depende de tiles externos que no cargan en el servidor sin internet.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Menú del rol Comité (Priority: P1)

Un usuario con rol `COMITE_VALIDACION` necesita acceder directamente a su bandeja de casos escalados, sin ver opciones de usuario final como "Círculo de Confianza" o "Mis reportes", ya que esas rutas están protegidas para el rol `PARENT` y le generan errores 403.

**Why this priority**: El comité ya tiene layout de administración y APIs propias (`/api/admin/comite/*`), pero el header de navegación lo trata como usuario final, bloqueándolo en su flujo principal.

**Independent Test**: Un usuario `COMITE_VALIDACION` inicia sesión, abre el menú de usuario y ve una opción que lo lleva a `/dashboard/admin/comite`; no ve Círculo de Confianza ni Mis reportes. Al intentar acceder a esas URLs manualmente, el backend rechaza la petición con 403.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol `COMITE_VALIDACION`, **When** abre el menú de navegación, **Then** ve una opción "Mi bandeja" que apunta a `/dashboard/admin/comite` y no ve "Círculo de Confianza" ni "Mis reportes".
2. **Given** un usuario `COMITE_VALIDACION`, **When** accede a `/mis-reportes`, **Then** el backend responde 403 porque la ruta requiere rol `PARENT`.
3. **Given** un usuario `COMITE_VALIDACION`, **When** accede a `/dashboard/circulo-confianza`, **Then** el backend responde 403 porque la ruta requiere rol `PARENT`.
4. **Given** usuarios con roles `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR` y `PARENT`, **When** abren el menú, **Then** sus opciones actuales se mantienen sin cambios.

---

### User Story 2 - Editor de grupos de categoría (Priority: P1)

El administrador de la plataforma edita los grupos de categoría que ven los usuarios. Actualmente el editor arranca vacío si el parámetro `ui.grupos_categoria` no está persistido, aunque el servidor ya usa un fallback de 5 grupos. Esto provoca que los cambios en el editor no partan de la configuración real que ven los usuarios.

**Why this priority**: La consistencia entre la configuración del editor y la vista de usuarios es crítica para no publicar categorías incorrectamente agrupadas o sin agrupar.

**Independent Test**: Un admin abre el editor de grupos de categoría con `ui.grupos_categoria` vacío; el editor muestra los 5 grupos fallback con sus categorías asignadas, permite renombrar, mover categorías entre grupos y guarda automáticamente.

**Acceptance Scenarios**:

1. **Given** que el parámetro `ui.grupos_categoria` está vacío, **When** el admin abre el editor, **Then** se muestran los 5 grupos fallback (`Contacto sexual`, `Manipulación o engaño`, `Amenazas o extorsión`, `Contenido falso (IA)`, `Otro`) con sus categorías asignadas.
2. **Given** un grupo con categorías, **When** el admin selecciona una categoría del dropdown "Agregar categoría..." de otro grupo, **Then** la categoría se mueve de un grupo al otro y se guarda automáticamente.
3. **Given** un grupo, **When** el admin edita su nombre, **Then** el cambio se refleja inmediatamente y se guarda automáticamente.
4. **Given** categorías que no están en ningún grupo, **When** el admin las ve en la zona "Sin agrupar", **Then** aparece una advertencia clara de que esas categorías se ocultan a los usuarios.
5. **Given** un grupo con el fallback cargado, **When** el admin elimina el grupo, **Then** las categorías que contenía pasan a la zona "Sin agrupar" con la advertencia visible.

---

### User Story 3 - Mapa real del dashboard público (Priority: P2)

El dashboard público debe mostrar un mapa geográfico con contornos de países, ciudades y la cantidad de reportes por ubicación. El servidor no tiene salida a internet, por lo que los tiles externos no cargan y el mapa actual se muestra sobre un fondo blanco sin referencias geográficas.

**Why this priority**: Los usuarios necesitan contexto geográfico real para interpretar la distribución de reportes; sin contornos, el mapa no cumple su propósito comunicativo.

**Independent Test**: El dashboard público carga un GeoJSON de países empaquetado en la app, colorea cada país según la cantidad de reportes y muestra puntos de ciudad con popup, todo sin requerir conexión a internet en el servidor.

**Acceptance Scenarios**:

1. **Given** que hay reportes asociados a países y ciudades, **When** se carga el dashboard público, **Then** se muestran los contornos de los países y los países con reportes se colorean con la escala rojo/naranja/verde.
2. **Given** un país coloreado, **When** el usuario hace clic en él, **Then** se muestra un popup con el nombre del país y el número de reportes.
3. **Given** una ciudad con coordenadas, **When** el usuario hace clic en el punto, **Then** se muestra un popup con la ciudad, el país y el número de reportes.
4. **Given** que el servidor no tiene acceso a internet, **When** se carga el dashboard, **Then** el mapa sigue funcionando porque los datos geográficos están empaquetados en `public/geo`.

---

### Edge Cases

- ¿Qué ocurre si un rol nuevo no está contemplado en `NavHeader`? El menú lo tratará como usuario final (`PARENT`), por lo que la lista de roles internos debe mantenerse actualizada junto a cualquier nuevo rol administrativo.
- ¿Qué pasa si el parámetro `ui.grupos_categoria` tiene JSON válido pero grupos vacíos? El editor debe aplicar el fallback, no mostrar una lista vacía.
- ¿Qué pasa si el GeoJSON de países no se encuentra? El componente debe degradar graciosamente: mostrar solo los puntos de ciudad o un mensaje de error controlado, sin romper el dashboard.
- ¿Cómo se maneja un país en la BD cuyo nombre no coincide con el GeoJSON? El país no se colorea, pero sigue apareciendo en la lista "Top países" y los puntos de ciudad siguen visibles.
- ¿Qué ocurre si el comité intenta acceder al endpoint de reportes propios del operador? Esas rutas usan su propia autorización y quedan fuera de este spec; el comité no debe confundir su menú con el del operador.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE incluir el rol `COMITE_VALIDACION` en la lista de roles internos del header de navegación (`NavHeader.tsx`).
- **FR-002**: El sistema DEBE mostrar al usuario `COMITE_VALIDACION` una opción de menú que apunte únicamente a `/dashboard/admin/comite`.
- **FR-003**: El sistema DEBE ocultar las opciones "Círculo de Confianza" y "Mis reportes" a los usuarios con roles internos (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`).
- **FR-004**: El sistema DEBE proteger el endpoint `/api/reportes/mis-reportes` para que solo usuarios con rol `PARENT` puedan consumirlo.
- **FR-005**: El sistema DEBE proteger los endpoints `/api/circulo-confianza` (GET y POST) para que solo usuarios con rol `PARENT` puedan consumirlos.
- **FR-006**: El sistema DEBE sembrar el editor de grupos de categoría con `GRUPOS_CATEGORIA_FALLBACK` cuando el parámetro `ui.grupos_categoria` esté vacío o sea inválido.
- **FR-007**: El sistema DEBE representar cada grupo de categoría como una tarjeta con sus categorías en chips separados.
- **FR-008**: El sistema DEBE permitir mover una categoría de un grupo a otro mediante el selector "Agregar categoría..." de cada grupo.
- **FR-009**: El sistema DEBE permitir editar el nombre de cada grupo y persistir el cambio automáticamente.
- **FR-010**: El sistema DEBE mostrar una zona de "Categorías sin agrupar" con una advertencia visible de que esas categorías se ocultan a los usuarios.
- **FR-011**: El sistema DEBE mantener el guardado automático del editor con feedback claro de éxito o error.
- **FR-012**: El sistema DEBE renderizar un mapa geográfico con contornos de países en el dashboard público.
- **FR-013**: El sistema DEBE colorear los países según la cantidad de reportes con escala rojo (mayor), naranja (media) y verde (menor).
- **FR-014**: El sistema DEBE mostrar popup por ubicación con nombre (país/ciudad) y conteo de reportes.
- **FR-015**: El sistema DEBE funcionar sin conexión a internet en el servidor, utilizando datos geográficos empaquetados en la aplicación.

### Key Entities

- **Usuario**: Cuenta con rol `RolUsuario`. Los roles internos relevantes son `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR` y `COMITE_VALIDACION`.
- **ParametroSistema**: Clave `ui.grupos_categoria` (JSON) que persiste la definición de grupos.
- **CategoriaGrupo**: Estructura `{ clave, nombre, orden, categorias: string[] }`. El fallback `GRUPOS_CATEGORIA_FALLBACK` define 5 grupos.
- **GeoJSON de países**: Archivo local `public/geo/world-countries.json` con geometrías y nombres de países.
- **Reporte**: Tiene campos `pais`, `ciudad`, `lat` y `lng` (a través de la relación `Ciudad`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario `COMITE_VALIDACION` puede acceder a `/dashboard/admin/comite` desde el menú sin ver opciones de usuario final.
- **SC-002**: El 100% de intentos de acceso a `/mis-reportes` o `/circulo-confianza` con rol distinto a `PARENT` son bloqueados con 403.
- **SC-003**: El editor de grupos de categoría muestra los 5 grupos fallback cuando el parámetro está vacío, en menos de 1 segundo.
- **SC-004**: El movimiento de una categoría entre grupos se refleja en el UI y se persiste en el parámetro en menos de 2 segundos.
- **SC-005**: El dashboard público muestra contornos de países y colorea al menos el país con más reportes.
- **SC-006**: El mapa carga correctamente con la conexión a internet deshabilitada en el servidor (validado por carga desde `public/geo`).

---

## Assumptions

- El rol `COMITE_VALIDACION` ya existe en el enum `RolUsuario` y tiene acceso al layout de administración.
- Las APIs `/api/admin/comite/*` ya están implementadas y protegidas para el rol comité.
- El fallback `GRUPOS_CATEGORIA_FALLBACK` en `src/lib/categoria-grupos.ts` es la fuente de verdad de los grupos iniciales.
- El dashboard público recibe datos agregados por país y ciudad desde `/api/estadisticas-publicas`.
- El servidor de producción no tiene salida a internet, por lo que cualquier dato geográfico debe ser estático.
- No se requieren cambios en el modelo de datos de Prisma.

---

## Implementación

### Objetivo alcanzado
Se corrigieron las tres vistas/roles identificados en el spec: el menú del rol Comité ya no muestra opciones de usuario final; el editor de grupos de categoría arranca con el fallback del servidor; y el dashboard público muestra un mapa geográfico real con datos locales.

### Decisiones de diseño
- **Rol Comité como interno**: se reutilizó el patrón de `OPERADOR` en `NavHeader.tsx` (estilos distintivos + opción propia) para mantener consistencia y no afectar a `PARENT`.
- **Fallback compartido**: el editor usa exactamente `GRUPOS_CATEGORIA_FALLBACK` definido en `src/lib/categoria-grupos.ts`, garantizando que lo que ve el admin coincida con lo que ven los usuarios cuando no hay parámetro persistido.
- **Mapa offline**: se descargó un GeoJSON de países ligero (~251 KB) y se empaquetó en `public/geo`; el componente lo carga con `fetch` desde el cliente, sin depender de tiles externos ni conexión a internet.
- **Coloreado por cantidad**: se usa una escala simple basada en el máximo de reportes por país (rojo ≥75 %, naranja ≥25 %, verde resto).

### Endpoints y componentes afectados
- `src/components/modules/NavHeader.tsx` (US1)
- `src/app/api/reportes/mis-reportes/route.ts` y `src/app/api/circulo-confianza/route.ts` (US1, verificación de protección existente)
- `src/components/modules/CategoriaGruposEditor.tsx` (US2)
- `src/components/modules/MapaUbicaciones.tsx` (US3)
- `src/components/modules/PublicDashboard.tsx` (US3)
- `public/geo/world-countries.json` (US3)

### Tests
- `npx tsc --noEmit` — OK.
- `npm run lint` — OK (warnings preexistentes no relacionados).
- `npm run test` — 407 tests pasados.
- Pruebas manuales con curl: dashboard público y GeoJSON accesibles; endpoints de usuario final protegidos con 403 para roles no `PARENT`.

### Migraciones relevantes
Ninguna. No se modificó el esquema de Prisma.

### Deuda técnica
- Emparejamiento de nombres de país BD ↔ GeoJSON por normalización de texto; puede mejorarse con códigos ISO.
- GeoJSON podría convertirse a TopoJSON para reducir tamaño si fuera necesario.
- Faltan tests automatizados de componente para `NavHeader`, `CategoriaGruposEditor` y `MapaUbicaciones`.

### Cierre
- Documentación: `docs/cierre-033.md`.
- Deploy limpio: `rm -rf .next && npm run build && ./scripts/dev-restart.sh` (healthcheck OK).
- Commits: uno por User Story + uno de documentación, pusheados a `feature/001-scaffolding`.
