# Data Model — SPEC-106

**Date**: 2026-07-27 · Sin cambios de schema (la sesión vive en una cookie httpOnly).

## Cookie de sesión

| Nombre | Esquema | Atributos de creación (= los del borrado tras el fix) |
|--------|---------|-------------------------------------------------------|
| `__Host-token` | Seguro (HTTPS) | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=86400` (creación) / `Max-Age=0` (borrado) |
| `token` (legacy) | No seguro (HTTP dev) | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=86400` (creación) / `Max-Age=0` (borrado) |

Regla `__Host-`: `Secure` + `Path=/` + sin `Domain` — sin `Secure` el navegador rechaza el
Set-Cookie completo (origen del bug).

## Ruta (para el logo)

| Contexto | Destino del logo |
|----------|------------------|
| `pathname` bajo `/dashboard/**` | Home del rol autenticado (SPEC-100, intacto) |
| Cualquier otra ruta (pública) | `/` (home público), con o sin sesión |
