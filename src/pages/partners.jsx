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
  const [analytics, setAnalytics] = useState([])
  const [detailAnalytics, setDetailAnalytics] = useState(null)
  const [payoutSummary, setPayoutSummary] = useState(null)
  const [payoutPreview, setPayoutPreview] = useState(null)
  const [period, setPeriod] = useState('THIS_MONTH')
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('ALL')
  const [tierFilter, setTierFilter] = useState('ALL')
  const [activityFilter, setActivityFilter] = useState('ALL')
  const [reason, setReason] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([
      customFetch('/admin/partners'),
      customFetch('/admin/partners/commission-reconciliation'),
      customFetch('/admin/partners/analytics/portfolio?period=' + period),
    ])
      .then(([partnersResponse, reconciliationResponse, analyticsResponse]) => {
        setPartners(partnersResponse.data.data)
        setReconciliation(reconciliationResponse.data.data)
        setAnalytics(analyticsResponse.data.data)
      })
      .catch(() => setError('Could not load partner financial portfolio'))
  }, [period])
  async function open(id) {
    setError('')
    setDetail(null)
    setReferralOrders([])
    setEarnings({ balances: [], entries: [], pendingAssessments: [] })
    setDetailAnalytics(null)
    setReason('')
    try {
      const [r, orders, finance, performance, payout, preview] = await Promise.all([
        customFetch('/admin/partners/' + id),
        customFetch('/admin/partners/' + id + '/referral-orders?limit=20'),
        customFetch('/admin/partners/' + id + '/earnings'),
        customFetch('/admin/partners/' + id + '/analytics?period=' + period),
        customFetch('/admin/partners/' + id + '/payouts'),
        customFetch('/admin/partners/' + id + '/payouts/automation-preview'),
      ])
      setDetail(r.data.data)
      setReferralOrders(orders.data.data.items)
      setEarnings(finance.data.data)
      setDetailAnalytics(performance.data.data)
      setPayoutSummary(payout.data.data)
      setPayoutPreview(preview.data.data)
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
      <div><label>Search <input value={search} onChange={e => setSearch(e.target.value)} /></label><label> Program <select value={programFilter} onChange={e=>setProgramFilter(e.target.value)}><option>ALL</option><option>ACTIVE</option><option>PENDING</option><option>DISABLED</option></select></label><label> Tier <select value={tierFilter} onChange={e=>setTierFilter(e.target.value)}><option>ALL</option><option value="300">3%</option><option value="400">4%</option><option value="500">5%</option></select></label><label> Activity <select value={activityFilter} onChange={e=>setActivityFilter(e.target.value)}><option>ALL</option><option>NEW_NO_ACTIVITY</option><option>INACTIVE</option><option>RE_ENGAGEMENT</option><option>HIGH_GROWTH</option><option>DECLINING</option><option>LOW_CONVERSION</option><option>HIGH_CANCELLATION</option><option>HIGH_REFUND</option><option>TIER_APPROACHING</option><option>HIGH_VALUE</option></select></label><label> Period <select value={period} onChange={e=>setPeriod(e.target.value)}><option>THIS_MONTH</option><option>PREVIOUS_MONTH</option><option>TRAILING_30_DAYS</option><option>TRAILING_90_DAYS</option></select></label></div>
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
            <th>Days since earning</th><th>Sessions</th><th>Conversion</th><th>Current tier</th><th>Last referral</th><th>Last completion</th><th>Signals</th>
          </tr>
        </thead>
        <tbody>
          {partners.filter(p => (!search || p.companyName.toLowerCase().includes(search.toLowerCase())) && (programFilter === 'ALL' || p.referralProgramStatus === programFilter) && (tierFilter === 'ALL' || String(analytics.find(a=>a.businessId===p.id)?.metrics?.earnings?.currentTierBasisPoints) === tierFilter) && (activityFilter === 'ALL' || analytics.find(a=>a.businessId===p.id)?.signals?.includes(activityFilter))).map((p) => (
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
              <td>{p.financial?.daysSinceLastEarnedCommission ?? 'Never'}</td><td>{analytics.find(a=>a.businessId===p.id)?.metrics?.acquisition?.sessions ?? 'N/A'}</td><td>{analytics.find(a=>a.businessId===p.id)?.metrics?.conversion?.sessionToCompletedBasisPoints == null ? 'N/A' : analytics.find(a=>a.businessId===p.id).metrics.conversion.sessionToCompletedBasisPoints / 100 + '%'}</td><td>{analytics.find(a=>a.businessId===p.id)?.metrics?.earnings?.currentTierBasisPoints ? analytics.find(a=>a.businessId===p.id).metrics.earnings.currentTierBasisPoints / 100 + '%' : 'N/A'}</td><td>{analytics.find(a=>a.businessId===p.id)?.metrics?.activity?.lastReferralSession || 'No data'}</td><td>{analytics.find(a=>a.businessId===p.id)?.metrics?.activity?.lastCompletedOrder || 'No data'}</td><td>{analytics.find(a=>a.businessId===p.id)?.signals?.join(', ') || 'None'}</td>
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
          <h3>Referral funnel and performance</h3>
          {detailAnalytics ? <><p>Visits {detailAnalytics.acquisition.visits} � Sessions {detailAnalytics.acquisition.sessions} � Checkouts {detailAnalytics.acquisition.checkouts} � Orders {detailAnalytics.acquisition.orders} � Paid {detailAnalytics.acquisition.paid} � Completed {detailAnalytics.acquisition.completed}</p><p>Conversion {detailAnalytics.conversion.sessionToCompletedBasisPoints == null ? 'N/A' : detailAnalytics.conversion.sessionToCompletedBasisPoints / 100 + '%'} � Completion {detailAnalytics.quality.completionBasisPoints == null ? 'N/A' : detailAnalytics.quality.completionBasisPoints / 100 + '%'} � Cancellation {detailAnalytics.quality.cancellationBasisPoints == null ? 'N/A' : detailAnalytics.quality.cancellationBasisPoints / 100 + '%'} � Refund {detailAnalytics.quality.refundBasisPoints == null ? 'N/A' : detailAnalytics.quality.refundBasisPoints / 100 + '%'}</p><p>Current tier {detailAnalytics.earnings.currentTierBasisPoints / 100}% � Monthly completions {detailAnalytics.earnings.qualifyingMonthlyCompletions} � Last session {detailAnalytics.activity.lastReferralSession || 'No data'} � Last completion {detailAnalytics.activity.lastCompletedOrder || 'No data'}</p></> : <p>No analytics coverage yet.</p>}
          <h3>Financial summary</h3>
          {detail.financial ? <p>
            Eligible basis: {(detail.financial.grossEligibleBasisMinor / 100).toFixed(2)} ? Referral adjustment collected: {(detail.financial.referralAdjustmentRevenueCollectedMinor / 100).toFixed(2)} ? Pending: {(detail.financial.pendingCommissionMinor / 100).toFixed(2)} ? Gross earned: {(detail.financial.grossEarnedCommissionMinor / 100).toFixed(2)} ? Reversals: {(detail.financial.reversalMinor / 100).toFixed(2)} ? Net liability: {(detail.financial.netCommissionLiabilityMinor / 100).toFixed(2)}
          </p> : null}
          <h3>Payout destination and settlement</h3>
          {payoutSummary ? <><p>Readiness: {payoutSummary.destination?.readinessState || 'NO_DESTINATION'} · Destination: {payoutSummary.destination?.maskedSummary || 'Not configured'} · Requirements: {payoutSummary.destination?.requirementsDue?.join(', ') || 'None reported'}</p><p>Release policy: {payoutSummary.releasePolicy.activated ? 'ACTIVE' : 'NOT ACTIVATED'}</p><p>Automation: {payoutSummary.automation?.state || 'AUTOMATION DISABLED'} · Timezone: {payoutSummary.automation?.timezone || 'America/Toronto'}</p><p>Payout attention: {payoutSummary.signals?.join(', ') || 'None'}</p>{payoutPreview?<p>Weekly batch preview: {payoutPreview.reason} · Eligible {payoutPreview.eligiblePayoutMinor} {payoutPreview.currency} minor units · Recovery due {payoutPreview.recoveryDueMinor}</p>:null}{payoutSummary.balances.map(b=><p key={b.currency}>{b.currency}: held {b.heldMinor} · available {b.availableMinor} · reserved {b.reservedMinor} · transferred {b.transferredMinor}</p>)}</> : <p>No payout configuration.</p>}
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
