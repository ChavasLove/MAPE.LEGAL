'use client';

// Carga de datos para las pantallas del personal. El estado se actualiza solo
// dentro de los callbacks de la petición (nunca de forma síncrona en el efecto).

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/components/cadena/shared';

export interface Carga<T> {
  datos: T | null;
  error: string | null;
  enPreparacion: boolean;
  cargando: boolean;
  recargar: () => void;
}

export function useCarga<T>(url: string): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enPreparacion, setEnPreparacion] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    apiFetch<T>(url)
      .then((d) => { if (vivo) { setDatos(d); setError(null); setCargando(false); } })
      .catch((e: unknown) => {
        if (!vivo) return;
        if (e instanceof ApiError && e.migracionPendiente) setEnPreparacion(true);
        else setError(e instanceof Error ? e.message : 'Error al cargar');
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [url, recarga]);

  return { datos, error, enPreparacion, cargando, recargar: () => { setCargando(true); setRecarga((n) => n + 1); } };
}

/** Envía JSON con el método indicado y devuelve el error legible, o null si salió bien. */
export async function enviar(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST'): Promise<string | null> {
  try {
    await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'No se pudo completar la operación';
  }
}

export const AVISO_PREPARACION = 'Módulo en preparación: las migraciones de esta sección aún no están aplicadas en la base de datos.';
