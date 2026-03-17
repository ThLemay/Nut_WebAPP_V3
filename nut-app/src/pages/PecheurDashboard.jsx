import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { crateRepo } from '../data/repos/crateRepo'
import { crateMovementRepo } from '../data/repos/crateMovementRepo'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#f0f7fa', card: '#ffffff', primary: '#0369a1', primaryLight: '#e0f2fe',
  accent: '#f59e0b', muted: '#6b7280', border: '#e5e7eb',
}

const s = {
  card: { background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 },
}

const MOVEMENT_ICONS = { sortie: '📤', retour: '📥', transfert: '🔄', casse: '💔', perdu: '❓' }

export default function PecheurDashboard() {
  const { profile, logout } = useAuth()
  const [crates, setCrates] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([
        crateRepo.getByHolder(profile.id),
        crateMovementRepo.getByActor(profile.id, 20),
      ])
      setCrates(c.filter(cr => cr.status === 'en_transit'))
      setMovements(m)
    } catch (e) {
      console.error('Erreur:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('pecheur-crates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crates' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crate_movements' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: `linear-gradient(135deg, ${C.primary}, #075985)`, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>🎣 {profile.name}</div>
          <div style={{ color: '#bae6fd', fontSize: 13 }}>Pêcheur</div>
        </div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Déconnexion
        </button>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
        {/* Compteur */}
        <div style={{ ...s.card, textAlign: 'center', background: C.primaryLight }}>
          <div style={{ fontSize: 14, color: C.primary, fontWeight: 600 }}>Caisses en ma possession</div>
          <div style={{ fontSize: 42, fontWeight: 800, color: C.primary }}>{crates.length}</div>
        </div>

        {/* Liste caisses */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>📦 Mes caisses</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>⏳ Chargement...</div>
          ) : crates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>Aucune caisse en votre possession</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {crates.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fafafa', borderRadius: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>📦 {c.qr_code}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>({c.crate_type})</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>
                    de {c.owner?.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historique */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>📋 Historique</h3>
          {movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>Aucun mouvement</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {movements.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafafa', borderRadius: 10, fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>{MOVEMENT_ICONS[m.type]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{m.type.charAt(0).toUpperCase() + m.type.slice(1)} · {m.crate?.qr_code}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{m.from?.name} → {m.to?.name}</div>
                  </div>
                  <div style={{ color: C.muted, fontSize: 11 }}>
                    {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
