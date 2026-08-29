# Research — SPEC-113

**Date**: 2026-07-28

## Causa raíz verificada en fuente (reportada, no re-investigada)

- `src/lib/proxy.ts:38`: `SESION_ROUTES = ["/api/me", "/cambiar-password"]` — cubre la
  PANTALLA, no su endpoint. `esRutaPermitidaSchoolAdmin` (:46) permite solo rutas de
  colegio + SESION_ROUTES; todo lo demás bajo `/api/` → 403 "Permisos insuficientes".
- La página `src/app/cambiar-password/page.tsx:41` hace `fetch("/api/auth/cambiar-password")`
  → SCHOOL_ADMIN recibe 403 al enviar el formulario. El comentario del propio proxy
  (:41-44) advertía el bucle (C-9) pero solo contempló la página.
- **I-35b (mismo callejón)**: `/api/auth/logout` tampoco está en SESION_ROUTES ni en rutas
  de colegio → SCHOOL_ADMIN recibe 403 al cerrar sesión, la cookie sobrevive y la pantalla
  no suelta al usuario.

## Revisión de otros roles (FR-005, ejecutada)

- **PARENT**: no tiene rama restrictiva en el proxy (cae al `NextResponse.next()` por
  defecto) → alcanza `/api/auth/cambiar-password` y `/api/auth/logout` sin bloqueo.
- **ADMIN / OPERADOR / COMITE_VALIDACION** (`esRolInterno`): las rutas internas
  (`/dashboard/admin`, `/api/admin`) se verifican aparte; los endpoints de sesión no son
  internos y caen al default permitido → sin bloqueo.
- **Conclusión**: el callejón es EXCLUSIVO de SCHOOL_ADMIN (única rama que niega por
  defecto bajo `/api/`). Los fixes se limitan a esa rama.

## Decisiones

- **Decisión: ampliar `SESION_ROUTES` con `/api/auth/cambiar-password` y `/api/auth/logout`**.
  Mínimo cambio que cierra el hueco sin tocar el aislamiento del colegio.
- **Decisión: test rojo→verde obligatorio** (I-35): primero se ejecuta contra el proxy
  actual y se registra el 403; luego el fix lo pone verde. Sin rojo previo, el test no
  prueba nada (mismo criterio que la guarda de la migración del 109).
- **Decisión: el menú consume el criterio del proxy exportado como helper** (una sola
  fuente; el proxy lo sigue usando). No se crea una segunda fuente de permisos.
- **Decisión: logout robusto en UI**: la navegación al inicio no depende del resultado de
  la API (defensa adicional a abrir el endpoint).

## Referencias

- SPEC-100 (C-9): enforcement central de `debeCambiarPassword` — ahí nació la página; la
  API quedó olvidada.
- SPEC-106: borrado simétrico de la cookie de sesión (I-32) — relacionado con I-35b.
