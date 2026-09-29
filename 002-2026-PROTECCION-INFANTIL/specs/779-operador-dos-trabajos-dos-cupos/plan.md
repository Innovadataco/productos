# SPEC-779 · Plan

## Enfoque

El defecto vive en `main` (SPEC-750): el asignador de citas reusa el cupo/conteo de CASOS para las SESIONES. Se parte en dos libros con dos topes, se hace el peso negativo imposible por estructura, y se muestran las dos cargas al admin. Sin cambio de esquema (el cupo de sesiones es parámetro).

## Capas / orden

1. **Motor (piezas 1 y 2):**
   - `plazo`/repo: `contarSesionesVigentesDeOperador` (corte por fecha) en `SolicitudCitaRepository`.
   - `asignador.ts`: `OperadorCandidato` genérico (`cupo`/`cargaActual`); `seleccionarOperador` filtra por cupo adentro y devuelve `null`; `obtenerConfigAsignacion` expone `cupoSesionesDefault`.
   - `asignador-citas.ts`: usa el cupo de sesiones + el conteo vigente; maneja el `null` (sube al admin).
   - Parámetro `operadores.cupo_sesiones_default` sembrado en el arnés de test.
2. **Pantalla (pieza 3):**
   - `operador-metricas` (detalle) y `operadores.listar` (lista) computan sesiones con la MISMA fuente que el asignador.
   - `CargaDosTrabajos` + `chipAlTope` (componente reusable, FORMA-SPEC779).
   - Detalle: reemplaza `OperadorDetalleClient.tsx:104-105`. Lista: reemplaza las columnas Cupo/Casos por una columna Carga.

## Candados

- Estructural (RED-first probado), integración con dato real, render de la forma.

## Dependencias

- Ninguna de esquema. Cert de Diseño de la pantalla (vía CEO) antes de cerrar.

## Riesgos

- El renombre de `OperadorCandidato` toca el camino de CASOS: se preserva conducta (test verde) y se actualiza el único test que leía el campo viejo (hallazgo esperado).
