# Spec 020 — Reorganización de módulos + Tablero de monitoreo

> Estado: **CERRADA**.
> Plan: [`plan.md`](plan.md).
> Tareas: [`tasks.md`](tasks.md).

## Alcance

1. Reorganizar el módulo **Operadores** y el módulo **Dashboard** en submódulos claros.
2. Hacer configurable el modelo de asignación de casos desde `ParametroSistema` (sin cambiar el comportamiento por defecto).
3. Construir un **tablero de monitoreo operativo** para la operación de revisión humana.

## Decisiones del owner

- El asignador sigue usando `ponderado_carga_inversa` por defecto, pero se puede cambiar a `aleatorio_puro` desde configuración.
- El cupo máximo por operador puede sobreescribirse en `PerfilOperador`; si no tiene valor, se usa el default configurable.
- El tablero de monitoreo es solo para admin; operadores no lo ven.
- Se reutilizan componentes de gráficos y estilo glassmorphism existentes.

## Requisitos

### Módulo Operadores

- Submódulo **Asignar** (`/dashboard/admin/operadores/asignar`):
  - Estado en vivo: casos sin asignar, operadores activos con carga, distribución actual.
  - Acceso al CRUD de operadores (gestión).
- Submódulo **Modelo de asignación** (`/dashboard/admin/operadores/modelo`):
  - Configurar `operadores.cupo_maximo_default`.
  - Configurar `operadores.estrategia_asignacion` (`ponderado_carga_inversa` | `aleatorio_puro`).
  - Explicación de la lógica derivada del diseño 018.
  - Confirmación + `AuditLog` al guardar.

### Módulo Dashboard

- Submódulo **Operación** (`/dashboard/admin/estadisticas/operacion`): dashboard actual movido.
- Submódulo **Clasificación** (`/dashboard/admin/estadisticas/clasificacion`): tablero de monitoreo nuevo.

### Tablero de monitoreo operativo

- Indicadores: casos sin asignar, en gestión ahora, atendidos hoy, tiempo promedio de gestión, escalados pendientes.
- Gráficas: casos por día, distribución por operador, clasificaciones por categoría, tasa de escalamiento por operador.
- Tabla operativa con filtros (operador, fecha, estado, categoría) y búsqueda.
- Métricas por operador: casos atendidos, tiempo de gestión, clasificaciones, escalados — por rango de fechas.
- Datos reales de `AuditLog` CASO_*, estados y timestamps. Estado vacío elegante si no hay datos.

## Riesgos mitigados

- Cambio de comportamiento del asignador: tests existentes deben seguir verdes; fallback a defaults actuales.
- URLs rotas: redirecciones desde `/dashboard/admin/operadores` y `/dashboard/admin/estadisticas` a sus submódulos por defecto.

## R7

No aplica: no toca el pipeline de clasificación. Solo reorganiza UI/configuración y agrega métricas sobre datos existentes.
