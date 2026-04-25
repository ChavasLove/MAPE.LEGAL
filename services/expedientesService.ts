import { supabase } from '@/services/supabase';
import type { Expediente } from '@/modules/types';

export async function createExpediente(name: string): Promise<Expediente> {
  const { data, error } = await supabase
    .from('expedientes')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getExpedientes(): Promise<Expediente[]> {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*, phase:phases(id, name, order_index)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function getExpedienteById(id: string): Promise<Expediente> {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*, phase:phases(id, name, order_index)')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}
