import { supabase } from '@/services/supabase';
import type { Fase } from '@/modules/types';

export async function getFases(): Promise<Fase[]> {
  const { data, error } = await supabase
    .from('fases')
    .select('*')
    .order('orden', { ascending: true });

  if (error) throw error;

  return data;
}

export async function getFaseById(id: string): Promise<Fase> {
  const { data, error } = await supabase
    .from('fases')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}
