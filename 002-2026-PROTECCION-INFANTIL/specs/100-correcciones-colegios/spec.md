# Feature Specification: Correcciones módulo Colegios (+ Comité)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Status**: FINALIZADO (pendiente ACTA)

## Contexto

Cola nocturna 002-PI-014, Fase 1. Correcciones de UX/funcionalidad del módulo de colegios
y del comité de validación, detectadas en pruebas del CEO.

## User Stories / Requisitos

### Colegios — formulario /dashboard/admin/colegios/nuevo

- **FR-C1**: Ubicación en cascada País→Departamento→Ciudad (modelos `Pais`/`Departamento`/
  `Ciudad` ya existen; en Colombia hay ciudades homónimas → la cascada las desambigúa).
- **FR-C2**: "Tipo de período": mensual/semestral/anual → la fecha fin se calcula (inicio
  +1 mes/+6 meses/+1 año) y los campos de fecha fin se OCULTAN; "libre" → inicio/fin manuales.
- **FR-C3**: Validar fin > inicio y el calendario de "fin" deshabilita fechas ≤ inicio.

### Colegios — cursos/alumnos

- **FR-C6**: "Nuevo curso": grado = desplegable 1 a 11 (no texto libre).
- **FR-C4**: "Agregar identificador": QUITAR el campo "Tipo".
- **FR-C5**: "Plataforma" = desplegable del catálogo `Plataforma` (no texto libre).

### Colegios — panel /dashboard/colegio

- **FR-I25** (🔴): el panel muestra el header PÚBLICO ("Iniciar sesión") con sesión de colegio
  activa → no reconoce la sesión y el usuario queda atrapado. Header del panel que detecte la
  sesión del colegio, monte `ColegioLogoutButton` y la navegación del panel.
- **FR-C9**: primer ingreso del colegio DEBE forzar cambio de contraseña (igual que comité):
  enforcement central para cualquier rol con `debeCambiarPassword=true`.
- **FR-C7**: botón "elaborar/iniciar sección" inhabilitado → revisar causa y habilitar.
- **FR-C8**: logo "Protección Infantil" enlaza al inicio/dashboard.

### Comité (UX)

- **FR-COM1/2**: dejar explícito que los integrantes son SOLO datos (roster, sin login; el
  email es de contacto). Separar/rotular "Cuenta de acceso del comité" (clave temporal
  generada por el sistema) vs "Integrantes".

## Success Criteria

- **SC-001**: Los 11 puntos verificados en la app levantada (dev).
- **SC-002**: Gate verde (lint + test + tsc + build); tests nuevos para la lógica tocada
  (período calculado, validación fin>inicio, enforcement cambio de contraseña).
- **SC-003**: Sin regresiones en los flujos de colegio/comité existentes.
