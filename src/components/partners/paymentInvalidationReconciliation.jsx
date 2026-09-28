import { useRef, useState } from 'react'
import customFetch from '../../utils/customFetch'
import { money } from '../../utils/partnerCommission'

const labels = {
  CONSISTENT: 'Consistent', MISSING_REVERSAL: 'Missing reversal', EXCESS_REVERSAL: 'Excess reversal',
  MISSING_RESTORATION: 'Missing restoration', EXCESS_RESTORATION: 'Excess restoration',
  MISSING_RECOVERY_OBLIGATION: 'Missing recovery obligation', EXCESS_RECOVERY_OBLIGATION: 'Excess recovery obligation',
  UNRESOLVED_PROVIDER_STATE: 'Provider state unresolved', UNRESOLVED_OWNERSHIP: 'Ownership unresolved',
  CURRENCY_MISMATCH: 'Currency mismatch',
}
const counts = [
  ['totalEarningsInspected', 'Earnings inspected'], ['consistent', 'Consistent'], ['missingReversal', 'Missing reversal'],
  ['missingRestoration', 'Missing restoration'], ['missingRecovery', 'Missing recovery'],
  ['otherInconsistent', 'Other inconsistent'], ['unresolved', 'Unresolved'],
]
const buttonClass = 'rounded-lg border border-gray300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50'
const investigation = {
  UNRESOLVED_PROVIDER_STATE: 'Provider evidence is incomplete or changed during inspection.',
  UNRESOLVED_OWNERSHIP: 'Payment ownership could not be verified.',
  CURRENCY_MISMATCH: 'The currencies in the payment evidence do not match.',
}

export function PaymentInvalidationReconciliation() {
  const [report, setReport] = useState(null)
  const [limit, setLimit] = useState(5)
  const [cursor, setCursor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previousCursors, setPreviousCursors] = useState([])
  const pending = useRef(false)

  // The API is forward-only. Retain successful page cursors for explicit back requests.
  async function inspect(after = null, previous = []) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const response = await customFetch.get('/admin/partners/payment-invalidation-reconciliation', {
        params: { limit, ...(after ? { cursor: after } : {}) }, timeout: 45000,
      })
      const result = response.data.data
      if (!Array.isArray(result?.rows) || !result.summary || !Array.isArray(result.summary.totals)) {
        throw new Error('Invalid inspection response')
      }
      setReport(result)
      setCursor(after)
      setPreviousCursors(previous)
    } catch {
      setError('Inspection unavailable or already in progress. The requested page was not loaded. Try the same inspection action later. No accounting was changed.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <section aria-labelledby="payment-inspection-heading" aria-busy={busy} className="rounded-xl border border-gray200 bg-white p-5 shadow-sm">
    <h2 id="payment-inspection-heading" className="font-semibold text-gray900">Historical Partner invalidation reconciliation</h2>
    <p className="mt-1 text-sm text-gray600">Read-only comparison with canonical provider records. Each action inspects one bounded page of historical earnings. No repairs or financial actions are performed.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="text-sm">Earnings per page <select aria-label="Earnings per page" className="ml-2 rounded border border-gray300 p-2" value={limit} disabled={busy} onChange={event => {
        setLimit(Number(event.target.value))
        setReport(null)
        setCursor(null)
        setPreviousCursors([])
        setError('')
      }}>{[5, 10, 20].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button className={buttonClass} disabled={busy} onClick={() => inspect()}>Inspect first page</button>
      {report ? <>
        <button className={buttonClass} disabled={busy || !previousCursors.length} onClick={() => inspect(previousCursors[previousCursors.length - 1], previousCursors.slice(0, -1))}>Previous page</button>
        <button className={buttonClass} disabled={busy || !report.nextCursor} onClick={() => inspect(report.nextCursor, [...previousCursors, cursor])}>Next page</button>
        <button className={buttonClass} disabled={busy} onClick={() => inspect(cursor, previousCursors)}>Inspect this page again</button>
      </> : null}
      {busy ? <span role="status" className="text-sm">Inspecting provider records...</span> : null}
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-amber-800">{error}</p> : null}
    {!report && !busy && !error ? <p className="mt-4 text-sm text-gray500">No reconciliation run yet. Select Inspect first page to begin.</p> : null}
    {report ? <div className="mt-5 space-y-4">
      <p className="text-xs text-gray500">Last completed inspection: {report.observedAt}. Counts and totals cover this page only. Unresolved rows are excluded from both sides of totals; unknown amounts are not zero.</p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">{counts.map(([key, label]) => <div key={key} className="rounded-lg bg-gray50 p-3"><dt className="text-xs text-gray600">{label}</dt><dd className="text-lg font-semibold">{report.summary?.[key] ?? 'Unavailable'}</dd></div>)}</dl>
      <p className="text-xs text-gray600">Expected reversal is the current outstanding target; recorded reversals are lifetime debits. Expected restoration is the credit offset needed against those recorded debits. Net differences determine classification. A ledger discrepancy takes priority over a recovery discrepancy.</p>
      <div className="overflow-x-auto"><table className="min-w-[1400px] w-full text-left text-sm">
        <caption className="sr-only">Historical commission inspection results for this page</caption>
        <thead className="bg-gray50 text-xs uppercase text-gray600"><tr>
          {['Classification', 'Order / reference', 'Beneficiary', 'Payment references', 'Currency', 'Reversal', 'Restoration', 'Recovery due', 'Observation reason'].map((heading, index) => <th scope="col" key={heading} className="p-3">{heading}{index >= 5 && index <= 7 ? <><br />Expected / recorded</> : null}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray100">{report.rows.map(row => {
          const known = Object.hasOwn(labels, row.classification)
          const requiresInvestigation = Object.hasOwn(investigation, row.classification)
          return <tr key={row.earningId}>
            <td className="p-3">
              <span className={row.classification === 'CONSISTENT' ? 'text-emerald-700' : 'text-amber-800'}>{known ? labels[row.classification] : 'Unknown classification'}</span>
              <code className="mt-1 block break-all text-xs text-gray500">{typeof row.classification === 'string' ? row.classification : 'Classification unavailable'}</code>
              {requiresInvestigation || !known ? <p className="mt-1 text-xs text-gray600">Requires investigation. {requiresInvestigation ? investigation[row.classification] : 'This classification is not recognized by this Admin version.'} This does not establish a financial discrepancy.</p> : null}
            </td>
            <td className="p-3 font-mono text-xs">{row.reference || 'Reference unavailable'}<br />{row.orderId}</td>
            <td className="p-3 font-mono text-xs">{row.beneficiaryId}</td>
            <td className="p-3 font-mono text-xs"><p>PaymentIntent: {row.paymentIntentId || 'Unavailable'}</p><p>Transaction: {row.transactionId || 'Unavailable'}</p></td>
            <td className="p-3">{row.currency}</td>
            <td className="p-3">{money(row.expectedReversalMinor, row.currency)} / {money(row.recordedReversalMinor, row.currency)}</td>
            <td className="p-3">{money(row.expectedRestorationMinor, row.currency)} / {money(row.recordedRestorationMinor, row.currency)}</td>
            <td className="p-3">{money(row.expectedRecoveryDueMinor, row.currency)} / {money(row.recordedRecoveryDueMinor, row.currency)}</td>
            <td className="p-3"><code className="break-all text-xs">{row.reason || 'None reported'}</code></td>
          </tr>
        })}</tbody>
      </table></div>
      {!report.rows?.length ? <p className="text-sm text-gray500">No earnings on this page.</p> : null}
      {(report.summary?.totals ?? []).map(total => <div key={total.currency} className="rounded-lg bg-gray50 p-3 text-sm">
        <p className="font-semibold">{total.currency} totals: {total.resolvedEarnings} resolved, {total.unresolvedEarnings} unresolved</p>
        <p>Reversal expected / recorded: {money(total.expectedReversalMinor, total.currency)} / {money(total.recordedReversalMinor, total.currency)}</p>
        <p>Restoration expected / recorded: {money(total.expectedRestorationMinor, total.currency)} / {money(total.recordedRestorationMinor, total.currency)}</p>
        <p>Recovery due expected / recorded: {money(total.expectedRecoveryDueMinor, total.currency)} / {money(total.recordedRecoveryDueMinor, total.currency)}</p>
      </div>)}
    </div> : null}
  </section>
}
