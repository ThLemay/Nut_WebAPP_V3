import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import ClientDashboard from './pages/ClientDashboard'
import EntrepriseDashboard from './pages/EntrepriseDashboard'

function AppInner() {
  const { profile, loading } = useAuth()
  
  console.log('AppInner render:', { profile, loading })  // ← ajoutez cette ligne

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div>⏳ Chargement...</div>
      </div>
    )
  }

  if (!profile) return <LoginPage />
  if (profile.role === 'entreprise') return <EntrepriseDashboard />
  return <ClientDashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}