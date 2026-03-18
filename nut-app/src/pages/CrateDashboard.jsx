import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { crateRepo } from '../data/repos/crateRepo'
import { crateMovementRepo } from '../data/repos/crateMovementRepo'
import { supabase } from '../lib/supabase'
import CrateScanPage from './CrateScanPage'

const C = {
  bg: '#f0f7fa', card: '#ffffff', primary: '#0e7490', primaryLight: '#e0f2fe',
  accent: '#f59e0b', muted: '#6b7280', border: '#e5e7eb',
}

const s = {
  card: { background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 },
  btn: (v = 'primary', sm = false) => ({
    background: v === 'primary' ? C.primary : v === 'accent' ? C.accent : '#f3f4f6',
    color: v === 'ghost' ? '#1b1b1b' : '#fff',
    border: 'none', borderRadius: 10,
    padding: sm ? '8px 14px' : '12px 20px',
    fontWeight: 600, fontSize: sm ? 13 : 15, cursor: 'pointer',
  }),
}

const STATUS_LABELS = {
  en_stock: { label: '📦 En stock', color: '#10b981', bg: '#d1fae5' },
  en_transit: { label: '🚚 En transit', color: '#3b82f6', bg: '#dbeafe' },
  casse: { label: '💔 Cassée', color: '#ef4444', bg: '#fee2e2' },
  perdu: { label: '❓ Perdue', color: '#6b7280', bg: '#f3f4f6' },
}

const ROLE_CONFIG = {
  mareyeur: { icon: '🐟', label: 'Mareyeur', gradient: 'linear-gradient(135deg, #0e7490, #155e75)', sub: '#a5f3fc' },
  pecheur:  { icon: '🎣', label: 'Pêcheur',  gradient: 'linear-gradient(135deg, #0369a1, #075985)', sub: '#bae6fd' },
  gms:      { icon: '🏪', label: 'GMS',       gradient: 'linear-gradient(135deg, #7c3aed, #5b21b6)', sub: '#ddd6fe' },
}

const MOVEMENT_ICONS = { sortie: '📤', retour: '📥', casse: '💔', perdu: '❓' }

export default function CrateDashboard() {
  const { profile, logout } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [summary, setSummary] = useState({ en_stock: 0, en_transit: 0, casse: 0, perdu: 0, total: 0 })
  const [crates, setCrates] = useState([])
  const [holders, setHolders] = useState({}) // Map id → { name, role }
  const [movements, setMovements] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const roleConf = ROLE_CONFIG[profile.role] || ROLE_CONFIG.mareyeur

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, c, m] = await Promise.all([
        crateRepo.getStockSummary(profile.id),
        crateRepo.getAllVisible(profile.id),
        crateMovementRepo.getByActor(profile.id, 20),
      ])
      setSummary(s)
      setCrates(c)
      setMovements(m)

      // Charger les noms de tous les acteurs liés (holders + owners)
      const relatedIds = [...new Set(
        c.flatMap(cr => [cr.current_holder_id, cr.owner_id])
          .filter(id => id && id !== profile.id)
      )]
      if (relatedIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name, role')
          .in('id', relatedIds)
        const map = {}
        profileData?.forEach(p => { map[p.id] = p })
        setHolders(map)
      }
    } catch (e) {
      console.error('Erreur chargement:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('crate-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crates' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crate_movements' }, () => loadData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (page === 'scan') {
    return (
      <CrateScanPage
        profile={profile}
        onBack={() => setPage('dashboard')}
        onDone={() => { loadData(); setPage('dashboard') }}
      />
    )
  }

  const filteredCrates = filter === 'all' ? crates : crates.filter(c => c.status === filter)

  const ROLE_ICONS = { mareyeur: '🐟', pecheur: '🎣', gms: '🏪' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: roleConf.gradient, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>{roleConf.icon} {profile.name}</div>
          <div style={{ color: roleConf.sub, fontSize: 13 }}>{roleConf.label} · Gestion des caisses</div>
        </div>
        <button style={s.btn('ghost', true)} onClick={logout}>Déconnexion</button>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
        {/* Bouton Scanner */}
        <button
          style={{ ...s.btn('accent'), width: '100%', fontSize: 18, padding: '16px 20px', marginBottom: 20 }}
          onClick={() => setPage('scan')}
        >
          📷 Scanner des caisses
        </button>

        {/* Stock Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          {Object.entries(STATUS_LABELS).map(([key, { label, color, bg }]) => (
            <div key={key} style={{ ...s.card, marginBottom: 0, textAlign: 'center', borderLeft: `4px solid ${color}` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{summary[key]}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ ...s.card, textAlign: 'center', background: C.primaryLight, marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: C.primary, fontWeight: 600 }}>Total caisses</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.primary }}>{summary.total}</div>
        </div>

        {/* Liste des caisses */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📦 Mes caisses</h3>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
            >
              <option value="all">Toutes ({crates.length})</option>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label} ({summary[key]})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>⏳ Chargement...</div>
          ) : filteredCrates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>Aucune caisse trouvée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredCrates.map(c => {
                const st = STATUS_LABELS[c.status]
                // Pour les caisses en transit, afficher l'autre partie
                let transitBadge = null
                if (c.status === 'en_transit') {
                  if (c.current_holder_id !== profile.id) {
                    // J'ai envoyé cette caisse → montrer le destinataire
                    const dest = holders[c.current_holder_id]
                    if (dest) transitBadge = { arrow: '→', person: dest }
                  } else if (c.owner_id && c.owner_id !== profile.id) {
                    // J'ai reçu cette caisse → montrer l'expéditeur
                    const sender = holders[c.owner_id]
                    if (sender) transitBadge = { arrow: '←', person: sender }
                  }
                }
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: transitBadge ? '#f0f4ff' : '#fafafa', borderRadius: 10 }}>
                    <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.qr_code}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{c.crate_type}</div>
                    </div>
                    {transitBadge ? (
                      <div style={{
                        fontSize: 12, color: '#3b82f6', fontWeight: 600,
                        background: '#eff6ff', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap'
                      }}>
                        {transitBadge.arrow} {ROLE_ICONS[transitBadge.person.role] || '👤'} {transitBadge.person.name}
                      </div>
                    ) : c.updated_at && (
                      <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                        {new Date(c.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Derniers mouvements */}
        <div style={s.card}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>📋 Derniers mouvements</h3>
          {movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>Aucun mouvement</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {movements.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafafa', borderRadius: 10, fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>{MOVEMENT_ICONS[m.type] || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {m.type.charAt(0).toUpperCase() + m.type.slice(1)} · {m.crate?.qr_code}
                    </div>
                    <div style={{ color: C.muted, fontSize: 12 }}>
                      {m.from?.name || '—'} → {m.to?.name || '—'}
                      {m.notes && ` · ${m.notes}`}
                    </div>
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, whiteSpace: 'nowrap' }}>
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
