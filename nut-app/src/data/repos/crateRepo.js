import { supabase } from '../../lib/supabase'

export const crateRepo = {
  /** Toutes les caisses appartenant à un mareyeur */
  async getByOwner(ownerId) {
    const { data, error } = await supabase
      .from('crates')
      .select('*, current_holder:profiles!crates_current_holder_id_fkey(id, name, role)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Toutes les caisses actuellement détenues par un acteur */
  async getByHolder(holderId) {
    const { data, error } = await supabase
      .from('crates')
      .select('*, owner:profiles!crates_owner_id_fkey(id, name, role)')
      .eq('current_holder_id', holderId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Trouver une caisse par son QR code */
  async getByQrCode(qrCode) {
    const { data, error } = await supabase
      .from('crates')
      .select('*, current_holder:profiles!crates_current_holder_id_fkey(id, name, role), owner:profiles!crates_owner_id_fkey(id, name, role)')
      .eq('qr_code', qrCode)
      .single()
    if (error) throw error
    return data
  },

  /** Trouver une caisse par ID */
  async getById(id) {
    const { data, error } = await supabase
      .from('crates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  /** Mettre à jour le statut et/ou le détenteur */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('crates')
      .update(updates)
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
      .update(updates)
      .in('id', ids)
      .select()
    if (error) throw error
    return data
  },

  /** Compter les caisses par statut pour un propriétaire */
  async getStockSummary(ownerId) {
    const { data, error } = await supabase
      .from('crates')
      .select('status')
      .eq('owner_id', ownerId)
    if (error) throw error

    const summary = { en_stock: 0, en_transit: 0, casse: 0, perdu: 0, total: 0 }
    data.forEach(c => {
      summary[c.status] = (summary[c.status] || 0) + 1
      summary.total++
    })
    return summary
  },
}
