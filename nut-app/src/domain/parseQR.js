/**
 * Parse un QR code NUT
 * Formats supportés :
 *   NUT:CONT:{id}     → { type: 'container', id }
 *   NUT:CLIENT:{id}   → { type: 'client', id }
 *   NUT:CAISSE:{code}  → { type: 'caisse', id }
 */
export function parseQR(raw) {
  if (!raw || typeof raw !== 'string') {
    return { error: 'QR code invalide' }
  }

  const trimmed = raw.trim()

  // Format NUT standard
  if (trimmed.startsWith('NUT:')) {
    const parts = trimmed.split(':')
    if (parts.length < 3) return { error: 'Format QR invalide' }

    const prefix = parts[1].toUpperCase()
    const id = parts.slice(2).join(':') // Au cas où l'ID contient des ':'

    if (prefix === 'CONT') return { type: 'container', id }
    if (prefix === 'CLIENT') return { type: 'client', id }
    if (prefix === 'CAISSE') return { type: 'caisse', id }

    return { error: `Type QR inconnu: ${prefix}` }
  }

  // Format brut (UUID seul) — on ne peut pas deviner le type
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { type: 'unknown', id: trimmed }
  }

  // Format CAISSE-XXX (QR code direct de caisse)
  if (/^CAISSE-\d{3}$/i.test(trimmed)) {
    return { type: 'caisse', id: trimmed }
  }

  return { error: 'Format QR non reconnu' }
}