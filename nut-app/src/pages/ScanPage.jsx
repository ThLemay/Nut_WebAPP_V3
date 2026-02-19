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

export default function ScanPage({ company, onBack, onDone }) {
  const [action, setAction] = useState('consigne')
  const [step, setStep] = useState(1)
  const [scannedCont, setScannedCont] = useState(null)
  const [scannedClient, setScannedClient] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scannerReady, setScannerReady] = useState(false)

  // ===== FIX 1 : Refs pour le scanner et le step =====
  // On utilise des refs pour que le callback du scanner ait toujours
  // accès aux valeurs ACTUELLES (pas celles capturées au montage)
  const scannerRef = useRef(null)
  const stepRef = useRef(1)
  const processingRef = useRef(false) // Anti-double-scan

  // Garder stepRef synchronisé avec step
  useEffect(() => {
    stepRef.current = step
  }, [step])

  const resolveQR = (raw, expected) => {
    const direct = parseQR(raw.trim())
    if (!direct.error) return direct
    return parseQR(expected === 'container' ? `NUT:CONT:${raw.trim()}` : `NUT:CLIENT:${raw.trim()}`)
  }

  // ===== FIX 2 : handleScan lit stepRef.current =====
  const handleScan = useCallback(async (decodedText) => {
    // Empêcher les scans multiples simultanés
    if (processingRef.current) return
    processingRef.current = true

    const currentStep = stepRef.current

    try {
      if (currentStep === 1) {
        const r = resolveQR(decodedText, 'container')
        if (r.error) {
          setStatus({ type: 'error', msg: r.error })
          return
        }
        if (r.type !== 'container') {
          setStatus({ type: 'error', msg: 'Scannez un contenant, pas un client' })
          return
        }

        const cont = await containerRepo.getById(r.id)

        if (cont.current_owner_company_id !== company.id) {
          setStatus({ type: 'error', msg: 'Ce contenant appartient à une autre entreprise' })
          return
        }

        setScannedCont(cont)
        setStatus({ type: 'success', msg: `✅ ${cont.container_type} détecté` })
        setStep(2)

      } else if (currentStep === 2) {
        const r = resolveQR(decodedText, 'client')
        if (r.error) {
          setStatus({ type: 'error', msg: r.error })
          return
        }
        if (r.type !== 'client') {
          setStatus({ type: 'error', msg: 'Scannez un QR client' })
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, nut_coins')
          .eq('id', r.id)
          .single()

        if (error || !data) {
          setStatus({ type: 'error', msg: 'Client introuvable' })
          return
        }
        if (data.role !== 'client') {
          setStatus({ type: 'error', msg: 'Utilisateur invalide' })
          return
        }

        setScannedClient(data)
        setStatus({ type: 'success', msg: `✅ ${data.name} détecté` })
        setStep(3)

        // Stopper le scanner à l'étape 3 (plus besoin de la caméra)
        stopScanner()
      }
    } catch (e) {
      setStatus({ type: 'error', msg: currentStep === 1 ? 'Contenant introuvable' : 'Erreur lors du scan client' })
    } finally {
      // Petit délai avant de ré-autoriser un scan (évite les doublons)
      setTimeout(() => { processingRef.current = false }, 1500)
    }
  }, [company])

  // ===== FIX 3 : Fonctions scanner avec ref =====
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (err) {
        console.warn('Scanner stop/clear:', err)
      }
      scannerRef.current = null
      setScannerReady(false)
    }
  }, [])

  const startScanner = useCallback(async () => {
    // S'assurer qu'il n'y a pas déjà un scanner actif
    await stopScanner()

    // Attendre que le DOM soit prêt
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
        () => {} // Ignorer les erreurs de frames sans QR
      )

      setScannerReady(true)
    } catch (err) {
      console.error('Erreur scanner:', err)
      setStatus({ type: 'error', msg: "Impossible d'accéder à la caméra" })
    }
  }, [handleScan, stopScanner])

  // ===== FIX 4 : useEffect avec cleanup propre =====
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      // Petit délai pour laisser le DOM se stabiliser (StrictMode-safe)
      await new Promise(r => setTimeout(r, 100))
      if (!cancelled) {
        startScanner()
      }
    }

    init()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleValidate = async () => {
    setLoading(true)
    setStatus(null)
    try {
      if (action === 'consigne') {
        await execConsigne({ companyId: company.id, clientId: scannedClient.id, containerId: scannedCont.id })
        setStatus({ type: 'success', msg: `✅ Consigne enregistrée !` })
      } else {
        const result = await execDeconsigne({ companyId: company.id, clientId: scannedClient.id, containerId: scannedCont.id })
        setStatus({ type: 'success', msg: `✅ Déconsigne réussie ! +${result.nutCoinsEarned} 🌰` })
      }
      onDone()
      setTimeout(handleReset, 2000)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setScannedCont(null)
    setScannedClient(null)
    setStatus(null)
    setStep(1)
    processingRef.current = false
    // Redémarrer le scanner si on revient aux étapes de scan
    await startScanner()
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ background: C.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ ...s.btn('ghost', true), background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={() => { stopScanner(); onBack() }}>
          ← Retour
        </button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>📷 Scanner</div>
        <div style={{ color: '#a7f3d0', fontSize: 13, marginLeft: 4 }}>{company.name}</div>
      </header>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>
        <div style={s.card}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 10 }}>Type d'opération</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['consigne', 'deconsigne'].map(a => (
              <button key={a} style={{ ...s.btn(action === a ? 'primary' : 'ghost'), flex: 1 }}
                onClick={() => { setAction(a); handleReset() }}>
                {a === 'consigne' ? '📦 Consigne' : '♻️ Déconsigne'}
              </button>
            ))}
          </div>
        </div>

        {/* Zone de scan unique */}
        {step < 3 && (
          <div style={s.card}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, marginBottom: 4 }}>
                {step === 1 ? '📦 Scannez le contenant' : '👤 Scannez le QR client'}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                {step === 1 ? 'Présentez le QR du contenant devant la caméra' : 'Présentez le QR client devant la caméra'}
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

        {/* Infos scannées */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StepBadge n={1} done={step > 1} active={step === 1} />
            <span style={{ fontWeight: 700 }}>Contenant</span>
          </div>
          {scannedCont ? (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
              📦 <strong>{scannedCont.container_type}</strong> · <span style={{ color: C.muted }}>{scannedCont.id}</span>
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 14 }}>En attente de scan...</div>
          )}
        </div>

        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StepBadge n={2} done={step > 2} active={step === 2} />
            <span style={{ fontWeight: 700 }}>Client</span>
          </div>
          {scannedClient ? (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
              👤 <strong>{scannedClient.name}</strong> · 🌰 {scannedClient.nut_coins} coins
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 14 }}>En attente de scan...</div>
          )}
        </div>

        {/* Validation */}
        {step === 3 && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <StepBadge n={3} done={false} active={true} />
              <span style={{ fontWeight: 700 }}>Confirmer l'opération</span>
            </div>
            <div style={{ background: '#f8faff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14, lineHeight: 1.8 }}>
              <div>🔄 <strong>{action === 'consigne' ? 'Consigne' : 'Déconsigne'}</strong></div>
              <div>📦 {scannedCont?.container_type} ({scannedCont?.id})</div>
              <div>👤 {scannedClient?.name}</div>
              <div>🏢 {company.name}</div>
              {action === 'deconsigne' && (
                <div style={{ color: C.primary, fontWeight: 700, marginTop: 4 }}>
                  +{company.points_per_deconsigne} 🌰 NutCoins
                </div>
              )}
            </div>
            <button style={{ ...s.btn('accent'), width: '100%', marginBottom: 8 }} onClick={handleValidate} disabled={loading}>
              {loading ? '⏳ Validation...' : '✅ Valider'}
            </button>
          </div>
        )}

        {/* Messages */}
        {status && (
          <div style={{ background: status.type === 'success' ? C.success : C.error, color: status.type === 'success' ? C.successText : C.errorText, borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 12 }}>
            {status.msg}
          </div>
        )}

        <button style={{ ...s.btn('ghost'), border: `1px solid ${C.border}` }} onClick={handleReset}>
          🔄 Recommencer
        </button>
      </div>
    </div>
  )
}
