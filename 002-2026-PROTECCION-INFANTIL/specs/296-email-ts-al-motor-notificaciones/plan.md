# Plan de implementación — SPEC-296 · Migrar email.ts al Motor de Notificaciones

## Alcance

Convertir `src/lib/email.ts` (20 funciones exportadas) en un thin wrapper del motor de notificaciones. Los 16 callsites externos no cambian. Se crean 20 eventos + 20 plantillas + 20 reglas en el seed. Se añade el ratchet grep-based al CI.

## Hallazgo durante implementación

`enviarEmailNotificacion(email, asunto, cuerpo)` NO puede migrarse a `programar()` porque **es el proveedor real de envío del motor**: `scripts/worker-notificaciones.mjs:149` la inyecta como `enviarEmail` en `procesarLote()`. Es la función que hace `resend.emails.send()` cuando el motor procesa un job de su cola.

**Ajuste**: la función se **mueve** de `src/lib/email.ts` a `src/lib/notificaciones/enviar-email.ts` (ubicación bajo el paraguas del motor, satisface el grep ratchet). Los 3 callsites (`worker-notificaciones.mjs`, `notificaciones/admin-service.ts`, `dal/services/notificacion-admin.ts`) actualizan su import. Las otras 19 funciones sí se convierten en wrappers de `programar()`.

## Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `src/lib/email.ts` | 19 funciones (todas excepto `enviarEmailNotificacion`) pasan a llamar `programar({evento, destinatarios: [{email, usuarioId?, variables}]})`. La 20ª (`enviarEmailNotificacion`) **se mueve** al motor. Se elimina el import de `Resend`. |
| `src/lib/notificaciones/enviar-email.ts` (nuevo) | Alberga `enviarEmailNotificacion`. Único callsite legítimo de `resend.emails.send()` en la carpeta permitida. |
| `scripts/worker-notificaciones.mjs` | Actualiza el import de `@/lib/email` a `@/lib/notificaciones/enviar-email`. |
| `src/lib/notificaciones/admin-service.ts` + `src/lib/dal/services/notificacion-admin.ts` | Actualizan el mismo import. |
| `prisma/seed.ts` | Nueva función `seedEventosEmailMigrados()` invocada desde `main()`. Crea idempotentemente los 20 eventos con plantilla + regla EMAIL. |
| `.github/workflows/ci-002-proteccion-infantil.yml` | Nuevo step `Ratchet Resend fuera del motor` en el job `verificaciones` (comando grep-based). |
| `src/lib/email.migracion.test.ts` (nuevo) | Integration test: seed + wrappers → filas en `Notificacion`. |
| `specs/README.md` | Entrada SPEC-296. |
| `specs/296-email-ts-al-motor-notificaciones/tasks.md` | Marcador de estado. |

## Diseño técnico

### Patrón de wrapper (aplicado 20 veces)

Antes:
```ts
export async function enviarCodigoVerificacion(email: string, codigo: string) {
    const result = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: "Tu código de verificación",
        html: `<h2>Código: ${codigo}</h2><p>Vence en 15 minutos.</p>`,
    });
    return result;
}
```

Después:
```ts
export async function enviarCodigoVerificacion(email: string, codigo: string) {
    return programar({
        evento: "auth.codigo_verificacion",
        destinatarios: [{ email, variables: { codigo } }],
    });
}
```

Al reducirse a llamar `programar()`, la responsabilidad del `resend.emails.send` queda 100 % en `src/lib/notificaciones/envio.ts` (que ya lo tiene).

### Nuevas plantillas en `prisma/seed.ts`

Función `seedEventosEmailMigrados()` (patrón heredado de `seedEventosSuscripcion` en la línea 3429):

```ts
async function seedEventosEmailMigrados() {
    // SPEC-296 (002-PI-197 · cierra I-152): plantillas + reglas de los 20 eventos
    // migrados desde src/lib/email.ts. Cada uno copia asunto y cuerpo del HTML
    // que hoy vive inline en email.ts (equivalencia visual, cero cambio en
    // callsites externos).
    const plantillas = [
        {
            clave: "auth.codigo_verificacion.email",
            asunto: "Tu código de verificación",
            cuerpoMarkdown: "## Código: {{codigo}}\n\nVence en 15 minutos.",
            variablesSchema: { type: "object", properties: { codigo: { type: "string" } } },
        },
        // … (19 más, uno por función)
    ];
    for (const p of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: p.clave },
            update: {},
            create: { ...p, canal: "EMAIL", activa: true },
        });
    }
    const reglas: Array<{ evento: string; plantillaClave: string; obligatoria: boolean }> = [
        { evento: "auth.codigo_verificacion", plantillaClave: "auth.codigo_verificacion.email", obligatoria: true },
        { evento: "auth.password_recuperacion", plantillaClave: "auth.password_recuperacion.email", obligatoria: true },
        // … (18 más)
    ];
    for (const r of reglas) {
        await upsertNotificacionRegla({
            evento: r.evento,
            rol: null, // no aplica rol (destinatario por email crudo o email crudo derivado de usuario)
            canal: "EMAIL",
            plantillaClave: r.plantillaClave,
            offset: "+0m",
            obligatoria: r.obligatoria,
        });
    }
    console.log(`[SEED] ${plantillas.length} plantillas + reglas de email migradas listas (SPEC-296)`);
}
```

Nota: `upsertNotificacionRegla` está en `prisma/seed.ts:44`; se reusa como los demás seeders. Firma exacta se lee del código antes de invocar.

### Regla `obligatoria`

- **Obligatoria=true** (bypass de opt-out): `auth.*`, `usuario.credenciales.padre`, `usuario.bienvenida.*`, `infra.*`, `admin.notificacion_generica`, `motor.deriva.alerta`. Son avisos operacionales/sistémicos que el usuario no puede silenciar.
- **Obligatoria=false**: `reporte.*`, `padre.circulo_confianza.pendientes`, `colegio.*`, `comite.*`, `suscriptores.reporte_publicado`. Son avisos de notificación que el usuario **sí** puede silenciar.

### Ratchet CI

En `verificaciones` de `ci-002-proteccion-infantil.yml`, tras `arch:check`:

```yaml
      # SPEC-296 (002-PI-197 · cierra I-152): impide que un PR futuro reintroduzca
      # `resend.emails.send()` fuera del motor de notificaciones.
      - name: Ratchet Resend fuera del motor
        run: |
          set -e
          BYPASS=$(grep -rn "resend\.emails\.send" src/ --include="*.ts" --include="*.tsx" \
              | grep -v "src/lib/notificaciones/" | grep -v "\.test\." || true)
          if [ -n "$BYPASS" ]; then
              echo "❌ Nuevo callsite Resend directo fuera del motor:"
              echo "$BYPASS"
              exit 1
          fi
          echo "✅ Cero bypasses Resend fuera del motor."
```

### Test de integración

`src/lib/email.migracion.test.ts` (patrón heredado de `seed-freemium.test.ts`):

- `beforeAll`: `resetDatabase()` + admin sembrado + `correrSeed()` (execSync tsx prisma/seed.ts).
- **Test 1** — cobertura de reglas: para cada uno de los 20 eventos, `prisma.notificacionRegla.count({where:{evento, activa:true, canal:"EMAIL"}}) >= 1`.
- **Test 2** — `enviarCodigoVerificacion` crea Notificacion: llama al wrapper, verifica que hay una fila en `Notificacion` con `evento="auth.codigo_verificacion", plantillaClave="auth.codigo_verificacion.email", destinatarioEmail="test@x.co", variables.codigo="9999"`.
- **Test 3** — `enviarEmailBienvenidaOperador` idem (representante de bienvenida.*).
- **Test 4** — `enviarAlertasSuscriptores` con 3 destinatarios crea 3 filas.

Se registra en `vitest.unit.includes.ts`? No: usa BD → va en integration (default vitest.config.ts).

## Riesgo y candados

- **Riesgo alto silencioso**: si un evento carece de regla activa, `programar()` retorna `programadas: 0` sin fallar → el email no sale. **Mitigación**: el test 1 de cobertura falla el CI si falta 1 sola regla, y el seed las siembra todas en un mismo bloque idempotente.
- **Candado FR-008**: cero cambio a `motor.ts`. Verificado por diff.
- **Candado FR-009**: cero cambio al schema. Los 20 eventos + plantillas + reglas usan las tablas ya existentes (`NotificacionPlantilla`, `NotificacionRegla`, `NotificacionPreferencia`).
- **Regresión de contenido**: si una plantilla difiere del HTML actual, el usuario recibe un email distinto. Mitigación: copiar literal el `subject` y renderizar el HTML a Markdown equivalente. Diff antes/después queda en `cierre.md` para audit.
- **Regla `obligatoria`**: elección política (documentada arriba). Si el CEO objeta, se cambia a `false` para todo `auth.*` sin migración, editando el seed en el mismo PR.

## Pruebas

- `src/lib/email.migracion.test.ts` (4 tests · integration · usa BD y ejecuta seed).
- Verificación empírica en dev: `curl POST /api/auth/verificar/solicitar` → `SELECT * FROM "Notificacion" WHERE evento='auth.codigo_verificacion' ORDER BY "createdAt" DESC LIMIT 1` → estado `ENCOLADA` o `ENVIADA`.
- Verificación en vivo prod (SC-A41-2): dos eventos disparados (`auth.codigo_verificacion` + `usuario.credenciales.padre`), ambos con filas en `Notificacion`.

## Rollback

Revertir el commit restaura las 20 funciones al modo Resend directo. El seed dejará plantillas/reglas creadas (no molestan) o se limpian por SQL. El ratchet CI también se revierte con el mismo commit.
