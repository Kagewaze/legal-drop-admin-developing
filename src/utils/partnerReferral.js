export function actionsFor(status) {
  return (
    { PENDING: ['APPROVE'], ACTIVE: ['DISABLE', 'CHANGE_SLUG'], DISABLED: ['REENABLE'] }[status] ??
    []
  )
}
export function rowActionsFor(status) {
  return status === 'PENDING' ? ['REVIEW', 'APPROVE'] : ['VIEW']
}

export function partnerActionPath(businessId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId))
    throw new Error('A valid Business ID is required')
  return `/admin/partners/${businessId}/referral-program`
}

export function referralAction(status, action, reason, slug) {
  if (!actionsFor(status).includes(action))
    throw new Error('Action unavailable for current program status')
  const trimmed = reason.trim()
  if (trimmed.length < 3 || trimmed.length > 500)
    throw new Error('Provide a reason between 3 and 500 characters')
  const body = { action, reason: trimmed }
  if (action === 'CHANGE_SLUG') {
    const normalized = slug.trim().toLowerCase()
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(normalized))
      throw new Error('Invalid public referral slug')
    body.slug = normalized
  }
  return body
}

export function settlementStatusLabel(status) { return status === 'completed' ? 'Transfer completed / manual settlement' : status; }
