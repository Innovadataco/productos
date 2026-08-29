> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Plan de implementación: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

## Resumen

Crear regla y plantilla de bienvenida institucional en el motor y reemplazar las llamadas directas a `enviarEmailBienvenidaColegio` por `motor.programar` en `src/app/api/admin/colegios/route.ts` y `src/app/api/admin/colegios/[id]/reenviar-email/route.ts`. Validar el piloto con tests.

## Cambios de código

### 1. Seed

#### 1.1 `prisma/seed.ts`

Añadir plantilla:

```ts
{
  clave: "colegio.bienvenida.email",
  canal: "EMAIL",
  asunto: "Tu cuenta institucional está lista",
  cuerpoMarkdown: `Hola,\n\nSe creó la cuenta institucional de tu colegio en Protección Infantil.\n\nUsuario: {{email}}\nContraseña temporal: {{password}}\n\nIngresa en {{url}}/login y cambia tu contraseña lo antes posible.\n\nEsta contraseña temporal no se volverá a mostrar.`,
  variablesSchema: JSON.stringify({
    type: "object",
    required: ["email", "password", "url"],
    properties: {
      email: { type: "string" },
      password: { type: "string" },
      url: { type: "string" },
    },
  }),
}
```

Añadir regla:

```ts
{
  evento: "colegio.bienvenida",
  rol: "SCHOOL_ADMIN",
  offset: "+0m",
  canal: "EMAIL",
  plantillaClave: "colegio.bienvenida.email",
  obligatoria: true,
}
```

### 2. Rutas de colegio

#### 2.1 `src/app/api/admin/colegios/route.ts`

Reemplazar:

```ts
import { enviarEmailBienvenidaColegio } from "@/lib/email";
...
await enviarEmailBienvenidaColegio(colegio.admin.email, password);
```

por:

```ts
import { programar } from "@/lib/notificaciones/motor";
...
await programar({
  evento: "colegio.bienvenida",
  destinatarios: [{
    email: colegio.admin.email,
    variables: {
      email: colegio.admin.email,
      password,
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005",
    },
  }],
});
```

#### 2.2 `src/app/api/admin/colegios/[id]/reenviar-email/route.ts`

Igual reemplazo.

### 3. Tests

#### 3.1 `src/app/api/admin/colegios/route.test.ts`

Actualizar mock de `enviarEmailBienvenidaColegio` a mock de `programar` del motor.

#### 3.2 `src/app/api/admin/colegios/[id]/reenviar-email/route.test.ts`

Igual.

#### 3.3 `src/lib/notificaciones/motor.test.ts` (SPEC-201)

Añadir caso de bienvenida colegio.

### 4. Deprecación

#### 4.1 `src/lib/email.ts`

Marcar `enviarEmailBienvenidaColegio` como `@deprecated` si se conserva, o eliminar si no hay otros usos.

### 5. Documentación

- `specs/204-piloto-bienvenida-colegio/quickstart.md`
- `specs/204-piloto-bienvenida-colegio/data-model.md` (sin cambios de schema).

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- CI verde 6/6.
