import { supabase } from '../../lib/supabase'

export const transactionRepo = {
  getByClient: async (clientId) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },

  getByCompany: async (companyId) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('timestamp', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },

  create: async (tx) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(tx)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }
}