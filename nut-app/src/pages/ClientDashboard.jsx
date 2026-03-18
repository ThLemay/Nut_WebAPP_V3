import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { containerRepo } from '../data/repos/containerRepo'
import { transactionRepo } from '../data/repos/transactionRepo'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

const C = {
  bg: '#f8faf7', card: '#ffffff', primary: '#2d6a4f', primaryLight: '#52b788',
  muted: '#6b7280', border: '#e5e7eb',
}

const s = {
  card: { background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 },
  btn: (v = 'primary', sm = false) => ({ 
    background: v === 'primary' ? C.primary : '#f3f4f6', 
    color: v === 'primary' ? '#fff' : '#1b1b1b', 
    border: `1px solid ${C.border}`, 
    borderRadius: 10, 
    padding: sm ? '8px 14px' : '11px 20px', 
    fontWeight: 600, 
    fontSize: sm ? 13 : 15, 
    cursor: 'pointer' 
  }),
  badge: (c) => ({ 
    background: c === 'green' ? '#dcfce7' : '#fef9c3', 
    color: c === 'green' ? '#166534' : '#854d0e', 
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
          <div style={{ fontSize: 12, color: C.muted }}>{tx.container_id}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{new Date(tx.timestamp).toLocaleString('fr-FR')}</div>
        </div>
      </div>
      {isD && tx.nut_coins_delta > 0 && (
        <span style={{ color: C.primary, fontWeight: 700, fontSize: 14 }}>+{tx.nut_coins_delta} 🌰</span>
      )}
    </div>
  )
}

export default function ClientDashboard() {
  const { profile, logout, refreshProfile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [containers, setContainers] = useState([])
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [c, t] = await Promise.all([
        containerRepo.getByClient(profile.id),
        transactionRepo.getByClient(profile.id),
      ])
      setContainers(c)
      setTxs(t)
    } catch (err) {
      console.error('Erreur chargement:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [profile])

  // Realtime
  useEffect(() => {
    if (!profile) return
    const channel = supabase.channel('client-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => {
        load()
        refreshProfile()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  const qrCode = `NUT:CLIENT:${profile?.id}`
  const totalEarned = txs.reduce((s, t) => s + (t.nut_coins_delta || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: C.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-header.png" alt="NUT" style={{ height: 36, objectFit: 'contain' }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>NUT</div>
            <div style={{ color: '#a7f3d0', fontSize: 12 }}>Espace client</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{profile?.name}</span>
          <button style={{ ...s.btn('ghost', true), background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
        {/* NutCoins hero */}
        <div style={{ ...s.card, background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, color: '#fff', textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 40 }}>🌰</div>
          <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1 }}>{profile?.nut_coins ?? 0}</div>
          <div style={{ fontSize: 16, opacity: 0.85, marginTop: 4 }}>NutCoins</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>Gagnez des points en rendant vos contenants</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['overview', '📊 Aperçu'], ['containers', '📦 Contenants'], ['history', '📋 Historique'], ['qr', '🔳 Mon QR']].map(([k, l]) => (
            <button key={k} style={{ ...s.btn(tab === k ? 'primary' : 'ghost', true), flex: 1, fontSize: 12 }} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>⏳ Chargement...</div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <div style={{ ...s.card, display: 'flex', gap: 16 }}>
                  {[
                    { val: containers.length, label: 'contenants en cours' },
                    { val: txs.filter(t => t.type === 'deconsigne').length, label: 'déconsignes' },
                    { val: totalEarned, label: 'coins gagnés' },
                  ].map(({ val, label }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{val}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
                    </div>
                  ))}
                </div>
                <h3 style={{ margin: '0 0 12px' }}>Dernières transactions</h3>
                {txs.slice(0, 5).map(tx => <TxRow key={tx.id} tx={tx} />)}
                {txs.length === 0 && <p style={{ color: C.muted }}>Aucune transaction.</p>}
              </>
            )}

            {tab === 'containers' && (
              <>
                <h3 style={{ margin: '0 0 12px' }}>Mes contenants ({containers.length})</h3>
                {containers.length === 0
                  ? <p style={{ color: C.muted }}>Aucun contenant en cours.</p>
                  : containers.map(c => (
                    <div key={c.id} style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>📦 {c.container_type}</div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>ID : {c.id}</div>
                        </div>
                        <span style={s.badge('amber')}>En cours</span>
                      </div>
                    </div>
                  ))
                }
              </>
            )}

            {tab === 'history' && (
              <>
                <h3 style={{ margin: '0 0 12px' }}>Historique ({txs.length})</h3>
                {txs.length === 0
                  ? <p style={{ color: C.muted }}>Aucune transaction.</p>
                  : txs.map(tx => <TxRow key={tx.id} tx={tx} />)
                }
              </>
            )}

            {tab === 'qr' && (
              <div style={{ ...s.card, textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px' }}>Mon QR Code client</h3>
                <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px' }}>
                  Présentez ce code à l'entreprise lors d'une consigne ou déconsigne.
                </p>
                <div style={{ background: '#fff', border: `2px solid ${C.border}`, borderRadius: 16, padding: 24, maxWidth: 280, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
                  <QRCodeSVG 
                    value={qrCode} 
                    size={200}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
            )}
            
          </>
        )}
      </div>
    </div>
  )
}