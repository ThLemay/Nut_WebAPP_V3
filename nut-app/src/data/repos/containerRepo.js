import { supabase } from '../../lib/supabase'

export const containerRepo = {
  getByCompany: async (companyId) => {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('current_owner_company_id', companyId)
    if (error) throw new Error(error.message)
    return data
  },

  getByClient: async (clientId) => {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('current_holder_client_id', clientId)
    if (error) throw new Error(error.message)
    return data
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(`Contenant introuvable : ${id}`)
    return data
  },

  update: async (id, fields) => {
    const { data, error } = await supabase
      .from('containers')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }
}