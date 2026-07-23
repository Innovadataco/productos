import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { parse as parseEnv } from "dotenv";
import fs from "fs";
import path from "path";

// FR-001 (spec 002): la suite carga su entorno desde .env.test y SOLO desde ahí.
// No se usa loadEnv() de Vite porque también leería el .env real del desarrollador,
// rompiendo el aislamiento que exige US1 (la suite debe pasar en un clon limpio).
const testEnvPath = path.resolve(__dirname, ".env.test");
const testEnv = fs.existsSync(testEnvPath)
  ? parseEnv(fs.readFileSync(testEnvPath))
  : {};

export default defineConfig({
  plugins: [react()],
  test: {
    // Entorno por defecto: "node". Las rutas API y src/lib son código de servidor;
    // bajo jsdom, el TextEncoder de otro realm rompe el instanceof de jose
    // ("payload must be an instance of Uint8Array") al firmar el JWT.
    // Los tests de componentes React deben declarar en su cabecera:
    //   // @vitest-environment jsdom
    environment: "node",
    globals: true,
    env: testEnv,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
