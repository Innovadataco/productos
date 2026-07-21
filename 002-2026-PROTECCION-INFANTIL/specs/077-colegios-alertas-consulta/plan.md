# Plan: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Constitution Check

- **Solo-texto**: todos los artefactos son texto plano.
- **IA local sin terceros**: matching local, anonimizador local.
- **Lenguaje sin veredictos**: las alertas no emiten juicios de culpabilidad.
- **Migraciones aditivas**: nueva tabla `AlertaColegio`; nunca `migrate reset`.
- **Un solo worker**: deploy mantiene un solo worker.
- **Cobertura Vitest**: tests de matching, privacidad, aislamiento y endpoints.

Constitution Check: **PASADO**.

## Technical Context

- **Base**: Fase 3 cerrada con `IdentificadorAlumno` normalizado y asociado a colegios.
- **Matching**: se reutiliza el patrón del Círculo de Confianza (buscar `valor` exacto normalizado en `IdentificadorAlumno`).
- **Anonimización**: no se expone texto crudo; solo categoría y estado del reporte, que no son PII del menor ajeno.
- **Worker**: se integra `notificarColegioSiCorresponde(reporteId)` junto a `notificarCambioCirculoSiCorresponde`.
- **Aviso ciego**: email genérico, sin datos, con cooldown.

## Complexity Tracking

| Nivel | Descripción | Justificación |
|-------|-------------|---------------|
| Complejidad | Alta | Matching, privacidad, worker integration, UI, tests de seguridad. |
| Riesgo | Alto | Exposición de PII si no se filtra correctamente. |
| Dependencias | Alta | Depende de Fase 2 y 3; depende del flujo de reportes. |

## Decisiones de diseño

- Entidad `AlertaColegio` vinculada a `colegioId`, `reporteId` y `identificadorAlumnoId`.
- Matching en el worker tras procesar el reporte (mismo hook que Círculo de Confianza).
- La alerta muestra identificador (ya conocido por el colegio) y categoría/estado (no PII).
- No se permite ver detalle del reporte desde el colegio.
- Estados de alerta: `nueva`, `vista`, `gestionada`.
