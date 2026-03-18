import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import ClientDashboard from './pages/ClientDashboard'
import EntrepriseDashboard from './pages/EntrepriseDashboard'
import CrateDashboard from './pages/CrateDashboard'

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
    case 'mareyeur':
    case 'pecheur':
    case 'gms':
      return <CrateDashboard />
    default:
      return <ClientDashboard />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
