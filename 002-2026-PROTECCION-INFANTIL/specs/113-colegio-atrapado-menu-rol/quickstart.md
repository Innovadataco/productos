# Quickstart — SPEC-113: verificación del colegio destrabado

## 1. I-35 — alta obligatoria (rojo→verde)

```bash
export PATH="$HOME/.local/bin:$PATH"
# ROJO primero (contra el proxy actual): el POST de SCHOOL_ADMIN a /api/auth/cambiar-password
# debe dar 403 — regístralo.
# VERDE después del fix:
npx vitest run src/app/api/auth/cambiar-password src/lib/proxy.test.ts
# Esperado: SCHOOL_ADMIN + debeCambiarPassword=true → 200 y la contraseña nueva entra en login.
```

## 2. I-35b — salir de la pantalla

- Con un colegio en `/cambiar-password`: pulsar "Cerrar sesión" → termina en `/` (inicio
  público) y la sesión murió (ir a `/dashboard/colegio` redirige a `/login`).
- Prueba de robustez: si la llamada a `/api/auth/logout` fallara, la navegación a `/`
  ocurre igual.

## 3. I-36 — menú por rol

```bash
npx vitest run src/components/modules/NavHeader.test.tsx
# Esperado: SCHOOL_ADMIN no ve "Círculo de Confianza" ni "Mis reportes";
# PARENT sí las ve; anónimo sin cambios.
```

## 4. Verificación manual del piloto

- Crear colegio nuevo (o usar colegio2@innovadataco.com): el alta obligatoria completa
  (formulario → 200 → entra al panel del colegio) y "Cerrar sesión" saca al inicio.

## 5. Gate

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
# Esperado: verde completo; CI GitHub success en el push.
```
