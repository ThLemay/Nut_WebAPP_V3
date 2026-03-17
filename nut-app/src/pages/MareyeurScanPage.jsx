import { useState, useEffect, useRef, useCallback } from 'react'
import { parseQR } from '../domain/parseQR'
import { crateRepo } from '../data/repos/crateRepo'
import { crateMovementRepo } from '../data/repos/crateMovementRepo'
import { supabase } from '../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'

const C = {
  bg: '#f0f7fa', card: '#ffffff', primary: '#0e7490', primaryLight: '#e0f2fe',
  accent: '#f59e0b', muted: '#6b7280', border: '#e5e7eb',
  success: '#d1fae5', successText: '#065f46', error: '#fee2e2', errorText: '#991b1b',
}

const s = {
  card: { background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 },
  btn: (v = 'primary', sm = false) => ({
    background: v === 'primary' ? C.primary : v === 'accent' ? C.accent : v === 'danger' ? '#ef4444' : '#f3f4f6',
    color: v === 'ghost' ? '#1b1b1b' : '#fff',
    border: 'none', borderRadius: 10,
    padding: sm ? '8px 14px' : '12px 20px',
    fontWeight: 600, fontSize: sm ? 13 : 15, cursor: 'pointer',
  }),
}

const ACTIONS = [
  { key: 'sortie', label: '📤 Sortie', desc: 'Envoyer à un pêcheur ou GMS', needsDest: true },
  { key: 'retour', label: '📥 Retour', desc: 'Caisse revient en stock', needsDest: false },
  { key: 'transfert', label: '🔄 Transfert', desc: 'Transférer à un mareyeur', needsDest: true },
  { key: 'casse', label: '💔 Cassée', desc: 'Marquer comme cassée', needsDest: false },
  { key: 'perdu', label: '❓ Perdue', desc: 'Marquer comme perdue', needsDest: false },
]

export default function MareyeurScanPage({ profile, onBack, onDone }) {
  // Scanner state
  const scannerRef = useRef(null)
  const processingRef = useRef(false)
  const [scannerReady, setScannerReady] = useState(false)

  // Batch state
  const [scannedCrates, setScannedCrates] = useState([])
  const [action, setAction] = useState(null)
  const [destinataire, setDestinataire] = useState('')
  const [destinataires, setDestinataires] = useState([])

  // UI state
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('scan') // scan → action → validate

  // Charger les destinataires potentiels
  useEffect(() => {
    const loadDestinataires = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['pecheur', 'gms', 'mareyeur'])
        .neq('id', profile.id)
        .order('name')
      setDestinataires(data || [])
    }
    loadDestinataires()
  }, [profile.id])

  // Filtrer les destinataires selon l'action
  const filteredDestinataires = destinataires.filter(d => {
    if (action === 'sortie') return d.role === 'pecheur' || d.role === 'gms'
    if (action === 'transfert') return d.role === 'mareyeur'
    return false
  })

  // ===== Scanner lifecycle (mêmes fixes que ScanPage) =====
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2 || state === 3) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (err) {
        console.warn('Scanner stop:', err)
      }
      scannerRef.current = null
      setScannerReady(false)
    }
  }, [])

  const handleScan = useCallback(async (decodedText) => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      const r = parseQR(decodedText)

      // Accepter les QR de type caisse, ou tenter en brut
      let qrCode = null
      if (r.type === 'caisse') {
        qrCode = r.id
      } else if (r.type === 'unknown') {
        // Tenter comme qr_code brut
        qrCode = r.id
      } else if (!r.error) {
        // Tenter le texte brut du QR comme qr_code
        qrCode = decodedText.trim()
      } else {
        qrCode = decodedText.trim()
      }

      // Vérifier doublon dans le lot
      if (scannedCrates.some(c => c.qr_code === qrCode)) {
        setStatus({ type: 'error', msg: `⚠️ ${qrCode} déjà scanné` })
        return
      }

      // Chercher la caisse en base
      const crate = await crateRepo.getByQrCode(qrCode)

      if (!crate) {
        setStatus({ type: 'error', msg: `Caisse ${qrCode} introuvable` })
        return
      }

      // Ajouter au lot
      setScannedCrates(prev => [...prev, crate])
      setStatus({ type: 'success', msg: `✅ ${crate.qr_code} (${crate.crate_type}) ajoutée` })

      // Feedback vibration
      if (navigator.vibrate) navigator.vibrate(100)

    } catch (e) {
      setStatus({ type: 'error', msg: `Caisse introuvable` })
    } finally {
      setTimeout(() => { processingRef.current = false }, 1200)
    }
  }, [scannedCrates])

  // Ref pour handleScan à jour dans le callback du scanner
  const handleScanRef = useRef(handleScan)
  useEffect(() => { handleScanRef.current = handleScan }, [handleScan])

  const startScanner = useCallback(async () => {
    await stopScanner()
    await new Promise(r => setTimeout(r, 400))

    const el = document.getElementById('qr-scanner-maree')
    if (!el) return

    try {
      const html5QrCode = new Html5Qrcode('qr-scanner-maree')
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScanRef.current(decodedText),
        () => {}
      )
      setScannerReady(true)
    } catch (err) {
      console.error('Erreur scanner:', err)
      setStatus({ type: 'error', msg: "Impossible d'accéder à la caméra" })
    }
  }, [stopScanner])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      await new Promise(r => setTimeout(r, 100))
      if (!cancelled) startScanner()
    }
    init()
    return () => { cancelled = true; stopScanner() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Supprimer une caisse du lot =====
  const removeCrate = (qrCode) => {
    setScannedCrates(prev => prev.filter(c => c.qr_code !== qrCode))
  }

  // ===== Valider le lot =====
  const handleValidate = async () => {
    if (scannedCrates.length === 0) return
    if (!action) { setStatus({ type: 'error', msg: 'Sélectionnez une action' }); return }

    const act = ACTIONS.find(a => a.key === action)
    if (act.needsDest && !destinataire) {
      setStatus({ type: 'error', msg: 'Sélectionnez un destinataire' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const crateIds = scannedCrates.map(c => c.id)
      const movements = []

      // Déterminer le nouveau statut et détenteur
      let newStatus, newHolderId
      switch (action) {
        case 'sortie':
          newStatus = 'en_transit'
          newHolderId = destinataire
          break
        case 'retour':
          newStatus = 'en_stock'
          newHolderId = profile.id
          break
        case 'transfert':
          newStatus = 'en_transit'
          newHolderId = destinataire
          break
        case 'casse':
          newStatus = 'casse'
          newHolderId = profile.id
          break
        case 'perdu':
          newStatus = 'perdu'
          newHolderId = profile.id
          break
      }

      // Mettre à jour les caisses en lot
      await crateRepo.updateBatch(crateIds, {
        status: newStatus,
        current_holder_id: newHolderId,
      })

      // Créer les mouvements
      for (const crate of scannedCrates) {
        movements.push({
          crate_id: crate.id,
          type: action,
          from_id: action === 'retour' ? crate.current_holder_id : profile.id,
          to_id: act.needsDest ? destinataire : (action === 'retour' ? profile.id : null),
        })
      }

      await crateMovementRepo.createBatch(movements)

      const destName = filteredDestinataires.find(d => d.id === destinataire)?.name
      const msg = act.needsDest
        ? `✅ ${scannedCrates.length} caisse(s) · ${act.label} → ${destName}`
        : `✅ ${scannedCrates.length} caisse(s) · ${act.label}`

      setStatus({ type: 'success', msg })
      setStep('done')
      stopScanner()

      setTimeout(() => {
        onDone()
      }, 2000)

    } catch (e) {
      console.error('Erreur validation:', e)
      setStatus({ type: 'error', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setScannedCrates([])
    setAction(null)
    setDestinataire('')
    setStatus(null)
    setStep('scan')
    processingRef.current = false
    await startScanner()
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${C.primary}, #155e75)`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{ ...s.btn('ghost', true), background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          onClick={() => { stopScanner(); onBack() }}
        >
          ← Retour
        </button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>📷 Scan caisses</div>
        <div style={{ color: '#a5f3fc', fontSize: 13, marginLeft: 4 }}>{profile.name}</div>
      </header>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>

        {/* Étape 1 : Scanner */}
        {step !== 'done' && (
          <div style={s.card}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, marginBottom: 4 }}>
                📦 Scannez les caisses
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                Scannez une ou plusieurs caisses d'affilée
              </div>
            </div>
            <div id="qr-scanner-maree" style={{ width: '100%', minHeight: 280 }}></div>
            {!scannerReady && (
              <div style={{ textAlign: 'center', padding: 16, color: C.muted, fontSize: 14 }}>
                ⏳ Démarrage de la caméra...
              </div>
            )}
          </div>
        )}

        {/* Liste des caisses scannées */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              📋 Lot scanné ({scannedCrates.length})
            </h3>
            {scannedCrates.length > 0 && step !== 'done' && (
              <button style={s.btn('ghost', true)} onClick={() => setScannedCrates([])}>Vider</button>
            )}
          </div>

          {scannedCrates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: C.muted, fontSize: 14 }}>
              Aucune caisse scannée
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scannedCrates.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                    📦 {c.qr_code} <span style={{ color: C.muted, fontWeight: 400 }}>({c.crate_type})</span>
                  </span>
                  {step !== 'done' && (
                    <button
                      onClick={() => removeCrate(c.qr_code)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ef4444' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Étape 2 : Action */}
        {scannedCrates.length > 0 && step !== 'done' && (
          <div style={s.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>🎯 Choisir l'action</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => { setAction(a.key); setDestinataire('') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: action === a.key ? C.primaryLight : '#fafafa',
                    border: action === a.key ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: action === a.key ? C.primary : '#1b1b1b' }}>
                    {a.label}
                  </span>
                  <span style={{ fontSize: 12, color: C.muted }}>{a.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Étape 2b : Destinataire */}
        {action && ACTIONS.find(a => a.key === action)?.needsDest && step !== 'done' && (
          <div style={s.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>👤 Destinataire</h3>
            <select
              value={destinataire}
              onChange={e => setDestinataire(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${C.border}`, fontSize: 15, background: '#fff',
              }}
            >
              <option value="">— Choisir un destinataire —</option>
              {filteredDestinataires.map(d => (
                <option key={d.id} value={d.id}>
                  {d.role === 'pecheur' ? '🎣' : d.role === 'gms' ? '🏪' : '🐟'} {d.name} ({d.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bouton Valider */}
        {scannedCrates.length > 0 && action && step !== 'done' && (
          <button
            style={{ ...s.btn('accent'), width: '100%', fontSize: 17, padding: '14px 20px', marginBottom: 12 }}
            onClick={handleValidate}
            disabled={loading || (ACTIONS.find(a => a.key === action)?.needsDest && !destinataire)}
          >
            {loading ? '⏳ Validation...' : `✅ Valider ${scannedCrates.length} caisse(s)`}
          </button>
        )}

        {/* Messages */}
        {status && (
          <div style={{
            background: status.type === 'success' ? C.success : C.error,
            color: status.type === 'success' ? C.successText : C.errorText,
            borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 12,
          }}>
            {status.msg}
          </div>
        )}

        {/* Reset */}
        <button
          style={{ ...s.btn('ghost'), border: `1px solid ${C.border}`, width: '100%' }}
          onClick={handleReset}
        >
          🔄 Recommencer
        </button>
      </div>
    </div>
  )
}
