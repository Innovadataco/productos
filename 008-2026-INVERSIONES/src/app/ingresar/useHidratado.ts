"use client";
import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

/** true solo en el navegador ya hidratado: antes, los botones quedan deshabilitados (no hay envío sin JS). */
export const useHidratado = (): boolean => useSyncExternalStore(sinSuscripcion, () => true, () => false);
