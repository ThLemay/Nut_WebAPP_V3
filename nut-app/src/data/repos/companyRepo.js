import { supabase } from '../../lib/supabase'

export const companyRepo = {
  getByUserId: async (userId) => {
    const { data, error } = await supabase
      .from('companies').select('*').eq('user_id', userId).single()
    if (error) throw new Error(error.message)
    return data
  },
  
  getById: async (id) => {
    const { data, error } = await supabase
      .from('companies').select('*').eq('id', id).single()
    if (error) throw new Error(error.message)
    return data
  }
}