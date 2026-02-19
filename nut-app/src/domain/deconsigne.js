import { containerRepo } from '../data/repos/containerRepo'
import { transactionRepo } from '../data/repos/transactionRepo'
import { companyRepo } from '../data/repos/companyRepo'
import { supabase } from '../lib/supabase'

export async function execDeconsigne({ companyId, clientId, containerId }) {
  const container = await containerRepo.getById(containerId)
  if (container.status !== 'in_use')
    throw new Error("Ce contenant n'est pas en cours d'utilisation.")
  if (container.current_holder_client_id !== clientId)
    throw new Error("Ce contenant n'est pas détenu par ce client.")

  const company = await companyRepo.getById(companyId)
  const pts = company.points_per_deconsigne

  const updated = await containerRepo.update(containerId, {
    status: 'available',
    current_holder_client_id: null,
    current_owner_company_id: companyId
  })

  await supabase.rpc('increment_nut_coins', { user_id: clientId, amount: pts })

  const tx = await transactionRepo.create({
    type: 'deconsigne', container_id: containerId,
    client_id: clientId, company_id: companyId, nut_coins_delta: pts
  })
  
  return { container: updated, transaction: tx, nutCoinsEarned: pts }
}