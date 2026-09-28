/**
 * Read-only API contracts. Reconciliation SUM values may be decimal integer strings.
 * @typedef {number|string} MinorAmount
 * @typedef {{restoredMinor: MinorAmount, recoveryDueMinor: MinorAmount}} InvalidationBalances
 * @typedef {{earnedMinor: MinorAmount, reversalMinor: MinorAmount, restoredMinor: MinorAmount, netLiabilityMinor: MinorAmount}} MonthlyCommission
 * @typedef {{entryType: 'EARNING'|'REVERSAL'|'RESTORATION'|string, restoresCommissionId: string|null}} CommissionEntry
 */
/** Presentation only. Ledger and settlement amounts remain backend-authoritative. */
export function minorUnits(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value)
  return null
}

export function money(value, currency = 'CAD') {
  const minor = minorUnits(value)
  if (minor === null) return 'Unavailable'
  try {
    const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency })
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
    const scale = BigInt(10) ** BigInt(digits)
    const absolute = minor < BigInt(0) ? -minor : minor
    const whole = absolute / scale
    const fraction = String(absolute % scale).padStart(digits, '0')
    // Preserve the minus sign for amounts between -1 and 0 without floating-point dollars.
    const signedWhole = minor < BigInt(0) ? -(whole || BigInt(1)) : whole
    return formatter.formatToParts(signedWhole).map(part => {
      if (part.type === 'fraction') return fraction
      if (part.type === 'integer' && whole === BigInt(0)) return '0'
      return part.value
    }).join('')
  } catch {
    return 'Unavailable'
  }
}

export function commissionEntryLabel(type) {
  switch (type) {
    case 'EARNING': return 'Earned commission'
    case 'REVERSAL': return 'Commission reversed'
    case 'RESTORATION': return 'Commission restored'
    default: return 'Commission adjustment'
  }
}

export function commissionStatusLabel(status) {
  switch (status) {
    case 'PENDING': return 'Pending'
    case 'EARNED': return 'Earned'
    case 'REVERSED': return 'Reversed'
    case 'NOT_ELIGIBLE': return 'Not eligible'
    case 'PARTIALLY_REVERSED': return 'Partially reversed'
    case 'RESTORED': return 'Restored'
    default: return 'Status unavailable'
  }
}
