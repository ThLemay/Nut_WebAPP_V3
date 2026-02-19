import { supabase } from '../../lib/supabase'

export const userRepo = {
  getById: async (id) => {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', id).single()
    if (error) throw new Error(error.message)
    return data
  },
  
  getByEmail: async (email) => {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('email', email).single()
    if (error) throw new Error(error.message)
    return data
  }
}