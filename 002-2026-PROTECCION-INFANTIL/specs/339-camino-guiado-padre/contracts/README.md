# Contratos · SPEC-339 · El camino guiado del padre

Rutas nuevas y rutas existentes que cambian. Todas usan los códigos canónicos de `AppError` y ninguna devuelve trazas al cliente.

---

## Nuevas · la puerta

### `POST /api/auth/registro/solicitar` *(pública)*

Pide el enlace de registro.

**Entrada**: `{ "email": string }`

**Respuesta `202`** — **idéntica exista o no el correo** (anti-enumeración, SPEC-338):

```json
{ "message": "Si el correo es válido, te enviamos un enlace para crear tu contraseña." }
```

**Comportamiento**:

- Correo sin cuenta → se crea un `TokenRegistro` y se envía `auth.registro_enlace`.
- Correo con cuenta → **no** se crea token; se envía el aviso «ya tienes una cuenta» que ya existe.
- Fallo del proveedor de correo → se registra en el log, la respuesta no cambia.

**Errores**: `400` correo inválido · `429` límite de solicitudes (reutiliza el limitador del registro, por dirección y por correo).

---

### `POST /api/auth/registro/completar` *(pública)*

Fija la contraseña y crea la cuenta.

**Entrada**: `{ "token": string, "password": string, "passwordConfirmacion": string }`

**Respuesta `201`**: `{ "ok": true }` + cookie de sesión + cookie `sesion_estado` ya sellada (para que el padre caiga directo en su Paso 1, sin rebote).

**Errores**:

| Código | Caso |
|---|---|
| `400` | Contraseña de menos de 8 caracteres o las dos no coinciden |
| `404` | Token inexistente |
| `409` | Token ya usado |
| `410` | Token vencido (más de 24 h) |

Los tres últimos se muestran en pantalla con calma y con la opción de pedir un enlace nuevo.

**Efectos**: crea el usuario con rol padre, marca el token como usado y envía `auth.bienvenida_padre`.

---

## Nueva · el rebote que cierra la falla-abierta

### `GET /api/sesion/al-dia?destino=<ruta>` *(ruta de sesión — exige sesión, no evalúa el camino)*

Existe para un solo caso: el guardián no pudo leer la cookie de estado (venció) y no puede consultar la base de datos desde Edge.

**Comportamiento**: re-sella `sesion_estado` con el estado real y responde `302`:

- Camino terminado → al `destino` pedido.
- Camino incompleto → a la pantalla del paso pendiente.

**Reglas duras**: `destino` solo se acepta si es una ruta interna (empieza por `/` y no por `//`) — la defensa contra redirección abierta que ya usa el registro. Un solo salto: esta ruta no evalúa el guardián del camino, así que no puede rebotar contra sí misma.

---

## Existentes que cambian

### `PATCH /api/padre/hijos/[id]`

Hoy acepta **solo** `{ estado }`. Pasa a aceptar además la corrección de datos:

**Entrada** (todos opcionales, al menos uno):

```json
{
  "nombre": "string",
  "apellidos": "string",
  "documentoTipo": "RC|TI|CC|CE|PASAPORTE|OTRO",
  "documentoNumero": "string",
  "anioNacimiento": 2015,
  "sexo": "string",
  "estado": "activo|inactivo"
}
```

**Errores**: `400` datos inválidos · `404` el menor no es de este padre · **`409` ese documento ya está en la lista de este padre**.

**Regla**: el acceso sigue siendo solo del padre dueño. Que el mismo documento exista en la lista de **otro** padre no es conflicto — es el caso normal (D-4).

---

### `POST /api/padre/hijos`

Gana el tope:

- **`409`** cuando el padre ya alcanzó `padre.hijos.maximo`, con el mensaje del parámetro.
- Deja de enganchar al padre a la ficha de otro: **siempre crea la ficha de este padre**.
- **`409`** si el documento ya está en la lista de este mismo padre.

---

### `PATCH /api/padre/perfil`

Pasa a exigir, además de lo de hoy: tipo y número de documento del padre. Deja de pedir la fecha de nacimiento (el campo permanece intacto en la base de datos).

---

## Comportamiento del guardián en las rutas de datos

Toda ruta `/api/**` gobernada por el camino, con el camino incompleto, responde:

```json
{
  "error": {
    "message": "<texto sereno en tuteo>",
    "code": "CAMINO_INCOMPLETO",
    "redirectTo": "/camino/<paso>"
  }
}
```

con estado **`403`**. Nunca una redirección: una petición de datos no puede seguir un `302` y confundir el bloqueo con un éxito (SPEC-329).

Las pantallas (todo lo que no empieza por `/api/`) sí reciben redirección al paso pendiente.

---

## Rutas exentas del guardián

Además de las públicas y las de sesión que ya existen:

- `/camino` y todo lo que cuelga de ella (las cuatro pantallas y el cierre).
- `/api/camino/**` (las rutas que alimentan esas pantallas).
- `/consentimiento` y `/api/consentimiento` (ya exentas por el guardián anterior).
- `/api/padre/perfil`, `/api/padre/hijos/**`, y la ruta de activación de plan — son justamente las que el padre necesita para **poder** completar los pasos.
- `/api/sesion/al-dia`.

**Invariante obligatoria** (ratchet existente, historial I-25 → I-111 → I-141): el destino del guardián del camino tiene que estar dentro de sus propias exentas, o el redirigido vuelve a dispararlo y se forma un bucle.

---

## Lo que NO cambia

- Las tres rutas del código de 6 dígitos: intactas, siguen sirviendo al registro de colegio.
- La respuesta de la ruta de consentimiento y su guardián.
- Los guardianes de cambio de contraseña y de vigencia.
- El comportamiento del sistema para administrador, colegio, operador y comité.
