import { referralAction } from '../utils/partnerReferral'
import { useEffect, useState } from 'react'
import customFetch from '../utils/customFetch'
import { toast } from 'react-toastify'
export function Partners() {
  const [partners, setPartners] = useState([])
  const [detail, setDetail] = useState(null)
  const [referralOrders, setReferralOrders] = useState([])
  const [earnings, setEarnings] = useState({ balances: [], entries: [], pendingAssessments: [] })
  const [reconciliation, setReconciliation] = useState([])
  const [reason, setReason] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([
      customFetch('/admin/partners'),
      customFetch('/admin/partners/commission-reconciliation'),
    ])
      .then(([partnersResponse, reconciliationResponse]) => {
        setPartners(partnersResponse.data.data)
        setReconciliation(reconciliationResponse.data.data)
      })
      .catch(() => setError('Could not load partner financial portfolio'))
  }, [])
  async function open(id) {
    setError('')
    setDetail(null)
    setReferralOrders([])
    setEarnings({ balances: [], entries: [], pendingAssessments: [] })
    setReason('')
    try {
      const [r, orders, finance] = await Promise.all([
        customFetch('/admin/partners/' + id),
        customFetch('/admin/partners/' + id + '/referral-orders?limit=20'),
        customFetch('/admin/partners/' + id + '/earnings'),
      ])
      setDetail(r.data.data)
      setReferralOrders(orders.data.data.items)
      setEarnings(finance.data.data)
      setSlug(r.data.data.link?.slug ?? '')
    } catch {
      setError('Could not load partner')
    }
  }
  async function action(action) {
    if (!detail || busy) return
    setBusy(true)
    setError('')
    try {
      const r = await customFetch.post(
        '/admin/partners/' + detail.business.id + '/referral-program',
        referralAction(detail.status, action, reason, slug)
      )
      setDetail(r.data.data)
      setReason('')
      const list = await customFetch('/admin/partners')
      setPartners(list.data.data)
    } catch (e) {
      setError(e.response?.data?.message ?? e.message ?? 'Action failed')
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(detail.link.url)
      toast.success('Link copied')
    } catch {
      setError('Select the referral link and copy it manually.')
    }
  }
  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Partner referral programs</h1>
      {error ? <p role="alert">{error}</p> : null}
      <p>Showing up to 100 most recently created businesses.</p>
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Program</th>
            <th>Contact</th>
            <th>Attributed</th>
            <th>Completed</th>
            <th>Completed value</th>
            <th>Pending commission</th>
            <th>Gross earned</th>
            <th>Reversals</th>
            <th>Net liability</th>
            <th>Average basis</th>
            <th>Average order</th>
            <th>Days since earning</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id}>
              <td>
                <button onClick={() => open(p.id)}>{p.companyName}</button>
              </td>
              <td>{p.referralProgramStatus}</td>
              <td>{p.contactName || 'Not designated'}</td>
              <td>{p.metrics?.attributedOrdersCreated ?? 0}</td>
              <td>{p.metrics?.completedAttributedOrders ?? 0}</td>
              <td>{((p.metrics?.completedAttributedOrderValueMinor ?? 0) / 100).toLocaleString('en-CA', { style: 'currency', currency: p.metrics?.currency ?? 'CAD' })}</td>
              <td>{((p.financial?.pendingCommissionMinor ?? 0) / 100).toFixed(2)}</td>
              <td>{((p.financial?.grossEarnedCommissionMinor ?? 0) / 100).toFixed(2)}</td>
              <td>{((p.financial?.reversalMinor ?? 0) / 100).toFixed(2)}</td>
              <td>{((p.financial?.netCommissionLiabilityMinor ?? 0) / 100).toFixed(2)}</td>
              <td>{((p.financial?.averageEligibleBasisMinor ?? 0) / 100).toFixed(2)}</td>
              <td>{((p.financial?.averageOrderValueMinor ?? 0) / 100).toFixed(2)}</td>
              <td>{p.financial?.daysSinceLastEarnedCommission ?? 'Never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h2>Commission reconciliation</h2>
        {reconciliation.length ? <table><thead><tr><th>Beneficiary</th><th>Currency</th><th>Period</th><th>Earned</th><th>Reversals</th><th>Net liability</th><th>Source consistency</th></tr></thead><tbody>
          {reconciliation.map((row) => <tr key={row.beneficiaryId + row.currency + row.period}><td>{row.beneficiaryId}</td><td>{row.currency}</td><td>{row.period}</td><td>{row.earnedMinor}</td><td>{row.reversalMinor}</td><td>{row.netLiabilityMinor}</td><td>{row.consistent ? 'PASS' : 'REVIEW'}</td></tr>)}
        </tbody></table> : <p>No commission ledger entries.</p>}
      </section>
      {detail ? (
        <section className="border p-4 space-y-3">
          <h2 className="font-semibold">{detail.business.name}</h2>
          <p>Program: {detail.status}</p>
          <p>
            Beneficiary: {detail.beneficiary.exists ? detail.beneficiary.status : 'Not allocated'}
          </p>
          <p>
            Contact: {detail.contact.name || 'Not designated'} · {detail.contact.title || ''}
          </p>
          <p>
            {detail.contact.email} · {detail.contact.phone}
          </p>
          <p>
            Enrolled: {detail.enrolledAt || '—'} · Approved: {detail.approvedAt || '—'} · Disabled:{' '}
            {detail.disabledAt || '—'}
          </p>
          {detail.link ? (
            <>
              <label>
                Canonical referral URL
                <input
                  aria-label="Canonical referral URL"
                  readOnly
                  value={detail.link.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full border"
                />
              </label>
              <button onClick={copy}>Copy Link</button>
              <p>{detail.link.enabled ? 'Link enabled' : 'New referrals disabled'}</p>
            </>
          ) : null}
          <label>
            Action reason (required)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={500}
              className="block border"
            />
          </label>
          <div className="flex gap-4">
            {detail.status === 'PENDING' ? (
              <button disabled={busy || reason.trim().length < 3} onClick={() => action('APPROVE')}>
                Approve program
              </button>
            ) : null}
            {detail.status === 'ACTIVE' ? (
              <button disabled={busy || reason.trim().length < 3} onClick={() => action('DISABLE')}>
                Disable new referrals
              </button>
            ) : null}
            {detail.status === 'DISABLED' ? (
              <button
                disabled={busy || reason.trim().length < 3}
                onClick={() => action('REENABLE')}
              >
                Reenable
              </button>
            ) : null}
          </div>
          {detail.status === 'ACTIVE' ? (
            <label>
              Public slug
              <input
                value={slug}
                maxLength={64}
                onChange={(e) => setSlug(e.target.value)}
                className="border"
              />
              <button
                disabled={busy || reason.trim().length < 3}
                onClick={() => action('CHANGE_SLUG')}
              >
                Change slug and retire old alias
              </button>
            </label>
          ) : null}
          <h3>Referral performance</h3>
          <p>Attributed: {detail.metrics.attributedOrdersCreated} · Paid: {detail.metrics.paidAttributedOrders} · Completed: {detail.metrics.completedAttributedOrders} · Cancelled/refunded: {detail.metrics.cancelledAttributedOrders}</p>
          <p>Total attributed value: {(detail.metrics.totalAttributedOrderValueMinor / 100).toLocaleString('en-CA', { style: 'currency', currency: detail.metrics.currency })}</p>
          <h3>Financial summary</h3>
          {detail.financial ? <p>
            Eligible basis: {(detail.financial.grossEligibleBasisMinor / 100).toFixed(2)} ? Referral adjustment collected: {(detail.financial.referralAdjustmentRevenueCollectedMinor / 100).toFixed(2)} ? Pending: {(detail.financial.pendingCommissionMinor / 100).toFixed(2)} ? Gross earned: {(detail.financial.grossEarnedCommissionMinor / 100).toFixed(2)} ? Reversals: {(detail.financial.reversalMinor / 100).toFixed(2)} ? Net liability: {(detail.financial.netCommissionLiabilityMinor / 100).toFixed(2)}
          </p> : null}
          <h3>Commission liability</h3>
          {(earnings.balances ?? []).length ? (
            <ul>{earnings.balances.map((b) => <li key={b.currency}>
              {b.currency}: pending {(b.pendingEstimateMinor / 100).toFixed(2)} ? gross earned {(b.grossEarnedMinor / 100).toFixed(2)} ? reversals {(b.reversedMinor / 100).toFixed(2)} ? net liability {(b.netEarnedMinor / 100).toFixed(2)} ? available {(b.availableMinor / 100).toFixed(2)}
            </li>)}</ul>
          ) : <p>No commission activity.</p>}
          <h3>Commission entries</h3>
          {(earnings.entries ?? []).length ? <table><thead><tr><th>Date</th><th>Order</th><th>Type</th><th>Basis</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
            {earnings.entries.map((entry) => <tr key={entry.id}><td>{entry.earnedAt}</td><td>{entry.orderId}</td><td>{entry.entryType}</td><td>{entry.eligibleBasisMinor}</td><td>{entry.commissionRateBasisPoints / 100}%</td><td>{entry.amountMinor}</td></tr>)}
          </tbody></table> : <p>No earned entries.</p>}
          <h3>Referral orders</h3>
          {referralOrders.length ? <table><thead><tr><th>Reference</th><th>Attributed</th><th>Status</th><th>Payment</th><th>Value</th><th>Eligible basis</th><th>Rate</th><th>Commission</th><th>Commission status</th><th>Provenance</th></tr></thead><tbody>{referralOrders.map((o) => <tr key={o.reference}><td>{o.reference}</td><td>{o.attributedAt}</td><td>{o.orderStatus}</td><td>{o.paymentStatus}</td><td>{(o.orderValue.amountMinor / 100).toLocaleString('en-CA', { style: 'currency', currency: o.orderValue.currency })}</td><td>{o.eligibleBasis?.amountMinor ?? 'Not assessed'}</td><td>{o.commissionRateBasisPoints == null ? 'Not assessed' : o.commissionRateBasisPoints / 100 + '%'}</td><td>{o.commissionAmountMinor ?? 'Not assessed'}</td><td>{o.commissionStatus}</td><td>slug {o.publicSlugSnapshot} · session {o.referralSessionId} · policy {o.policyVersion}</td></tr>)}</tbody></table> : <p>No attributed orders.</p>}
          <h3>Action history</h3>
          <ul>
            {detail.history.map((h) => (
              <li key={h.id}>
                {h.createdAt} · {h.action} · actor {h.actorUserId} ·{' '}
                {h.reason || 'Enrollment request'}
                {h.slug ? ' · ' + h.slug : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}
