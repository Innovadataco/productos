# Quickstart: Middleware de vigencia (SPEC-242)

## Requisitos previos

- Docker Compose con Postgres en puerto `5433` levantado.
- Migraciones aplicadas: `npx prisma migrate dev`.
- Cliente Prisma generado: `npx prisma generate`.
- App corriendo en `http://localhost:5005`.

## 1. Crear datos de prueba

### Padre con suscripción ACTIVA
```bash
node --env-file=.env -e "
const { prisma } = require('./src/lib/prisma');
(async () => {
  const padre = await prisma.usuario.create({
    data: { email: 'padre-activo@test.co', nombre: 'Padre Activo', rol: 'PARENT', estado: 'activo', passwordHash: 'x' }
  });
  const plan = await prisma.plan.findFirst({ where: { tipoTitular: 'PADRE' } });
  await prisma.suscripcion.create({
    data: {
      tipoTitular: 'PADRE',
      usuarioId: padre.id,
      estado: 'ACTIVA',
      planActualId: plan.id,
      fechaInicio: new Date(),
      fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      codigoReferidoPropio: 'padre-activo'
    }
  });
  console.log('Padre activo:', padre.id);
  await prisma.$disconnect();
})();
"
```

### Padre sin suscripción
Crear un usuario `PARENT` sin fila en `Suscripcion`.

### Padre en EN_GRACIA
Crear suscripción con `estado: 'EN_GRACIA'`.

### Colegio SUSPENDIDA
Crear usuario `SCHOOL_ADMIN` vinculado a un colegio y suscripción con `estado: 'SUSPENDIDA'`.

## 2. Flujos manuales

### Escenario A — acceso permitido
1. Iniciar sesión como padre ACTIVA.
2. Navegar a `/dashboard/padre`.
3. **Esperado**: se carga el dashboard sin banners de bloqueo.

### Escenario B — banner ámbar EN_GRACIA
1. Iniciar sesión como padre EN_GRACIA.
2. Navegar a `/dashboard/padre`.
3. **Esperado**: aparece banner amarillo con texto "Tu plan vence pronto. Renueva para no perder el acceso."

### Escenario C — redirección a /suscripcion
1. Iniciar sesión como padre SUSPENDIDA, CANCELADA, PENDIENTE_AUTORIZACION o sin suscripción.
2. Navegar a `/dashboard/padre`.
3. **Esperado**: redirección a `/dashboard/padre/suscripcion`.

### Escenario D — exenciones nunca bloqueadas
1. Con padre en cualquier estado, acceder a:
   - `/dashboard/padre/perfil`
   - `/dashboard/padre/suscripcion`
   - `/consentimiento`
   - `/reportar`
2. **Esperado**: nunca redirige por vigencia.

### Escenario E — /reportar sin suscripción
1. Iniciar sesión como padre sin suscripción activa.
2. Acceder a `/reportar`.
3. **Esperado**: la página carga (acceso permitido) y en `AuditLog` aparece una fila con `accion = 'REPORTE_SIN_SUSCRIPCION'`.

### Escenario F — colegio
Repetir A-D con usuario `SCHOOL_ADMIN` o `COMITE_CONVIVENCIA` bajo `/dashboard/colegio/**`.

## 3. Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- src/lib/pagos/vigencia-middleware.test.ts
npm run build
```
