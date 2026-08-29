# Cierre — SPEC-113: El colegio atrapado (I-35/I-35b) y menú por rol (I-36)

**Fecha**: 2026-07-28 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA, **SIN DESPLEGAR** (lote del CEO).

## Lo hecho

- **I-35 (🔴, bloqueaba el piloto)**: `SESION_ROUTES` del proxy ahora incluye
  `/api/auth/cambiar-password` (y `/api/auth/logout` para I-35b). El comentario C-9 quedó
  actualizado (página Y endpoints).
- **I-35b**: `/api/auth/logout` también entra a `SESION_ROUTES` (el colegio recibía 403 al
  cerrar sesión y la cookie sobrevivía), y `AuthContext.logout()` ya no lanza si la API
  falla: la sesión local se limpia y la UI navega al inicio público igual (la salida no
  depende del resultado de la API).
- **I-36 (🟡)**: el menú del header filtra por rol consumiendo `esDestinoPermitidoPorRol`,
  helper EXPORTADO de `src/lib/proxy.ts` con las MISMAS reglas del proxyCore (usuario final
  = PARENT/anónimo; colegio = colegio+sesión; internos = sin usuario final ni /reportar).
  Sin segunda fuente de verdad. SCHOOL_ADMIN ya no ve "Círculo de Confianza" ni
  "Mis reportes"; PARENT las conserva.

## Pruebas (rojo registrado primero, como se pidió)

- **ROJO antes del fix** (`proxy-sesion-roles.test.ts` contra el proxy sin corregir):
  exactamente 3 fallos, todos SCHOOL_ADMIN — `/api/auth/cambiar-password` (403),
  `/api/auth/logout` (403) y el POST end-to-end del alta obligatoria (403).
  **FR-005 quedó probado empíricamente en esa misma corrida: PARENT, ADMIN, OPERADOR y
  COMITE_VALIDACION pasaban los 2 endpoints** — el callejón era exclusivo de SCHOOL_ADMIN.
- **VERDE tras el fix**: 11/11 — cada rol autenticado llega a ambos endpoints (no es solo
  probar que el endpoint responde: cada rol ALCANZA la respuesta), y el POST de
  SCHOOL_ADMIN con `debeCambiarPassword=true` responde 200 con la contraseña nueva
  verificada en hash y la bandera limpiada.
- `proxy.test.ts`: las dos rutas nuevas cubiertas; `NavHeader.test.tsx`: SCHOOL_ADMIN sin
  entradas de padres y PARENT con las suyas.

## Gate

tsc ✅ · lint ✅ (0 errores) · **940/940 tests** ✅ (14 nuevos) · build ✅ · CI GitHub a
la vista en el push.

## Deuda / notas

- El logout de la cookie sigue siendo el borrado simétrico de la SPEC-106; esta spec solo
  destraba al rol que no llegaba al endpoint.
