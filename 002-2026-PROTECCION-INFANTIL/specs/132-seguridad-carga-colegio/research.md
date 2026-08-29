# Research: SPEC-132 — Seguridad de la carga masiva del colegio

**Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

## Estado real en fuente (verificado 2026-08-01)

| Punto | Hoy | Riesgo |
|---|---|---|
| Parser XLSX | `import * as XLSX from "xlsx"` (SheetJS community) | CVEs conocidos en la cadena (prototype pollution, DoS por archivos maliciosos) |
| Límites | Ninguno (tamaño ni filas) | Un archivo enorme puede tumbar el request |
| Token de confirmación | JWT HS256 con `{ filas: [...roster completo...], colegioId }` | Payload legible por cualquiera: nombres de menores en claro en el token |
| Flujo | `validar` firma el roster → `confirmar` lo lee del token e importa | La PII viaja en el token (S-4) |
| Aislamiento | La confirmación verifica `colegioId` del usuario vs token | Se conserva ligando la sesión al colegio |

## S-3 — ExcelJS vs xlsx (fidelidad)

El parser usa `XLSX.read` + `sheet_to_json(header: 1, defval: "", blankrows: false,
raw: true)`: matriz cruda de la primera hoja. ExcelJS (`Workbook.xlsx.load`) entrega la
misma matriz por fila; los puntos de equivalencia a verificar contra los fixtures
intactos de `parser.test.ts`: fechas (Date → string igual que hoy), celdas vacías
(`defval: ""`), tildes/encoding, columnas en cualquier orden y filas con error. La suite
de fixtures es la red de fidelidad: NO se cambian sus expectativas.

Límites propuestos: `carga.max_archivo_bytes` (default 5 MB) y `carga.max_filas`
(default 2000) como parámetros de sistema (patrón ADR_004), rechazo claro previo al
parseo de filas.

## S-4 — Opciones de store del roster

| Opción | Veredicto | Motivo |
|---|---|---|
| Tabla `CargaRosterSesion` (BD, TTL) | **Elegida** | Sobrevive reinicios, auditable, limpieza simple por `expiraEn`; migración aditiva prevista por el candado |
| Caché en memoria (Map con TTL) | Descartada | Se pierde con reinicios (dev-restart frecuente) y no escala a más de un proceso |
| Cifrar el roster DENTRO del JWT | Descartada | Mantiene el dato innecesariamente en tránsito (defensa en profundidad: que directamente NO viaje) |

El token pasa a `{ sesionId, colegioId }` (15 min, como hoy). La confirmación carga la
sesión por id y aplica las guardas: existe, no vencida, mismo `colegioId`.

## Riesgos y mitigaciones

- **Deriva de fidelidad del parser**: los fixtures intactos son la red (SC-001); se
  corre la suite completa del flujo de carga.
- **Sesiones huérfanas**: TTL + limpieza en el worker (patrón apelacion-mantenimiento).
- **Dependencia nueva**: exceljs se justifica como reemplazo de una librería vulnerable;
  `xlsx` sale del bundle (verificable en package.json y en el build).
