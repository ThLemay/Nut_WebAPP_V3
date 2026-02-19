import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const C = {
  bg: '#f8faf7', card: '#ffffff', primary: '#2d6a4f',
  muted: '#6b7280', border: '#e5e7eb', error: '#fee2e2', errorText: '#991b1b',
}

const s = {
  card: { background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 },
  btn: (v = 'primary') => ({ 
    background: v === 'primary' ? C.primary : '#f3f4f6', 
    color: v === 'primary' ? '#fff' : '#1b1b1b', 
    border: 'none', borderRadius: 10, padding: '11px 20px', 
    fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' 
  }),
  input: { 
    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, 
    padding: '11px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12 
  },
  label: { fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' },
}

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setErr('')
    if (!email || !password) {
      setErr('Email et mot de passe requis.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const demoLogins = [
    { label: '🥗 EcoCantine (Entreprise)', email: 'eco@demo.com' },
    { label: '🥣 BioBowl (Entreprise)', email: 'bio@demo.com' },
    { label: '👤 Alice (Client)', email: 'alice@demo.com' },
    { label: '👤 Bob (Client)', email: 'bob@demo.com' },
  ]

  return (
    <div style={{ 
      minHeight: '100vh', background: C.bg, display: 'flex', 
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🌰</div>
          <h1 style={{ margin: '8px 0 4px', color: C.primary, fontSize: 32, fontWeight: 800 }}>NUT</h1>
          <p style={{ color: C.muted, margin: 0 }}>Système de consigne réutilisable</p>
        </div>

        <div style={s.card}>
          {err && (
            <div style={{ 
              background: C.error, color: C.errorText, borderRadius: 10, 
              padding: '12px 16px', fontSize: 14, marginBottom: 12 
            }}>
              {err}
            </div>
          )}

          <label style={s.label}>Email</label>
          <input 
            style={s.input} 
            type='email' 
            placeholder='email@exemple.com' 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
          
          <label style={s.label}>Mot de passe</label>
          <input 
            style={{ ...s.input, marginBottom: 20 }} 
            type='password' 
            placeholder='••••••••' 
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          <button style={s.btn()} onClick={handleLogin} disabled={loading}>
            {loading ? '⏳ Connexion...' : 'Se connecter'}
          </button>
        </div>

        <div style={s.card}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted, fontWeight: 600 }}>
            ⚡ Connexions rapides (démo)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demoLogins.map(d => (
              <button 
                key={d.email} 
                style={{ 
                  ...s.btn('ghost'), 
                  textAlign: 'left', 
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  padding: '10px 14px'
                }}
                onClick={() => { 
                  setEmail(d.email)
                  setPassword('demo1234')
                  setErr('')
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}