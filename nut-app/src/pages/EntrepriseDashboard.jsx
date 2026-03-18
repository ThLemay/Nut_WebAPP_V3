import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { containerRepo } from '../data/repos/containerRepo'
import { transactionRepo } from '../data/repos/transactionRepo'
import { supabase } from '../lib/supabase'
import ScanPage from './ScanPage'

const C = {
  bg: '#f8faf7', card: '#ffffff', primary: '#2d6a4f', accent: '#f4a261',
  muted: '#6b7280', border: '#e5e7eb',
}

const s = {
  card: { background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 },
  btn: (v = 'primary', sm = false) => ({ 
    background: v === 'primary' ? C.primary : v === 'accent' ? C.accent : '#f3f4f6', 
    color: v === 'ghost' ? '#1b1b1b' : '#fff', 
    border: `1px solid ${C.border}`, 
    borderRadius: 10, 
    padding: sm ? '8px 14px' : '11px 20px', 
    fontWeight: 600, 
    fontSize: sm ? 13 : 15, 
    cursor: 'pointer' 
  }),
  badge: (c) => ({ 
    background: c === 'green' ? '#dcfce7' : c === 'amber' ? '#fef9c3' : '#fee2e2', 
    color: c === 'green' ? '#166534' : c === 'amber' ? '#854d0e' : '#991b1b', 
    borderRadius: 999, 
    padding: '3px 10px', 
    fontSize: 12, 
    fontWeight: 600 
  }),
}

function TxRow({ tx }) {
  const isD = tx.type === 'deconsigne'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{isD ? '♻️' : '📦'}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{isD ? 'Déconsigne' : 'Consigne'}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{tx.container_id} · {tx.client_id?.slice(0, 8)}…</div>
          <div style={{ fontSize: 12, color: C.muted }}>{new Date(tx.timestamp).toLocaleString('fr-FR')}</div>
        </div>
      </div>
      {isD && tx.nut_coins_delta > 0 && (
        <span style={{ color: C.primary, fontWeight: 700, fontSize: 14 }}>+{tx.nut_coins_delta} 🌰</span>
      )}
    </div>
  )
}

function ContainerCard({ c }) {
  const statusMap = { available: ['green', 'Disponible'], in_use: ['amber', 'En cours'], lost: ['red', 'Perdu'] }
  const [color, label] = statusMap[c.status] || ['red', c.status]
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>📦 {c.container_type}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>ID : {c.id}</div>
          {c.current_holder_client_id && (
            <div style={{ fontSize: 12, color: C.muted }}>👤 {c.current_holder_client_id.slice(0, 8)}…</div>
          )}
          <div style={{ fontSize: 11, color: C.muted }}>
            Mis à jour : {new Date(c.updated_at).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <span style={s.badge(color)}>{label}</span>
      </div>
    </div>
  )
}

export default function EntrepriseDashboard() {
  const { profile, logout } = useAuth()
  const [tab, setTab] = useState('overview')
  const [showScan, setShowScan] = useState(false)
  const [containers, setContainers] = useState([])
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)

  const company = profile?.companies

  const load = async () => {
    if (!company) return
    setLoading(true)
    try {
      const [c, t] = await Promise.all([
        containerRepo.getByCompany(company.id),
        transactionRepo.getByCompany(company.id),
      ])
      setContainers(c)
      setTxs(t)
    } catch (err) {
      console.error('Erreur chargement:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [company])

  // Realtime
  useEffect(() => {
    if (!company) return
    const channel = supabase.channel('entreprise-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [company])

  if (!company) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
      ⚠️ Profil entreprise introuvable.
    </div>
  )

  if (showScan) return (
    <ScanPage
      company={company}
      onBack={() => setShowScan(false)}
      onDone={load}
    />
  )

  const available = containers.filter(c => c.status === 'available')
  const inUse = containers.filter(c => c.status === 'in_use')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
        <header style={{ background: C.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-header.png" alt="NUT" style={{ height: 36, objectFit: 'contain' }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>NUT</div>
            <div style={{ color: '#a7f3d0', fontSize: 12 }}>{company.name}</div>
          </div>
        </div>
        <button 
          style={{ ...s.btn('ghost', true), background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} 
          onClick={logout}
        >
          Déconnexion
        </button>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 20 }}>
        {/* Bouton Scanner principal */}
          <button 
            onClick={() => setShowScan(true)} 
            style={{ 
              ...s.btn('accent'), 
              width: '100%', 
              fontSize: 18, 
              padding: '16px 20px', 
              marginBottom: 20, 
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 4px 12px rgba(244,162,97,0.35)'
            }}
          >
            Scanneur pour consigner/déconsigner 📲
          </button>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}></div>
                  
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'Total', val: containers.length, icon: '📦' },
                      { label: 'Disponibles', val: available.length, icon: '✅' },
                      { label: 'En cours', val: inUse.length, icon: '🔄' },
                    ].map(({ label, val, icon }) => (
                      <div key={label} style={{ ...s.card, textAlign: 'center', marginBottom: 0 }}>
                        <div style={{ fontSize: 24 }}>{icon}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{val}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
                      </div>
                    ))}
                  </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['overview', '📊 Aperçu'], ['containers', '📦 Contenants'], ['history', '📋 Transactions']].map(([k, l]) => (
            <button key={k} style={{ ...s.btn(tab === k ? 'primary' : 'ghost', true), flex: 1, fontSize: 13 }} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>⏳ Chargement...</div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <div style={s.card}>
                  <h3 style={{ margin: '0 0 8px' }}>Politique NutCoins</h3>
                  <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
                    Chaque déconsigne rapporte <strong style={{ color: C.primary }}>{company.points_per_deconsigne} 🌰</strong> au client.
                  </p>
                </div>
                <h3 style={{ margin: '0 0 12px' }}>Dernières transactions</h3>
                {txs.slice(0, 5).map(tx => <TxRow key={tx.id} tx={tx} />)}
                {txs.length === 0 && <p style={{ color: C.muted }}>Aucune transaction.</p>}
              </>
            )}

            {tab === 'containers' && (
              <>
                <h3 style={{ margin: '0 0 12px' }}>Contenants ({containers.length})</h3>
                {containers.length === 0
                  ? <p style={{ color: C.muted }}>Aucun contenant.</p>
                  : containers.map(c => <ContainerCard key={c.id} c={c} />)
                }
              </>
            )}

            {tab === 'history' && (
              <>
                <h3 style={{ margin: '0 0 12px' }}>Transactions ({txs.length})</h3>
                {txs.length === 0
                  ? <p style={{ color: C.muted }}>Aucune transaction.</p>
                  : txs.map(tx => <TxRow key={tx.id} tx={tx} />)
                }
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}