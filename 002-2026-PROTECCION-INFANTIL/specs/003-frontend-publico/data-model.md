# Data Model: Frontend Público y Flujo de Reporte

**Date**: 2026-07-13
**Feature**: specs/003-frontend-publico/spec.md

## Frontend State Entities

### ConsultaFormState
Estado del formulario de consulta en la página de inicio.

| Field | Type | Description |
|-------|------|-------------|
| identificador | string | Número, nick o usuario a consultar |
| plataforma | string | Clave de plataforma seleccionada |
| isLoading | boolean | Indicador de carga |
| error | string \| null | Mensaje de error |
| resultado | ConsultaResultado \| null | Respuesta del backend |

### ReporteWizardState
Estado del wizard de 4 pasos para crear un reporte.

| Field | Type | Description |
|-------|------|-------------|
| step | 1 \| 2 \| 3 \| 4 | Paso actual del wizard |
| plataforma | string | Clave de plataforma seleccionada |
| ciudad | string | Ciudad del incidente |
| pais | string | País del incidente |
| fechaIncidente | string (ISO date) | Fecha del incidente |
| texto | string | Descripción de la conducta (20-5000 chars) |
| esAnonimo | boolean | Modo de reporte |
| confirmacionChecked | boolean | Checkbox de confirmación legal |
| isSubmitting | boolean | Enviando al backend |
| numeroSeguimiento | string \| null | Número asignado tras envío |

### AuthState
Estado de autenticación del usuario.

| Field | Type | Description |
|-------|------|-------------|
| user | { id, email, nombre, rol } \| null | Datos del usuario autenticado |
| isLoading | boolean | Verificando sesión |
| isAuthenticated | boolean | Sesión activa |

## Backend Entities Consumed (read-only from frontend)

### ConsultaResultado
Respuesta de `GET /api/consulta`.

| Field | Type | Description |
|-------|------|-------------|
| identificador | string | Identificador consultado |
| plataforma | string | Nombre de plataforma |
| tieneReportes | boolean | Si supera umbral |
| totalReportes | number | Conteo total |
| reportesAutenticados | number | Conteo autenticados |
| reportesAnonimos | number | Conteo anónimos |
| ultimoReporte | string (ISO) \| null | Fecha del último reporte |
| distribucion | { porCiudad, porPais, porMes } | Estadísticas agregadas |

### MisReporteItem
Elemento de la lista del panel "Mis reportes". **NO incluye textoOriginal ni PII**.

| Field | Type | Description |
|-------|------|-------------|
| id | string | ID del reporte |
| identificador | string | Número/nick reportado |
| plataforma | string | Nombre de plataforma |
| estado | EstadoReporte | Estado técnico |
| estadoVisual | string | Texto amigable para UI |
| creadoEn | string (ISO) | Fecha de creación |
| esAnonimo | boolean | Si fue reporte anónimo |

### SeguimientoResultado
Respuesta de `GET /api/reportes/seguimiento/[numero]`.

| Field | Type | Description |
|-------|------|-------------|
| numeroSeguimiento | string | Número consultado |
| estado | EstadoReporte | Estado técnico |
| mensaje | string | Descripción amigable del estado |
| creadoEn | string (ISO) | Fecha de creación |

## State Transitions

### Reporte Wizard
```
PASO 1 (plataforma) → PASO 2 (ubicación/fecha) → PASO 3 (descripción) → PASO 4 (revisar/confirmar) → ENVIADO → CONFIRMACIÓN
```

Validaciones por paso:
- Paso 1: plataforma no vacía
- Paso 2: ciudad, país, fechaIncidente válidos
- Paso 3: texto entre 20-5000 caracteres
- Paso 4: confirmacionChecked === true

### Auth
```
NO_AUTH → REGISTRO → VERIFICACIÓN → LOGIN → AUTENTICADO → LOGOUT → NO_AUTH
```

## New Backend Endpoint Required

### GET /api/reportes/mis-reportes
Lista los reportes del usuario autenticado. No expone textoOriginal ni PII de terceros.

**Query params**: `page`, `pageSize` (paginación estándar)
**Response**: `{ items: MisReporteItem[], pagination: PaginationMeta }`