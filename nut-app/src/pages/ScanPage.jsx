import { useState } from 'react'
import { parseQR } from '../domain/parseQR'
import { execConsigne } from '../domain/consigne'
import { execDeconsigne } from '../domain/deconsigne'
import { containerRepo } from '../data/repos/containerRepo'
import { supabase } from '../lib/supabase'

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
  input: { width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
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
  const [contInput, setContInput] = useState('')
  const [clientInput, setClientInput] = useState('')
  const [scannedCont, setScannedCont] = useState(null)
  const [scannedClient, setScannedClient] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const resolveQR = (raw, expected) => {
    const direct = parseQR(raw.trim())
    if (!direct.error) return direct
    const prefixed = parseQR(expected === 'container' ? `NUT:CONT:${raw.trim()}` : `NUT:CLIENT:${raw.trim()}`)
    return prefixed
  }

  const handleContScan = async () => {
    const r = resolveQR(contInput, 'container')
    if (r.error) { setStatus({ type: 'error', msg: r.error }); return }
    if (r.type !== 'container') { setStatus({ type: 'error', msg: 'Ce code est un QR client, pas un contenant.' }); return }
    try {
      const cont = await containerRepo.getById(r.id)
      setScannedCont(cont)
      setStatus({ type: 'success', msg: `✅ Contenant : ${cont.container_type} (${cont.id})` })
      setStep(2)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message })
    }
  }

  const handleClientScan = async () => {
    const r = resolveQR(clientInput, 'client')
    if (r.error) { setStatus({ type: 'error', msg: r.error }); return }
    if (r.type !== 'client') { setStatus({ type: 'error', msg: 'Ce code est un QR contenant, pas un client.' }); return }
    try {
      const { data, error } = await supabase.from('profiles').select('id, name, role, nut_coins').eq('id', r.id).single()
      if (error || !data) throw new Error(`Client introuvable : ${r.id}`)
      if (data.role !== 'client') throw new Error("L'utilisateur scanné n'est pas un client.")
      setScannedClient(data)
      setStatus({ type: 'success', msg: `✅ Client : ${data.name} (🌰 ${data.nut_coins} coins)` })
      setStep(3)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message })
    }
  }

  const handleValidate = async () => {
    setLoading(true)
    setStatus(null)
    try {
      let result
      if (action === 'consigne') {
        result = await execConsigne({ companyId: company.id, clientId: scannedClient.id, containerId: scannedCont.id })
        setStatus({ type: 'success', msg: `✅ Consigne enregistrée ! Contenant ${scannedCont.id} attribué à ${scannedClient.name}.` })
      } else {
        result = await execDeconsigne({ companyId: company.id, clientId: scannedClient.id, containerId: scannedCont.id })
        setStatus({ type: 'success', msg: `✅ Déconsigne réussie ! +${result.nutCoinsEarned} 🌰 attribués à ${scannedClient.name}.` })
      }
      onDone()
      setTimeout(handleReset, 2500)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setContInput(''); setClientInput('')
    setScannedCont(null); setScannedClient(null)
    setStatus(null); setStep(1)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ background: C.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ ...s.btn('ghost', true), background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={onBack}>
          ← Retour
        </button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>📷 Scan</div>
        <div style={{ color: '#a7f3d0', fontSize: 13, marginLeft: 4 }}>{company.name}</div>
      </header>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>
        {/* Sélection action */}
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

        {/* Étape 1 */}
        <div style={{ ...s.card, opacity: step >= 1 ? 1 : 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StepBadge n={1} done={step > 1} active={step === 1} />
            <span style={{ fontWeight: 700 }}>Scanner le contenant</span>
          </div>
          {scannedCont && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 14 }}>
              📦 <strong>{scannedCont.container_type}</strong> · <span style={{ color: C.muted }}>{scannedCont.id}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder='NUT:CONT:box001 ou box001'
              value={contInput} onChange={e => setContInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && step === 1 && handleContScan()}
              disabled={step > 1} />
            <button style={s.btn('primary', true)} onClick={handleContScan} disabled={step > 1}>OK</button>
          </div>
        </div>

        {/* Étape 2 */}
        <div style={{ ...s.card, opacity: step >= 2 ? 1 : 0.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StepBadge n={2} done={step > 2} active={step === 2} />
            <span style={{ fontWeight: 700 }}>Scanner le client</span>
          </div>
          {scannedClient && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 14 }}>
              👤 <strong>{scannedClient.name}</strong> · 🌰 {scannedClient.nut_coins} coins
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder='NUT:CLIENT:uuid ou uuid'
              value={clientInput} onChange={e => setClientInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && step === 2 && handleClientScan()}
              disabled={step !== 2} />
            <button style={s.btn('primary', true)} onClick={handleClientScan} disabled={step !== 2}>OK</button>
          </div>
        </div>

        {/* Étape 3 */}
        {step === 3 && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <StepBadge n={3} done={false} active={true} />
              <span style={{ fontWeight: 700 }}>Confirmer l'opération</span>
            </div>
            <div style={{ background: '#f8faff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14, lineHeight: 1.8 }}>
              <div>🔄 <strong>{action === 'consigne' ? 'Consigne' : 'Déconsigne'}</strong></div>
              <div>📦 {scannedCont?.container_type} <span style={{ color: C.muted }}>({scannedCont?.id})</span></div>
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

        {/* Feedback */}
        {status && (
          <div style={{ background: status.type === 'success' ? C.success : C.error, color: status.type === 'success' ? C.successText : C.errorText, borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 12 }}>
            {status.msg}
          </div>
        )}

        <button style={{ ...s.btn('ghost'), border: `1px solid ${C.border}` }} onClick={handleReset}>
          🔄 Réinitialiser
        </button>
      </div>
    </div>
  )
}