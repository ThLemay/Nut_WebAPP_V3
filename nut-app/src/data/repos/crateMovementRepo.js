import { supabase } from '../../lib/supabase'

export const crateMovementRepo = {
  /** Enregistrer un mouvement */
  async create(movement) {
    const { data, error } = await supabase
      .from('crate_movements')
      .insert(movement)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Enregistrer plusieurs mouvements en lot */
  async createBatch(movements) {
    const { data, error } = await supabase
      .from('crate_movements')
      .insert(movements)
      .select()
    if (error) throw error
    return data
  },

  /** Mouvements impliquant un acteur (expéditeur ou destinataire) */
  async getByActor(actorId, limit = 50) {
    const { data, error } = await supabase
      .from('crate_movements')
      .select(`
        *,
        crate:crates(id, qr_code, crate_type),
        from:profiles!crate_movements_from_id_fkey(id, name, role),
        to:profiles!crate_movements_to_id_fkey(id, name, role)
      `)
      .or(`from_id.eq.${actorId},to_id.eq.${actorId}`)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data
  },

  /** Historique d'une caisse */
  async getByCrate(crateId) {
    const { data, error } = await supabase
      .from('crate_movements')
      .select(`
        *,
        from:profiles!crate_movements_from_id_fkey(id, name, role),
        to:profiles!crate_movements_to_id_fkey(id, name, role)
      `)
      .eq('crate_id', crateId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
}
