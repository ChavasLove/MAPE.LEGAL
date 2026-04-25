import { supabase } from '@/services/supabase';
import type { Phase } from '@/modules/types';

export async function getPhases(): Promise<Phase[]> {
  const { data, error } = await supabase
    .from('phases')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) throw error;

  return data;
}

export async function getPhaseById(id: string): Promise<Phase> {
  const { data, error } = await supabase
    .from('phases')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}
