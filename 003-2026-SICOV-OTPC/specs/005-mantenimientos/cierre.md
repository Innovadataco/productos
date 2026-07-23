# Cierre — 005-mantenimientos (005-A + 005-B)

**Fecha:** 2026-07-23 · **Estado:** IMPLEMENTADO y probado en vivo (modo stub) · **Pendiente:**
ACTA-VALIDACIÓN de ZEUS; verificación humana antes de consumir APIs productivas.

## Qué se construyó

**005-A (encargo 003-SICOV-002):** datos (6 tablas aditivas, ids externos en columnas separadas —
gate B1), integración (cabeceras propias de mantenimientos, stub/http), guard de módulos D-017 en
cada endpoint de operación (corrige I-09), envío inmediato con caída a cola en las TRES colas
(D-021) con reintentos/backoff por env (D-019b), registro individual (roles 1,3 — §10.2), carga
masiva XLSX/CSV todo-o-nada (§10.10) con plantilla oficial, cola en el worker único (tercera
pasada, mismo advisory lock) y jobs con alcance D-015 server-side + corregir-y-reenviar (§10.6).
Además: artefactos faltantes de la spec 002 (I-11).

**005-B (encargo 003-SICOV-003):** interfaz de almacenamiento (`ALMACENAMIENTO_DIR` fuera de la
app — D-022 #2), PDF del programa (cliente rol 2; solo PDF ≤4MB; **el último cargado queda ACTIVO
y desactiva los anteriores**), rutas archivos-programas con guard, y pantalla
`/dashboard/mantenimientos` (tabs, cards por rol, modales de registro/historial/resumen/corrección,
descarga de errores `.txt`, tabla de sincronización) heredando el breadcrumb del layout (I-14).

## Commits

005-A: `cf6bc6c5` `bbaf0d20` `0c183040`(US5) `22284e90`(US4) `69b57bb4`(US1) `971bd08c`(US2)
`df6c308e`(US3) `1a942187`(spec002) `7ea85eee`(smoke) `29d3b121`(cierre A).
005-B: `b20a3ddb`(regla staging) `56b190ef`(tasks) `16b08303`(US6a) `43c4b8b9`(US6b) + este cierre.

## Pruebas

- **127/127 tests** (52 heredados + 75 de 005 y hotfixes) · `tsc --noEmit` · `lint` · `build` limpios.
- **Smoke E2E en vivo (stub):** registro inmediato con id externo; caída a cola (FAL999); CSV
  todo-o-nada con "Fila N"; worker 3 pasadas (cabeceras verificadas: base sin `vigiladoId`,
  detalle con él); corregir-y-reenviar resetea a 0; alcance D-015 (nit ajeno ignorado); 403 rol 2.
- **Navegador (Chromium, contextos privados):** 005-A 8/8 · 005-B 10/10 — incluye PDF v2 ACTIVO
  con v1 Inactivo (UI + API), .txt→400, descarga application/pdf, cards por rol §10.2, responsable
  rotulado por operación, registro individual E2E desde el modal.

## Deuda técnica

- Contrato real del API de mantenimientos (`URL_MATENIMIENTOS`) pendiente de credenciales (stub).
- Filtros legacy sin datos (`vin`, `proveedor`, `sincronizacionEstado`) aceptados e ignorados.
- Filtro placa/término de jobs en memoria (tope 2000, documentado en cola.ts).
- Estados de placa: hoy los entrega el stub de `listar-placas`; el umbral "próximo a vencer" con
  datos reales se valida contra la Super en modo real.
- Carga masiva TXT (R-03) y para las otras 4 operaciones (R-04): fuera por prioridad del CEO (§11.5).
- Respaldo de `ALMACENAMIENTO_DIR`: incluirlo en el runbook del switch-over (junto al pg_dump).
- `environmentMatchGlobs` está deprecado en vitest 3 (funciona; migrar a `test.projects` cuando se
  toque la config).

## Operación

Deploy limpio verificado: `rm -rf .next && npm run build` + dev en :5010 + worker único
(`npm run worker`, advisory lock 30032026). BD 003 en :5434 intacta; migraciones solo CREATE.
