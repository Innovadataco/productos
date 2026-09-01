# Contract · POST /api/auth/registro-colegio/solicitar

**Purpose**: comienza el registro del colegio por enlace. Anti-enumeración
por correo **Y** NIT (matiz CEO 03:18, patrón SPEC-338 extendido).

## Request

```
POST /api/auth/registro-colegio/solicitar
Content-Type: application/json

{
  "email": "rectoria@sagradocorazon.edu.co",
  "nombreColegio": "Colegio Sagrado Corazón",
  "nit": "901.455.302-7"
}
```

## Response (siempre 202)

```json
{ "ok": true, "mensaje": "Si los datos son correctos te enviaremos un enlace a tu correo." }
```

La respuesta HTTP y el cuerpo son **idénticos** en las cuatro combinaciones:

| Correo | NIT | Correo enviado |
|---|---|---|
| nuevo | nuevo | `colegio.registro_enlace` (con enlace) |
| existe | nuevo | `colegio.registro_enlace.cuenta_existente` al correo dueño |
| nuevo | existe | `colegio.registro_enlace.nit_ya_registrado` al correo del colegio dueño del NIT |
| existe | existe | `colegio.registro_enlace.cuenta_existente` |

Anti-enumeración: la pantalla del rector **NUNCA** revela cuál de las tres
condiciones "existe" se cumplió.

## Rate limits

- Por IP: reusa `pagos.rate.registro.ip` (existente).
- Por email: reusa `pagos.rate.registro.email` (existente).
- Máx 3 links vivos por email en 1 hora (mismo `RegistroEnlaceService`).

## Errores

- 400 `datos_invalidos` — formato/tamaño de campos. Los mensajes nombran el
  campo faltante (candado UX brief).
- 429 `demasiadas_solicitudes` — igual patrón del padre.

## Handshake con el motor de notificaciones

Emite (via `programar`) uno de estos eventos:
- `colegio.registro_enlace` — con variables `{urlEnlace, expiraEn,
  nombreColegio}`. Plantilla nueva.
- `colegio.registro_enlace.cuenta_existente` — variables
  `{nombreColegio, urlRecuperarClave}`.
- `colegio.registro_enlace.nit_ya_registrado` — variables `{nit,
  urlSoporte}`.

Los 3 eventos + sus plantillas se siembran en `prisma/seed.ts` con `rol:
"SCHOOL_ADMIN"` y `obligatoria: true`.
