import { useState, useEffect, useRef, useCallback } from 'react'
import { parseQR } from '../domain/parseQR'
import { execConsigne } from '../domain/consigne'
import { execDeconsigne } from '../domain/deconsigne'
import { containerRepo } from '../data/repos/containerRepo'
import { supabase } from '../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'

const C = {
  bg: '#f8faf7', card: '#ffffff', primary: '#2d6a4f', accent: '#f4a261',
  muted: '#6b7280', border: '#e5e7eb',
  success: '#d1fae5', successText: '#065f46', error: '#fee2e2', errorText: '#991b1b',
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
}

function StepBadge({ n, done, active }) {
  const bg = done ? '#d1fae5' : active ? C.primary : C.border
  const color = done ? '#065f46' : active ? '#fff' : C.muted
  return (
    <span style={{ background: bg, color, borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
      {done ? '✓' : n}
    </span>
  )
}

// ─── Popup "aucun contenant" avec compte à rebours ────────────────────────────
function NoContainerPopup({ clientName, onClose }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); onClose(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
    }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 32, maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
        <h3 style={{ margin: '0 0 8px', color: C.primary }}>Aucun contenant</h3>
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px' }}>
          <strong>{clientName}</strong> n'a aucun contenant en cours auprès de cette entreprise.
        </p>
        <div style={{ background: C.bg, borderRadius: 10, padding: '10px 16px', fontSize: 13, color: C.muted }}>
          Retour automatique dans <strong style={{ color: C.primary }}>{countdown}s</strong>
        </div>
      </div>
    </div>
  )
}

export default function ScanPage({ company, onBack, onDone }) {
  const [action, setAction] = useState('deconsigne')

  // ── États communs ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [scannedClient, setScannedClient] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scannerReady, setScannerReady] = useState(false)

  // ── États déconsigne ───────────────────────────────────────────────────────
  const [clientContainers, setClientContainers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [showNoContainer, setShowNoContainer] = useState(false)

  // ── États consigne multiple ────────────────────────────────────────────────
  const [scannedConts, setScannedConts] = useState([])

  // ── Refs scanner ──────────────────────────────────────────────────────────
  const scannerRef = useRef(null)
  const stepRef = useRef(1)
  const actionRef = useRef('deconsigne')
  const processingRef = useRef(false)
  const scannedContsRef = useRef([])

  useEffect(() => { stepRef.current = step }, [step])
  useEffect(() => { actionRef.current = action }, [action])
  useEffect(() => { scannedContsRef.current = scannedConts }, [scannedConts])

  // ─────────────────────────────────────────────────────────────────────────
  // Résolution QR
  // ─────────────────────────────────────────────────────────────────────────
  const resolveQR = (raw, expected) => {
    const direct = parseQR(raw.trim())
    if (!direct.error) return direct
    return parseQR(expected === 'container' ? `NUT:CONT:${raw.trim()}` : `NUT:CLIENT:${raw.trim()}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Gestion scanner
  // ─────────────────────────────────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2 || state === 3) await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        console.warn('Scanner stop/clear:', err)
      }
      scannerRef.current = null
      setScannerReady(false)
    }
  }, [])

  const handleScan = useCallback(async (decodedText) => {
    if (processingRef.current) return
    processingRef.current = true

    const currentStep = stepRef.current
    const currentAction = actionRef.current

    try {

      // ════════════════════════════════════════════════════════════════════
      // DÉCONSIGNE — étape 1 : scan client
      // ════════════════════════════════════════════════════════════════════
      if (currentAction === 'deconsigne' && currentStep === 1) {
        const r = resolveQR(decodedText, 'client')
        if (r.error || r.type !== 'client') {
          setStatus({ type: 'error', msg: 'Scannez un QR code client' })
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, nut_coins')
          .eq('id', r.id)
          .single()

        if (error || !data || data.role !== 'client') {
          setStatus({ type: 'error', msg: 'Client introuvable ou invalide' })
          return
        }

        const allContainers = await containerRepo.getByClient(data.id)
        const companyContainers = allContainers.filter(
          c => c.current_owner_company_id === company.id && c.status === 'in_use'
        )

        setScannedClient(data)
        stopScanner()

        if (companyContainers.length === 0) {
          setShowNoContainer(true)
          return
        }

        setClientContainers(companyContainers)
        setSelectedIds(companyContainers.map(c => c.id))
        setStep(2)
        setStatus(null)
      }

      // ════════════════════════════════════════════════════════════════════
      // CONSIGNE — étape 1 : scan client
      // ════════════════════════════════════════════════════════════════════
      if (currentAction === 'consigne' && currentStep === 1) {
        const r = resolveQR(decodedText, 'client')
        if (r.error || r.type !== 'client') {
          setStatus({ type: 'error', msg: 'Scannez un QR code client' })
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, nut_coins')
          .eq('id', r.id)
          .single()

        if (error || !data || data.role !== 'client') {
          setStatus({ type: 'error', msg: 'Client introuvable ou invalide' })
          return
        }

        setScannedClient(data)
        setStatus({ type: 'success', msg: `✅ ${data.name} identifié — scannez les contenants` })
        setStep(2)
      }

      // ════════════════════════════════════════════════════════════════════
      // CONSIGNE — étape 2 : scan contenants un par un
      // ════════════════════════════════════════════════════════════════════
      if (currentAction === 'consigne' && currentStep === 2) {
        const r = resolveQR(decodedText, 'container')
        if (r.error || r.type !== 'container') {
          setStatus({ type: 'error', msg: 'Scannez un contenant (pas un QR client)' })
          return
        }

        if (scannedContsRef.current.some(c => c.id === r.id)) {
          setStatus({ type: 'error', msg: '⚠️ Ce contenant est déjà dans la liste' })
          return
        }

        const cont = await containerRepo.getById(r.id)

        if (cont.current_owner_company_id !== company.id) {
          setStatus({ type: 'error', msg: 'Ce contenant appartient à une autre entreprise' })
          return
        }

        if (cont.status === 'in_use') {
          setStatus({ type: 'error', msg: '⚠️ Ce contenant est déjà en cours d\'utilisation' })
          return
        }

        setScannedConts(prev => [...prev, cont])
        setStatus({ type: 'success', msg: `✅ ${cont.container_type} ajouté — scannez le suivant ou validez` })
      }

    } catch (e) {
      setStatus({ type: 'error', msg: 'Erreur lors du scan' })
    } finally {
      setTimeout(() => { processingRef.current = false }, 1500)
    }
  }, [company, stopScanner])

  const startScanner = useCallback(async () => {
    await stopScanner()
    await new Promise(resolve => setTimeout(resolve, 400))
    const el = document.getElementById('qr-scanner')
    if (!el) return
    try {
      const html5QrCode = new Html5Qrcode('qr-scanner')
      scannerRef.current = html5QrCode
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText),
        () => {}
      )
      setScannerReady(true)
    } catch (err) {
      console.error('Erreur scanner:', err)
      setStatus({ type: 'error', msg: "Impossible d'accéder à la caméra" })
    }
  }, [handleScan, stopScanner])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      await new Promise(r => setTimeout(r, 100))
      if (!cancelled) startScanner()
    }
    init()
    return () => { cancelled = true; stopScanner() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────
  const handleValidate = async () => {
    setLoading(true)
    setStatus(null)
    try {
      if (action === 'deconsigne') {
        let totalCoins = 0
        for (const containerId of selectedIds) {
          const result = await execDeconsigne({
            companyId: company.id,
            clientId: scannedClient.id,
            containerId,
          })
          totalCoins += result.nutCoinsEarned || 0
        }
        setStatus({
          type: 'success',
          msg: `✅ ${selectedIds.length} déconsigne${selectedIds.length > 1 ? 's' : ''} réussie${selectedIds.length > 1 ? 's' : ''} ! +${totalCoins} 🌰`
        })
      } else {
        for (const cont of scannedConts) {
          await execConsigne({
            companyId: company.id,
            clientId: scannedClient.id,
            containerId: cont.id,
          })
        }
        setStatus({
          type: 'success',
          msg: `✅ ${scannedConts.length} consigne${scannedConts.length > 1 ? 's' : ''} enregistrée${scannedConts.length > 1 ? 's' : ''} !`
        })
      }
      onDone()
      setTimeout(handleReset, 2500)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setScannedClient(null)
    setScannedConts([])
    setClientContainers([])
    setSelectedIds([])
    setStatus(null)
    setStep(1)
    setShowNoContainer(false)
    processingRef.current = false
    await startScanner()
  }

  const removeContenant = (id) => setScannedConts(prev => prev.filter(c => c.id !== id))

  const toggleContainer = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const needsScanner = step === 1 || (action === 'consigne' && step === 2)

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {showNoContainer && (
        <NoContainerPopup clientName={scannedClient?.name} onClose={handleReset} />
      )}

      <header style={{ background: C.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{ ...s.btn('ghost', true), background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
          onClick={() => { stopScanner(); onBack() }}
        >
          ← Retour
        </button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>📷 Scanner</div>
        <div style={{ color: '#a7f3d0', fontSize: 13, marginLeft: 4 }}>{company.name}</div>
      </header>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>

        {/* Sélecteur d'action */}
        <div style={s.card}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 10 }}>
            Type d'opération
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['consigne', 'deconsigne'].map(a => (
              <button key={a}
                style={{ ...s.btn(action === a ? 'primary' : 'ghost'), flex: 1 }}
                onClick={() => { setAction(a); handleReset() }}
              >
                {a === 'consigne' ? '📦 Consigne' : '♻️ Déconsigne'}
              </button>
            ))}
          </div>
        </div>

        {/* Zone de scan caméra */}
        {needsScanner && (
          <div style={s.card}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, marginBottom: 4 }}>
                {step === 1 ? '👤 Scannez le QR code du client' : '📦 Scannez un contenant'}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                {step === 1
                  ? 'Présentez le QR code client devant la caméra'
                  : 'Scannez autant de contenants que nécessaire, puis validez'}
              </div>
            </div>
            <div id="qr-scanner" style={{ width: '100%', minHeight: 300 }}></div>
            {!scannerReady && (
              <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 14 }}>
                ⏳ Démarrage de la caméra...
              </div>
            )}
          </div>
        )}

        {/* ══ CONSIGNE étape 2 : liste des contenants scannés ══ */}
        {action === 'consigne' && step === 2 && (
          <>
            <div style={{ ...s.card, background: '#f0fdf4', border: `1px solid #bbf7d0` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StepBadge n={1} done active={false} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{scannedClient?.name}</div>
                  <div style={{ fontSize: 13, color: C.muted }}>🌰 {scannedClient?.nut_coins} NutCoins actuels</div>
                </div>
              </div>
            </div>

            {scannedConts.length > 0 && (
              <div style={s.card}>
                <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>
                  Contenants à consigner ({scannedConts.length})
                </h3>
                {scannedConts.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                    border: `1.5px solid ${C.primary}`, background: '#f0fdf4',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>📦 {c.container_type}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.id}</div>
                    </div>
                    <button
                      style={{ ...s.btn('ghost', true), fontSize: 12, padding: '4px 10px', color: '#991b1b', border: 'none', background: '#fee2e2' }}
                      onClick={() => removeContenant(c.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  style={{ ...s.btn('accent'), width: '100%', fontSize: 16, padding: '14px 20px', marginTop: 8 }}
                  onClick={handleValidate}
                  disabled={loading}
                >
                  {loading
                    ? '⏳ Validation...'
                    : `✅ Valider ${scannedConts.length > 1 ? `les ${scannedConts.length} consignes` : 'la consigne'}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ══ DÉCONSIGNE étape 2 : liste avec cases à cocher ══ */}
        {action === 'deconsigne' && step === 2 && (
          <>
            <div style={{ ...s.card, background: '#f0fdf4', border: `1px solid #bbf7d0` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>👤</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{scannedClient?.name}</div>
                  <div style={{ fontSize: 13, color: C.muted }}>🌰 {scannedClient?.nut_coins} NutCoins actuels</div>
                </div>
              </div>
            </div>

            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>
                  Contenants à rendre ({clientContainers.length})
                </h3>
                <button
                  style={{ ...s.btn('ghost', true), fontSize: 12, padding: '4px 10px' }}
                  onClick={() =>
                    selectedIds.length === clientContainers.length
                      ? setSelectedIds([])
                      : setSelectedIds(clientContainers.map(c => c.id))
                  }
                >
                  {selectedIds.length === clientContainers.length ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </div>

              {clientContainers.map(c => (
                <label key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                  border: `1.5px solid ${selectedIds.includes(c.id) ? C.primary : C.border}`,
                  background: selectedIds.includes(c.id) ? '#f0fdf4' : C.bg,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleContainer(c.id)}
                    style={{ width: 18, height: 18, accentColor: C.primary, cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>📦 {c.container_type}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      Depuis le {new Date(c.updated_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  {selectedIds.includes(c.id) && (
                    <span style={{ color: C.primary, fontWeight: 700, fontSize: 13 }}>
                      +{company.points_per_deconsigne} 🌰
                    </span>
                  )}
                </label>
              ))}

              {selectedIds.length > 0 && (
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: C.muted }}>
                    {selectedIds.length} contenant{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
                  </span>
                  <span style={{ fontWeight: 700, color: C.primary, fontSize: 15 }}>
                    +{selectedIds.length * company.points_per_deconsigne} 🌰
                  </span>
                </div>
              )}
            </div>

            <button
              style={{ ...s.btn('accent'), width: '100%', fontSize: 16, padding: '14px 20px', marginBottom: 12, opacity: selectedIds.length === 0 ? 0.5 : 1 }}
              onClick={handleValidate}
              disabled={loading || selectedIds.length === 0}
            >
              {loading
                ? '⏳ Validation...'
                : `✅ Valider ${selectedIds.length > 1 ? `les ${selectedIds.length} déconsignes` : 'la déconsigne'}`}
            </button>
          </>
        )}

        {/* Messages status */}
        {status && (
          <div style={{
            background: status.type === 'success' ? C.success : C.error,
            color: status.type === 'success' ? C.successText : C.errorText,
            borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 12
          }}>
            {status.msg}
          </div>
        )}

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