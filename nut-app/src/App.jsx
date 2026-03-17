import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import ClientDashboard from './pages/ClientDashboard'
import EntrepriseDashboard from './pages/EntrepriseDashboard'
import MareyeurDashboard from './pages/MareyeurDashboard'
import PecheurDashboard from './pages/PecheurDashboard'
import GMSDashboard from './pages/GMSDashboard'

function AppInner() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div>⏳ Chargement...</div>
      </div>
    )
  }

  if (!profile) return <LoginPage />

  switch (profile.role) {
    case 'entreprise': return <EntrepriseDashboard />
    case 'mareyeur':   return <MareyeurDashboard />
    case 'pecheur':    return <PecheurDashboard />
    case 'gms':        return <GMSDashboard />
    default:           return <ClientDashboard />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
