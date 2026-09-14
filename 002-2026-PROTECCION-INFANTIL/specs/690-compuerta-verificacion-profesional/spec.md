# SPEC-690 (I-414) · La compuerta de verificación del profesional

**Status**: DESARROLLO
**Rama:** `work/pi-SPEC-690-a-fuente-unica-habilitado` (A) · `work/pi-SPEC-690-b-*` (B) · **Autor:** Dev 1 · **Radicado:** `RADICADO-SPEC-690-2026-09-13.md`
**Severidad:** 🔴 seguridad. **Autoridad de forma:** Diseño (mockup aprobado por Jelkin) — esta spec es el BORDE, no la pantalla.

**Impacto en arquitectura:** introduce una FUENTE ÚNICA de habilitación (`estaHabilitado`, `vigencia.ts`) que el directorio, `/api/me` y las rutas del profesional consultan — sin repetir la condición. Sin migración ni enum nuevo (usa `PerfilProfesional.estado` + verificaciones existentes). La habilitación se computa EN EL SERVIDOR, contra la base, en cada petición — nunca desde la cookie.

## El invariante
> **La capacidad del profesional se deriva de `PerfilProfesional.estado` (+ vigencia) y se aplica en el BORDE (la API).** Lo que la interfaz esconde no protege.

`rol: PROFESIONAL` se asigna al registrar y **persiste en los seis estados** — por eso `verifyAuth("PROFESIONAL")` pasa siempre y el gate de estado no existía en ninguna ruta operativa. El caso que define el diseño es el **SUSPENDIDO** (sus citas y pases ya existen): «¿está habilitado AHORA?», no «¿se verificó alguna vez?».

## Matriz estado × capacidad — APROBADA (CEO, radicado a82582e)
| Capacidad | BORRADOR / EN_REVISION | ACTIVO (+vigencia) | RECHAZADO / VENCIDO / SUSPENDIDO |
|---|---|---|---|
| Leer/gestionar registro (perfil, documentos, autorización, verificación) | ✓ (EN_REVISION: solo lectura) | ✓ | VENCIDO/RECHAZADO: editar + re-enviar (lleva a EN_REVISION, que no habilita) · SUSPENDIDO: solo lectura, sin salida por autoservicio |
| Operativo — leer Y escribir: panel · franjas · solicitudes (confirmar/rechazar) · **canjar** | ✗ 403 | ✓ | ✗ 403 |

- **Nada operativo —ni leer ni escribir, `canjar` incluido— fuera de `habilitado`.** Ni «leer lo propio» en terminales ni «API vacía» en previos: 403.
- La compuerta vive en el servidor, contra la base, en cada petición. Un SUSPENDIDO con sesión válida recibe 403 en la llamada siguiente (nunca una marca en la cookie).
- Una compuerta que solo vive en el cliente falla ABIERTA: la pantalla no llama **y** la API rechaza.
- `perfil` y `autorizacion` entran a la spec (no quedan como lista de exentos a mano en el candado).

## El reparto en dos PRs (B no se apila sobre A)
- **690-A** (esta rama, chico): `estaHabilitado` como fuente única (el directorio delega en ella) + `/api/me` expone `profesional:{estado,habilitado}` (contrato con Dev 2 / SPEC-691), computado en el servidor cada petición. Sin cambio de conducta visible.
- **690-B** (sale de main cuando A entre): la compuerta en las rutas + el barrido de páginas del profesional cuyo componente de servidor lea por el DAL directo + el candado.

## El candado (690-B)
De conducta, **derivado del árbol de rutas**, con **control positivo por remoción del discriminador**: mismo escenario con perfil `ACTIVO` → pasa; con `SUSPENDIDO` → falla. Prueba que rechaza por el ESTADO, no de rebote por otra guardia. Un candado que enumere las rutas de hoy deja pasar la de mañana.

## Fuera de alcance
- La forma de la pantalla (Diseño, mockup aprobado).
- Que un ACTIVO reemplace por `upsert` el documento verificado → **I-416** (ficha aparte).
