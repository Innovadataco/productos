# Implementation Plan: SPEC-340 · Mis reportes y el expediente · el hilo

**Branch**: `work/pi-SPEC-340-mis-reportes-expediente` | **Date**: 01-09-2026 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/340-mis-reportes-expediente/spec.md`

## Summary

El flujo del padre se vuelve **un solo hilo**: reporta (con día y hora) → ve su cadena en una tarjeta → agrega eventos sin repetir datos → entiende el análisis → cuando ÉL decide, arma el expediente → genera informes con sello para siempre. Dos derogaciones de fondo (el expediente automático y el auto-cierre) y una resurrección (la verificación pública de SPEC-234).

**Enfoque en una línea**: presentar y conectar lo que ya existe (cadena, blindaje de ajenos, PDF, verificación, mapa, escudo), derogar limpio lo que la mesa mató, y construir solo tres piezas de verdad nuevas: el step-up del texto, la capa 1 determinista y el historial inmutable de informes.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Node.js ≥ 22 · **Framework**: Next.js 16 App Router + React 19 · **Storage**: PostgreSQL 16 + Prisma (migraciones aditivas) · **Testing**: Vitest + Playwright · **UI**: Tailwind con tokens (pino/cielo/ambar/papel/tinta — tokens:check no sube del piso) · **Target**: móvil primero (390 px, mockup aprobado)

**Constraints**:
- La transacción del alta de reportes es el código más caliente del producto y se reescribe (derogación del expediente automático) — pruebas de toda la cadena (candado 24).
- El umbral de contraseña del step-up se valida en SERVIDOR; el reloj de re-tapado es del cliente (A-5).
- «Informes generados» inmutable de verdad: sin endpoint de borrado/edición, y el modelo sin campos editables.
- Ratchets vigentes: no-redirect-en-layouts, eventos de correo sembrados, worker sin alias `@/lib`, invariante cruzada de guardianes, tokens de color.
- Cero migración para la hora del incidente (`fechaIncidente` ya es `DateTime`).

**Scale/Scope**: 1 rol (padre) · 2 pantallas rehechas (Mis reportes, expediente) + 1 formulario ajustado · 3 migraciones aditivas · ~6 rutas de datos nuevas o cambiadas.

## Constitution Check

| Principio | Cómo aplica | Estado |
|---|---|---|
| §1.2 Solo texto | Sin carga de archivos nueva. El PDF es salida, no entrada. | ✅ |
| §1.3 Presunción de inocencia | Capa 1 descriptiva, jamás acusatoria (FR-018); sin «peligroso», sin veredictos. | ✅ |
| §1.5 Sin scoring de personas | El historial del padre NO reusa `InformeConsolidado` justamente porque arrastra `scoreValor` — el brief prohíbe puntajes al padre (ver research R-2). | ✅ |
| §1.6 Disputas | El expediente muestra «lo que queda» tras una disputa sin romperse (edge case). | ✅ |
| §2.1 Stack | Sin dependencias nuevas: pdfmake, Leaflet y pg-boss ya están. | ✅ |
| §3.4/3.5 Errores y auditoría | Códigos canónicos; generación de informe → AuditLog sin PII en claro. | ✅ |
| No modificar el texto original del reporte | El step-up tapa en PRESENTACIÓN; nunca toca el texto almacenado. | ✅ |

**Gate: PASA.** Complexity Tracking vacío.

## Project Structure

```text
specs/340-mis-reportes-expediente/
├── plan.md · research.md · data-model.md · quickstart.md · contracts/ · checklists/ · tasks.md (después)

prisma/
├── schema.prisma          # InformePadre (nuevo) · Expediente.origenCreacion · parámetros step-up
├── migrations/            # 2 aditivas + 1 de parámetro (apagar auto-cierre)
└── seed.ts                # explicaciones por categoría · parámetros step-up

src/
├── app/api/reportes/route.ts                      # DEROGAR expediente automático (transacción)
├── app/api/reportes/[id]/evento/route.ts          # NUEVO: agregar evento con campos heredados
├── app/api/padre/expedientes/route.ts             # POST crear expediente por botón
├── app/api/padre/expedientes/[id]/pdf/route.ts    # + hash + registro InformePadre + pie con fecha/código
├── app/api/padre/reportes/cadenas/route.ts        # NUEVO: tarjetas por cadena
├── app/api/padre/step-up/route.ts                 # NUEVO: revalidar contraseña (paso servidor)
├── app/api/publico/verificar-pdf/[hash]/route.ts  # + buscar también en InformePadre
├── lib/expediente/lectura-capa1.ts                # NUEVO: reglas deterministas (puras, testeables)
├── lib/expediente/motor/tareas-motor.ts           # auto-cierre derogado (código muerto documentado)
├── lib/dal/services/informes-padre.ts             # NUEVO: historial inmutable
├── components/modules/padre/
│   ├── MisReportesCadenas.tsx                     # NUEVO: tarjeta por cadena + acordeón
│   ├── AgregarEvento.tsx                          # NUEVO: campos fijos + texto + fecha/hora
│   ├── VerAnalisis.tsx                            # NUEVO: explicación por categoría
│   ├── TextoSensible.tsx                          # NUEVO: tapado + revelar + relojes
│   ├── ExpedienteVivo.tsx                         # NUEVO: mapa+simulación · timeline · informes
│   └── (reusa MapaUbicaciones, Guardian)
└── components/modules/ReporteWizard.tsx           # − letrero · + hora
    components/modules/SeguimientoClient.tsx       # − CTA re-reporte

tests/e2e/mis-reportes-expediente.spec.ts          # el hilo completo a 390px
```

**Structure Decision**: la lectura capa 1 (`lectura-capa1.ts`) es un módulo **puro** — recibe la cadena como datos y devuelve cifras — para que las reglas se prueben sin base de datos y SPEC-341 la reuse como entrada del modelo (la regla de Jelkin: los HECHOS son de reglas; la IA solo interpreta lo ya calculado).

## Orden de implementación

1. **Derogaciones primero** (riesgo más alto, diff más caliente): expediente automático fuera de la transacción + auto-cierre apagado + CTA y letrero fuera. Con las pruebas de TODA la cadena en verde antes de construir nada encima.
2. **Fundaciones**: migraciones (`InformePadre`, `origenCreacion`, parámetros), seed de explicaciones y step-up.
3. **El hilo de datos**: cadenas para tarjetas · agregar-evento con herencia · crear-expediente por botón.
4. **Step-up del texto** (servidor primero, luego `TextoSensible`).
5. **Capa 1** (módulo puro + panel).
6. **El expediente vivo**: mapa+simulación, timeline, PDF con fecha/sello, historial, verificación revivida.
7. **El escudo** (señal conectada).
8. **Cierre**: E2E, arquitectura, puerta de calidad, quickstart.

## Complexity Tracking

Sin violaciones que justificar.
