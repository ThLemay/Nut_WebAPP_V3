import { containerRepo } from '../data/repos/containerRepo'
import { transactionRepo } from '../data/repos/transactionRepo'
import { supabase } from '../lib/supabase'

export async function execConsigne({ companyId, clientId, containerId }) {
  const container = await containerRepo.getById(containerId)

  if (container.status !== 'available')
    throw new Error(`Contenant non disponible (statut : ${container.status})`)
  if (container.current_owner_company_id !== companyId)
    throw new Error("Ce contenant n'appartient pas à votre entreprise.")

  // Vérifier que le client existe
  const { data: client } = await supabase
    .from('profiles').select('id, role').eq('id', clientId).single()
  if (!client) throw new Error(`Client introuvable : ${clientId}`)
  if (client.role !== 'client') throw new Error("L'utilisateur scanné n'est pas un client.")

  const updated = await containerRepo.update(containerId, {
    status: 'in_use',
    current_holder_client_id: clientId
  })

  const tx = await transactionRepo.create({
    type: 'consigne', container_id: containerId,
    client_id: clientId, company_id: companyId, nut_coins_delta: 0
  })

  return { container: updated, transaction: tx }
}