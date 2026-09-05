# SPEC-488 · Identidad de rol interno unificada en ámbar (mata el violet) + toggle

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: ruling de Diseño §3.1/§3.2. Lote afinado color/forma.

## El arreglo
Ruling: el color NO codifica el rol (§3.1 color=función). Los roles internos de IDC (ADMIN, OPERADOR, COMITE_VALIDACION) comparten el acento **ámbar** del territorio; se distinguen por **nombre + inicial** (el badge rinde `user.rol`, el avatar las iniciales). En `NavHeader.tsx` los 3 ternarios de color de rol se colapsaron a `esRolInternoIdc ? ámbar : default`: **mata las 3 líneas `violet-`** del OPERADOR (incl. la direccional `border-b-violet`) y **corrige el comité pino→ámbar**. PROFESIONAL (externo) y el resto caen al default. El toggle de tema ya estaba en `.text-muted` (lo migró SPEC-485) → sin cambio.

## Candado — `src/components/modules/rol-interno-ambar.candado.test.ts`
- **0 `violet-` en todo src** (mata la clase; muere por mutación — verificado reintroduciendo `bg-violet-500`).
- El badge de NavHeader rinde el NOMBRE del rol (`user.rol`), no solo color.

## Impacto en arquitectura:
- Elimina el hue-por-rol del chrome: un solo acento interno (ámbar), distinción por texto. Conducta intacta (los roles navegan igual). Sin cambios de rutas/guardias.

## Referencias
SPEC-485 (chrome; dejó el violet flagueado) · SPEC-460 (accent por territorio). Rama `work/pi-SPEC-488-lote-afinado` desde `origin/main 94c0e8c8c`.
