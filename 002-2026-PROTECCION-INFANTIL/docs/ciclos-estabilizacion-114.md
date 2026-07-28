# SPEC-114 · Bitácora de ciclos de estabilización

Suite E2E por rol (`src/lib/e2e/`). Cada ciclo: seed con datos NUEVOS → suite completa →
rojos se arreglan (rojo primero, un commit por arreglo) → suite entera en verde → siguiente.
Prueba lenta con motor real: opt-in (`E2E_LENTA=true`), fuera del gate rápido.

## Ciclo 1

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| sesión 5 roles | Logo clic muerto: SPEC-106 dejaba logo=home del rol estando ya EN el home | `NavHeader.tsx`: si el destino es la ruta actual, logo → `/` (f80d7240) | — |
| padre | I-38: el área del padre no tenía camino de interfaz a `/reportar` | `DashboardUsuarioClient.tsx`: enlace "Reportar un riesgo" (9e052874) | — |
| aislamiento | `esDestinoPermitidoPorRol` clasificaba `/dashboard/admin` como ruta de usuario final (startsWith) y contradecía al proxy | `proxy.ts`: mismo orden de evaluación que proxyCore (224eae5a) | — |
| todos | — | suite + journeys: T001–T009 (varios commits, último edbace7e) | — |

- **Aceptación (T011)**: con `SESION_ROUTES` de SPEC-113 revertida (sin `/api/auth/cambiar-password`
  ni `/api/auth/logout`), la suite va en ROJO en 3 tests: colegio (alta/cambio obligatorio y
  cursos/logout) y sesión SCHOOL_ADMIN (logout). Demostrado, no afirmado. Restaurada → verde.
  Nota: el recorrido padre NO se ve afectado por esa reversión porque `/api/auth/*` es ruta
  pública en el proxy para PARENT; la trampa I-35 era exclusiva del colegio.
- Tiempo suite e2e (rápida): ~25 s.
- **Suite completa (965 tests)**: 1 rojo — `specs-discipline` exigía indexar la 114 en
  `specs/README.md`; arreglado (4fdabde3). Re-corrida: 965 verdes, 1 skipped (lenta opt-in).
  Duración: ~3,6 min.

## Ciclo 2

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| todos (datos del ciclo 2) | 0 rojos | — | — |

- Suite completa: 965 verdes, 1 skipped (lenta). Duración: ~3,6 min.

## Ciclo 3

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| todos (datos del ciclo 3) | 0 rojos | — | — |

- Suite completa: 965 verdes, 1 skipped (lenta). Duración: ~3,6 min.

## Ciclo 4

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| todos (datos del ciclo 4) | 0 rojos | — | — |

- Suite completa: 965 verdes, 1 skipped (lenta). Duración: ~3,7 min.

## Ciclo 5

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| suite completa (datos del ciclo 5) | 1 rojo FLAKY: 1 test falló de 965 (17:13, E2E_CICLO=5). **Evidencia perdida**: la captura fue `tail -6` y la salida completa no se guardó — el test, la aserción y el mensaje NO son recuperables. No se sabe qué recorrido fue. | Sin arreglo (no hay diagnóstico posible con cero evidencia) | Test intermitente no identificado, tasa observada ~1/5 corridas. Si reaparece, hay protocolo de captura abajo |

- Re-corrida inmediata: VERDE. Tres corridas más de caza (mismo ciclo 5): VERDE, VERDE, VERDE.
  4 verdes consecutivas tras el rojo; no se reprodujo.
- **Protocolo de captura vigente desde el ciclo 6** (nota ZEUS): toda corrida guarda log
  completo (`/tmp/cicloN.log`). Si el flaky reaparece: capturar ANTES de tocar nada —
  salida completa, estado de la BD en ese momento y recorrido en curso. Con una sola
  aparición no se diagnostica; con dos y evidencia, sí.
- Suite completa (cuando salió verde): 965 verdes, 1 skipped (lenta). Duración: ~3,7 min.

## Ciclo 6

| Recorrido | Rojos y causa | Arreglo (commit) | Deuda para ZEUS |
|---|---|---|---|
| operador-comite · "bandeja y confirma" | 1 rojo FLAKY (2ª aparición): falló en la corrida rápida (`vitest run src/lib/e2e`, 17:35, E2E_CICLO=6) y la suite completa posterior salió verde. **Evidencia**: el test tardó **5142 ms** y `vitest.config.ts` no define `testTimeout` → default 5000 ms. Hipótesis fuerte: timeout del harness bajo contención de CPU (Ollama cargado + bcrypt puro JS), no una aserción rota. El mensaje exacto volvió a no capturarse (salida filtrada por grep) — limitación declarada | Calibración del harness SOLO para los 7 journeys: `describe(..., { timeout: 30_000 })`. **Ninguna aserción tocada** — no es ablandar, es darle al test de integración más pesado del repo el tiempo que el harness default no le da. ZEUS puede vetarlo | Si reaparece CON 30 s de margen, ya no es timeout: capturar mensaje completo + estado de BD antes de tocar |

- Caza dirigida: 20 corridas del journey aislado → 20/20 verde; 20 corridas de la suite e2e
  completa → 20/20 verde. Solo falla en contexto de corrida grande (contención), coherente
  con la hipótesis de timeout.
- Suite completa ciclo 6: 965 verdes, 1 skipped. Duración: ~3,7 min.

