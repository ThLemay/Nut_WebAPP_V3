export function parseQR(raw) {
  if (!raw) return { error: 'Code vide.' }
  const s = raw.trim().toUpperCase()
  if (s.startsWith('NUT:CLIENT:')) {
    const id = raw.trim().slice('NUT:CLIENT:'.length)
    if (!id) return { error: 'ID client manquant.' }
    return { type: 'client', id }
  }
  if (s.startsWith('NUT:CONT:')) {
    const id = raw.trim().slice('NUT:CONT:'.length)
    if (!id) return { error: 'ID contenant manquant.' }
    return { type: 'container', id }
  }
  return { error: 'Format non reconnu. Attendu : NUT:CLIENT:<id> ou NUT:CONT:<id>' }
}