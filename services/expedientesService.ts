import { supabase } from '@/services/supabase';
import type { Expediente } from '@/modules/types';

export async function createExpediente(nombre: string): Promise<Expediente> {
  const { data, error } = await supabase
    .from('expedientes')
    .insert({ nombre })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getExpedientes(): Promise<Expediente[]> {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*, fase:fases!fase_actual_id(id, nombre, orden)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function getExpedienteById(id: string): Promise<Expediente> {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*, fase:fases!fase_actual_id(id, nombre, orden)')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}
