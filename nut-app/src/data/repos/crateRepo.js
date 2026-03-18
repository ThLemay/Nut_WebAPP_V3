import { supabase } from '../../lib/supabase'

export const crateRepo = {
  /** 
   * Toutes les caisses visibles par un acteur :
   * - celles qu'il détient physiquement (current_holder_id)
   * - celles qu'il a envoyées et qui sont en transit ailleurs (owner_id)
   */
  async getAllVisible(profileId) {
    const { data, error } = await supabase
      .from('crates')
      .select('*')
      .or(`current_holder_id.eq.${profileId},owner_id.eq.${profileId}`)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Caisses détenues physiquement */
  async getByHolder(holderId) {
    const { data, error } = await supabase
      .from('crates')
      .select('*')
      .eq('current_holder_id', holderId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Trouver une caisse par son QR code */
  async getByQrCode(qrCode) {
    const { data, error } = await supabase
      .from('crates')
      .select('*')
      .eq('qr_code', qrCode)
      .single()
    if (error) throw error
    return data
  },

  /** Mettre à jour le statut et/ou le détenteur */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('crates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Mise à jour en lot */
  async updateBatch(ids, updates) {
    const { data, error } = await supabase
      .from('crates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select()
    if (error) throw error
    return data
  },

  /** Résumé du stock visible par un acteur */
  async getStockSummary(profileId) {
    const { data, error } = await supabase
      .from('crates')
      .select('status, current_holder_id')
      .or(`current_holder_id.eq.${profileId},owner_id.eq.${profileId}`)
    if (error) throw error

    const summary = { en_stock: 0, en_transit: 0, casse: 0, perdu: 0, total: 0 }
    data.forEach(c => {
      summary[c.status] = (summary[c.status] || 0) + 1
      summary.total++
    })
    return summary
  },
}
