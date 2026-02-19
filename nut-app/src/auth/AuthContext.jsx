import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Charger le profil étendu (role, nutCoins, etc.)
 const loadProfile = async (authUser) => {
  console.log('loadProfile appelé avec:', authUser)
  if (!authUser) { 
    console.log('pas de user, setProfile null')
    setProfile(null); 
    return 
  }
  const { data, error } = await supabase  // ← ajoutez "error" ici
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', authUser.id)
    .single()
  console.log('Résultat complet:', { data, error })  // ← changez cette ligne
  setProfile(data)
}

  useEffect(() => {
    // Session courante
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
      setLoading(false)
    })

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        loadProfile(session?.user ?? null)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  // Charger le profil immédiatement après login
  await loadProfile(data.user)
}

  const register = async ({ email, password, name, role, companyName, policyPts }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)

    // Créer le profil
    await supabase.from('profiles').insert({
      id: data.user.id, name, role, nut_coins: 0
    })

    // Créer l'entreprise si besoin
    if (role === 'entreprise') {
      await supabase.from('companies').insert({
        name: companyName || name,
        user_id: data.user.id,
        points_per_deconsigne: policyPts || 5
      })
    }
  }

  const logout = () => supabase.auth.signOut()

  const refreshProfile = () => loadProfile(user)

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}