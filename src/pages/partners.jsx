import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import customFetch from '../utils/customFetch'
import { beneficiaryAbsenceIsExpected, partnerActionPath, referralAction, rowActionsFor, shouldLoadBeneficiaryData } from '../utils/partnerReferral'

const money = (minor = 0, currency = 'CAD') =>
  (Number(minor || 0) / 100).toLocaleString('en-CA', { style: 'currency', currency })

const shortId = (id = '') => (id ? `${id.slice(0, 8)}…` : 'ID unavailable')

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Not recorded'

const statusLabel = (status = '') => status.replaceAll('_', ' ')

const statusClass = (status) =>
  ({
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
    DISABLED: 'border-rose-200 bg-rose-50 text-rose-700',
    NOT_ENROLLED: 'border-gray-200 bg-gray-100 text-gray-700',
  })[status] ?? 'border-gray-200 bg-gray-50 text-gray-700'

const controlClass =
  'h-10 rounded-lg border border-gray300 bg-white px-3 text-sm text-gray900 outline-none transition focus:border-[#6d3adf] focus:ring-4 focus:ring-[#ede7ff]'
const secondaryButton =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-gray300 bg-white px-3 py-2 text-sm font-semibold text-gray700 transition hover:border-[#8a5cf6] hover:bg-[#f8f5ff] hover:text-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#ede7ff] disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-[#6d3adf] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#dcd0ff] disabled:cursor-not-allowed disabled:opacity-50'

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
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [reviewIntent, setReviewIntent] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError('')
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
      .catch(() => setError('We could not load the Partner Program portfolio. Try refreshing the page.'))
      .finally(() => setLoading(false))
  }, [period])

  const analyticsByBusiness = new Map(analytics.map((item) => [item.businessId, item]))
  const filteredPartners = partners.filter((partner) => {
    const partnerAnalytics = analyticsByBusiness.get(partner.id)
    return (
      (!search || partner.companyName.toLowerCase().includes(search.toLowerCase()) || partner.id.toLowerCase().includes(search.toLowerCase())) &&
      (programFilter === 'ALL' || partner.referralProgramStatus === programFilter) &&
      (tierFilter === 'ALL' || String(partnerAnalytics?.metrics?.earnings?.currentTierBasisPoints) === tierFilter) &&
      (activityFilter === 'ALL' || partnerAnalytics?.signals?.includes(activityFilter))
    )
  })
  const summary = {
    total: partners.length,
    active: partners.filter((partner) => partner.referralProgramStatus === 'ACTIVE').length,
    pending: partners.filter((partner) => partner.referralProgramStatus === 'PENDING').length,
    referredOrders: partners.reduce((total, partner) => total + Number(partner.metrics?.attributedOrdersCreated ?? 0), 0),
    liability: partners.reduce((total, partner) => total + Number(partner.financial?.netCommissionLiabilityMinor ?? 0), 0),
  }

  async function open(id, intent = null) {
    setError('')
    setDetail(null)
    setDetailLoading(true)
    setReferralOrders([])
    setEarnings({ balances: [], entries: [], pendingAssessments: [] })
    setDetailAnalytics(null)
    setPayoutSummary(null)
    setPayoutPreview(null)
    setReason('')
    setReviewIntent(intent)
    try {
      const partnerResponse = await customFetch('/admin/partners/' + id)
      const partnerDetail = partnerResponse.data.data
      setDetail(partnerDetail)
      setSlug(partnerDetail.link?.slug ?? '')
      window.setTimeout(() => document.getElementById('partner-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)

      if (!shouldLoadBeneficiaryData(partnerDetail)) {
        if (!beneficiaryAbsenceIsExpected(partnerDetail.status)) {
          setError(`${partnerDetail.business.name} is ${statusLabel(partnerDetail.status)}, but its referral beneficiary is missing. Financial and referral data cannot be loaded.`)
        }
        return
      }

      const [orders, finance, performance, payout, preview] = await Promise.all([
        customFetch('/admin/partners/' + id + '/referral-orders?limit=20'),
        customFetch('/admin/partners/' + id + '/earnings'),
        customFetch('/admin/partners/' + id + '/analytics?period=' + period),
        customFetch('/admin/partners/' + id + '/payouts'),
        customFetch('/admin/partners/' + id + '/payouts/automation-preview'),
      ])
      setReferralOrders(orders.data.data.items)
      setEarnings(finance.data.data)
      setDetailAnalytics(performance.data.data)
      setPayoutSummary(payout.data.data)
      setPayoutPreview(preview.data.data)
    } catch {
      setReviewIntent(null)
      setError('We could not load this partner. Try again from the portfolio table.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function action(actionName) {
    if (!detail || busy) return
    const businessId = detail.business.id
    if (
      actionName === 'APPROVE' &&
      !window.confirm(`Approve the Partner Program enrollment for ${detail.business.name} (${businessId})?`)
    ) return
    setBusy(true)
    setError('')
    try {
      const response = await customFetch.post(
        partnerActionPath(businessId),
        referralAction(detail.status, actionName, reason, slug)
      )
      setDetail(response.data.data)
      setReason('')
      setReviewIntent(null)
      const list = await customFetch('/admin/partners')
      setPartners(list.data.data)
      toast.success(actionName === 'APPROVE' ? 'Partner Program enrollment approved' : 'Partner Program updated')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? requestError.message ?? 'Action failed')
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

  const badge = (status) => (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  )

  const metric = (label, value, context) => (
    <div className="rounded-xl border border-gray200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray900">{value}</p>
      <p className="mt-1 text-xs text-gray500">{context}</p>
    </div>
  )

  const detailStat = (label, value) => (
    <div className="rounded-lg bg-gray50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-gray900">{value}</dd>
    </div>
  )

  return (
    <main className="min-h-screen bg-gray50 px-4 py-6 text-gray900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-3 border-b border-gray200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6d3adf]">Druppr operations</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray900">Partner Program</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray600">Manage referrals, partner performance, commissions and enrollment.</p>
          </div>
          <p className="text-sm text-gray500">Up to 100 most recently created businesses</p>
        </header>

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        <section aria-label="Partner Program summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metric('Portfolio businesses', summary.total, 'Businesses in the current portfolio')}
          {metric('Active partners', summary.active, 'Approved referral programs')}
          {metric('Pending applications', summary.pending, 'Awaiting Admin review')}
          {metric('Referred orders', summary.referredOrders.toLocaleString('en-CA'), 'Attributed orders, all time')}
          {metric('Net commission liability', money(summary.liability), 'Ledger-backed current liability')}
        </section>

        <section aria-labelledby="partner-filters" className="rounded-xl border border-gray200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 id="partner-filters" className="font-semibold text-gray900">Portfolio filters</h2>
              <p className="text-xs text-gray500">Refine the operational view without changing partner data.</p>
            </div>
            <span className="text-sm font-medium text-gray600">{filteredPartners.length} results</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-xs font-semibold text-gray600">
              <span>Search partners</span>
              <input className={`${controlClass} w-full`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or Business ID" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray600">
              <span>Program status</span>
              <select className={`${controlClass} w-full`} value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
                <option value="ALL">All</option><option value="NOT_ENROLLED">Not enrolled</option><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray600">
              <span>Tier</span>
              <select className={`${controlClass} w-full`} value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
                <option value="ALL">All tiers</option><option value="300">3%</option><option value="400">4%</option><option value="500">5%</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray600">
              <span>Activity</span>
              <select className={`${controlClass} w-full`} value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
                <option value="ALL">All activity</option><option value="NEW_NO_ACTIVITY">New — no activity</option><option value="INACTIVE">Inactive</option><option value="RE_ENGAGEMENT">Re-engagement</option><option value="HIGH_GROWTH">High growth</option><option value="DECLINING">Declining</option><option value="LOW_CONVERSION">Low conversion</option><option value="HIGH_CANCELLATION">High cancellation</option><option value="HIGH_REFUND">High refund</option><option value="TIER_APPROACHING">Tier approaching</option><option value="HIGH_VALUE">High value</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray600">
              <span>Period</span>
              <select className={`${controlClass} w-full`} value={period} onChange={(event) => setPeriod(event.target.value)}>
                <option value="THIS_MONTH">This month</option><option value="PREVIOUS_MONTH">Previous month</option><option value="TRAILING_30_DAYS">Trailing 30 days</option><option value="TRAILING_90_DAYS">Trailing 90 days</option>
              </select>
            </label>
          </div>
        </section>

        <section aria-labelledby="portfolio-heading" className="overflow-hidden rounded-xl border border-gray200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray200 px-5 py-4">
            <div><h2 id="portfolio-heading" className="font-semibold text-gray900">Partner portfolio</h2><p className="text-xs text-gray500">Enrollment, performance and liability at a glance</p></div>
          </div>
          {loading ? (
            <div role="status" className="p-10 text-center text-sm text-gray500">Loading partner portfolio…</div>
          ) : filteredPartners.length === 0 ? (
            <div className="p-10 text-center"><p className="font-medium text-gray800">No partners match these filters.</p><p className="mt-1 text-sm text-gray500">Adjust the search or filter selection.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full table-fixed text-left text-sm">
                <thead className="bg-gray50 text-xs uppercase tracking-wide text-gray600">
                  <tr>
                    <th className="sticky left-0 z-10 w-56 bg-gray50 px-5 py-3">Partner</th><th className="w-36 px-4 py-3">Program status</th><th className="w-48 px-4 py-3">Contact</th><th className="w-20 px-4 py-3">Tier</th><th className="w-28 px-4 py-3 text-right">Completed</th><th className="w-36 px-4 py-3 text-right">Completed value</th><th className="w-36 px-4 py-3 text-right">Net liability</th><th className="w-40 px-4 py-3">Last referral</th><th className="w-44 px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray100">
                  {filteredPartners.map((partner) => {
                    const partnerAnalytics = analyticsByBusiness.get(partner.id)
                    const tier = partnerAnalytics?.metrics?.earnings?.currentTierBasisPoints
                    return (
                      <tr key={partner.id} className="group hover:bg-[#fbf9ff]">
                        <td className="sticky left-0 z-[1] bg-white px-5 py-4 group-hover:bg-[#fbf9ff]">
                          <button className="block max-w-full text-left font-semibold text-gray900 hover:text-[#6d3adf] focus:outline-none focus:ring-2 focus:ring-[#8a5cf6]" onClick={() => open(partner.id)}>{partner.companyName}</button>
                          <span className="mt-1 block font-mono text-xs text-gray500" title={partner.id}>{shortId(partner.id)}</span>
                        </td>
                        <td className="px-4 py-4">{badge(partner.referralProgramStatus)}</td>
                        <td className="px-4 py-4"><p className="truncate font-medium text-gray800" title={partner.contactName || 'Not designated'}>{partner.contactName || 'Not designated'}</p><p className="mt-1 truncate text-xs text-gray500" title={partner.email}>{partner.email}</p></td>
                        <td className="px-4 py-4 font-semibold text-gray700">{tier ? `${tier / 100}%` : 'N/A'}</td>
                        <td className="px-4 py-4 text-right font-medium">{partner.metrics?.completedAttributedOrders ?? 0}</td>
                        <td className="px-4 py-4 text-right font-medium">{money(partner.metrics?.completedAttributedOrderValueMinor, partner.metrics?.currency)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray900">{money(partner.financial?.netCommissionLiabilityMinor)}</td>
                        <td className="px-4 py-4 text-xs text-gray600">{formatDate(partnerAnalytics?.metrics?.activity?.lastReferralSession)}</td>
                        <td className="px-4 py-4"><div className="flex justify-end gap-2 whitespace-nowrap"><button className={secondaryButton} onClick={() => open(partner.id)}>{rowActionsFor(partner.referralProgramStatus).includes('REVIEW') ? 'Review' : 'View'}</button>{rowActionsFor(partner.referralProgramStatus).includes('APPROVE') ? <button className={primaryButton} onClick={() => open(partner.id, 'APPROVE')}>Approve</button> : null}</div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="reconciliation-heading" className="rounded-xl border border-gray200 bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 id="reconciliation-heading" className="font-semibold text-gray900">Commission reconciliation</h2><p className="text-xs text-gray500">Ledger consistency by beneficiary, currency and period</p></div>
          {reconciliation.length ? (
            <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="border-y border-gray200 bg-gray50 text-xs uppercase tracking-wide text-gray600"><tr><th className="px-3 py-3">Beneficiary</th><th className="px-3 py-3">Currency</th><th className="px-3 py-3">Period</th><th className="px-3 py-3 text-right">Earned</th><th className="px-3 py-3 text-right">Reversals</th><th className="px-3 py-3 text-right">Net liability</th><th className="px-3 py-3">Consistency</th></tr></thead><tbody className="divide-y divide-gray100">{reconciliation.map((row) => <tr key={row.beneficiaryId + row.currency + row.period}><td className="px-3 py-3 font-mono text-xs">{shortId(row.beneficiaryId)}</td><td className="px-3 py-3">{row.currency}</td><td className="px-3 py-3">{row.period}</td><td className="px-3 py-3 text-right">{money(row.earnedMinor, row.currency)}</td><td className="px-3 py-3 text-right">{money(row.reversalMinor, row.currency)}</td><td className="px-3 py-3 text-right font-semibold">{money(row.netLiabilityMinor, row.currency)}</td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.consistent ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{row.consistent ? 'PASS' : 'REVIEW'}</span></td></tr>)}</tbody></table></div>
          ) : (
            <div className="rounded-lg bg-gray50 px-4 py-8 text-center"><p className="font-medium text-gray800">No commission activity yet.</p><p className="mt-1 text-sm text-gray500">Ledger reconciliation will appear after commission entries are created.</p></div>
          )}
        </section>

        {detailLoading ? <div role="status" className="rounded-xl border border-gray200 bg-white p-8 text-center text-sm text-gray500 shadow-sm">Loading partner details…</div> : null}
        {detail ? (
          <section id="partner-detail" className="scroll-mt-24 overflow-hidden rounded-xl border border-gray200 bg-white shadow-lg">
            <div className="flex flex-col gap-4 border-b border-gray200 bg-gradient-to-r from-[#f6f1ff] to-white px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6d3adf]">{reviewIntent === 'APPROVE' ? 'Partner application' : 'Partner detail'}</p><h2 className="mt-1 text-2xl font-semibold text-gray900">{detail.business.name}</h2><p className="mt-1 text-xs text-gray500">Business ID: <span className="font-mono">{detail.business.id}</span></p></div>
              <div className="flex items-center gap-3">{badge(detail.status)}<button className={secondaryButton} onClick={() => { setDetail(null); setReviewIntent(null) }}>Close</button></div>
            </div>

            <div className="space-y-6 p-5">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {detailStat('Designated contact', detail.contact.name || 'Not designated')}
                {detailStat('Contact role', detail.contact.title || 'Not recorded')}
                {detailStat('Contact email', detail.contact.email || 'Not recorded')}
                {detailStat('Contact phone', detail.contact.phone || 'Not recorded')}
                {detailStat('Requested', formatDate(detail.enrolledAt))}
                {detailStat('Approved', formatDate(detail.approvedAt))}
                {detailStat('Beneficiary', detail.beneficiary.exists ? detail.beneficiary.status : 'Not created yet')}
                {detailStat('Current tier', detailAnalytics?.earnings?.currentTierBasisPoints ? `${detailAnalytics.earnings.currentTierBasisPoints / 100}%` : 'N/A')}
              </dl>
              {!detail.beneficiary.exists && beneficiaryAbsenceIsExpected(detail.status) ? <div className="rounded-lg border border-gray200 bg-gray50 px-4 py-3 text-sm text-gray600">Referral infrastructure will be created when the Partner Program is approved.</div> : null}

              {detail.status === 'PENDING' ? (
                <section className="rounded-xl border border-[#dcd0ff] bg-[#faf8ff] p-5" aria-labelledby="application-heading">
                  <div className="mb-4"><h3 id="application-heading" className="font-semibold text-gray900">Partner Application</h3><p className="text-sm text-gray600">Review the exact Business ID and designated contact before approving enrollment.</p></div>
                  <label className="block text-sm font-semibold text-gray700" htmlFor="approval-reason">Approval reason</label>
                  <textarea id="approval-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border border-gray300 bg-white p-3 text-sm outline-none focus:border-[#6d3adf] focus:ring-4 focus:ring-[#ede7ff]" placeholder="Record the basis for approval" />
                  <p className="mt-1 text-xs text-gray500">Required · 3–500 characters · stored in the audit history</p>
                  <div className="mt-4 flex flex-wrap justify-end gap-3"><button className={secondaryButton} onClick={() => { setDetail(null); setReviewIntent(null) }}>Cancel</button><button className={primaryButton} disabled={busy || reason.trim().length < 3} onClick={() => action('APPROVE')}>{busy ? 'Approving…' : 'Approve Partner'}</button></div>
                </section>
              ) : (
                <section className="rounded-xl border border-gray200 p-5"><label className="block text-sm font-semibold text-gray700" htmlFor="action-reason">Action reason</label><textarea id="action-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} rows={2} className="mt-2 w-full rounded-lg border border-gray300 p-3 text-sm outline-none focus:border-[#6d3adf] focus:ring-4 focus:ring-[#ede7ff]" /><div className="mt-3 flex flex-wrap gap-3">{detail.status === 'ACTIVE' ? <button className={secondaryButton} disabled={busy || reason.trim().length < 3} onClick={() => action('DISABLE')}>Disable new referrals</button> : null}{detail.status === 'DISABLED' ? <button className={primaryButton} disabled={busy || reason.trim().length < 3} onClick={() => action('REENABLE')}>Reenable program</button> : null}</div></section>
              )}

              {detail.link ? <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold">Referral channel</h3><div className="mt-3 flex flex-col gap-3 lg:flex-row"><input aria-label="Canonical referral URL" readOnly value={detail.link.url} onFocus={(event) => event.currentTarget.select()} className={`${controlClass} min-w-0 flex-1 font-mono`} /><button className={secondaryButton} onClick={copy}>Copy link</button></div><p className="mt-2 text-xs text-gray500">{detail.link.enabled ? 'Link enabled for new referrals' : 'New referrals disabled'}</p>{detail.status === 'ACTIVE' ? <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label="Public slug" value={slug} maxLength={64} onChange={(event) => setSlug(event.target.value)} className={`${controlClass} flex-1`} /><button className={secondaryButton} disabled={busy || reason.trim().length < 3} onClick={() => action('CHANGE_SLUG')}>Change slug and retire old alias</button></div> : null}</section> : null}

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Performance</h3><dl className="mt-4 grid grid-cols-2 gap-3">{detailStat('Attributed orders', detail.metrics.attributedOrdersCreated)}{detailStat('Paid orders', detail.metrics.paidAttributedOrders)}{detailStat('Completed orders', detail.metrics.completedAttributedOrders)}{detailStat('Cancelled / refunded', detail.metrics.cancelledAttributedOrders)}{detailStat('Referred value', money(detail.metrics.totalAttributedOrderValueMinor, detail.metrics.currency))}{detailStat('Last completion', formatDate(detailAnalytics?.activity?.lastCompletedOrder))}</dl></section>
                <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Referral funnel</h3>{detailAnalytics ? <dl className="mt-4 grid grid-cols-3 gap-3">{detailStat('Visits', detailAnalytics.acquisition.visits)}{detailStat('Sessions', detailAnalytics.acquisition.sessions)}{detailStat('Checkouts', detailAnalytics.acquisition.checkouts)}{detailStat('Orders', detailAnalytics.acquisition.orders)}{detailStat('Paid', detailAnalytics.acquisition.paid)}{detailStat('Completed', detailAnalytics.acquisition.completed)}{detailStat('Conversion', detailAnalytics.conversion.sessionToCompletedBasisPoints == null ? 'N/A' : `${detailAnalytics.conversion.sessionToCompletedBasisPoints / 100}%`)}{detailStat('Completion', detailAnalytics.quality.completionBasisPoints == null ? 'N/A' : `${detailAnalytics.quality.completionBasisPoints / 100}%`)}{detailStat('Cancellation', detailAnalytics.quality.cancellationBasisPoints == null ? 'N/A' : `${detailAnalytics.quality.cancellationBasisPoints / 100}%`)}{detailStat('Refund', detailAnalytics.quality.refundBasisPoints == null ? 'N/A' : `${detailAnalytics.quality.refundBasisPoints / 100}%`)}</dl> : <p className="mt-4 text-sm text-gray500">No analytics coverage yet.</p>}</section>
                <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Commission</h3>{detail.financial ? <dl className="mt-4 grid grid-cols-2 gap-3">{detailStat('Eligible basis', money(detail.financial.grossEligibleBasisMinor))}{detailStat('Referral adjustment', money(detail.financial.referralAdjustmentRevenueCollectedMinor))}{detailStat('Pending', money(detail.financial.pendingCommissionMinor))}{detailStat('Gross earned', money(detail.financial.grossEarnedCommissionMinor))}{detailStat('Reversals', money(detail.financial.reversalMinor))}{detailStat('Net liability', money(detail.financial.netCommissionLiabilityMinor))}</dl> : <p className="mt-4 text-sm text-gray500">No commission activity.</p>}</section>
                <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Payout readiness</h3>{payoutSummary ? <><dl className="mt-4 grid grid-cols-2 gap-3">{detailStat('Readiness', payoutSummary.destination?.readinessState || 'NO DESTINATION')}{detailStat('Destination', payoutSummary.destination?.maskedSummary || 'Not configured')}{detailStat('Release policy', payoutSummary.releasePolicy.activated ? 'ACTIVE' : 'NOT ACTIVATED')}{detailStat('Automation', payoutSummary.automation?.state || 'AUTOMATION DISABLED')}{detailStat('Timezone', payoutSummary.automation?.timezone || 'America/Toronto')}{detailStat('Batch preview', payoutPreview?.reason || 'Unavailable')}{detailStat('Eligible payout', payoutPreview ? money(payoutPreview.eligiblePayoutMinor, payoutPreview.currency) : 'Unavailable')}{detailStat('Recovery due', payoutPreview ? money(payoutPreview.recoveryDueMinor, payoutPreview.currency) : 'Unavailable')}{detailStat('Attention', payoutSummary.signals?.join(', ') || 'None')}</dl><div className="mt-4 grid gap-3">{payoutSummary.balances.map((balance) => <dl key={balance.currency} className="grid grid-cols-2 gap-3 rounded-lg bg-gray50 p-3 sm:grid-cols-4">{detailStat('Held', money(balance.heldMinor, balance.currency))}{detailStat('Available', money(balance.availableMinor, balance.currency))}{detailStat('Reserved', money(balance.reservedMinor, balance.currency))}{detailStat('Transferred', money(balance.transferredMinor, balance.currency))}</dl>)}</div></> : <p className="mt-4 text-sm text-gray500">No payout configuration.</p>}</section>
              </div>

              <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Commission liability detail</h3>{(earnings.balances ?? []).length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{earnings.balances.map((balance) => <dl key={balance.currency} className="grid grid-cols-2 gap-3 rounded-lg bg-gray50 p-3">{detailStat('Currency', balance.currency)}{detailStat('Pending', money(balance.pendingEstimateMinor, balance.currency))}{detailStat('Gross earned', money(balance.grossEarnedMinor, balance.currency))}{detailStat('Reversals', money(balance.reversedMinor, balance.currency))}{detailStat('Net liability', money(balance.netEarnedMinor, balance.currency))}{detailStat('Available', money(balance.availableMinor, balance.currency))}</dl>)}</div> : <p className="mt-4 text-sm text-gray500">No commission activity.</p>}</section>

              <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Commission entries</h3>{(earnings.entries ?? []).length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-gray50 text-xs uppercase tracking-wide text-gray600"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Order</th><th className="px-3 py-3">Type</th><th className="px-3 py-3 text-right">Basis</th><th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-gray100">{earnings.entries.map((entry) => <tr key={entry.id}><td className="px-3 py-3">{formatDate(entry.earnedAt)}</td><td className="px-3 py-3 font-mono text-xs">{entry.orderId}</td><td className="px-3 py-3">{entry.entryType}</td><td className="px-3 py-3 text-right">{money(entry.eligibleBasisMinor, entry.currency)}</td><td className="px-3 py-3 text-right">{entry.commissionRateBasisPoints / 100}%</td><td className="px-3 py-3 text-right">{money(entry.amountMinor, entry.currency)}</td></tr>)}</tbody></table></div> : <div className="mt-4 rounded-lg bg-gray50 px-4 py-8 text-center"><p className="font-medium text-gray800">No earned commission entries yet.</p><p className="mt-1 text-sm text-gray500">Posted earnings and reversals will appear here.</p></div>}</section>

              <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Referral orders</h3>{referralOrders.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[960px] w-full text-left text-sm"><thead className="bg-gray50 text-xs uppercase tracking-wide text-gray600"><tr><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Attributed</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3 text-right">Value</th><th className="px-3 py-3 text-right">Basis</th><th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Commission</th><th className="px-3 py-3">Assessment</th><th className="px-3 py-3">Provenance</th></tr></thead><tbody className="divide-y divide-gray100">{referralOrders.map((order) => <tr key={order.reference}><td className="px-3 py-3 font-mono text-xs">{order.reference}</td><td className="px-3 py-3">{formatDate(order.attributedAt)}</td><td className="px-3 py-3">{order.orderStatus}</td><td className="px-3 py-3">{order.paymentStatus}</td><td className="px-3 py-3 text-right">{money(order.orderValue.amountMinor, order.orderValue.currency)}</td><td className="px-3 py-3 text-right">{order.eligibleBasis?.amountMinor == null ? 'Not assessed' : money(order.eligibleBasis.amountMinor, order.orderValue.currency)}</td><td className="px-3 py-3 text-right">{order.commissionRateBasisPoints == null ? 'Not assessed' : `${order.commissionRateBasisPoints / 100}%`}</td><td className="px-3 py-3 text-right">{order.commissionAmountMinor == null ? 'Not assessed' : money(order.commissionAmountMinor, order.orderValue.currency)}</td><td className="px-3 py-3">{order.commissionStatus}</td><td className="px-3 py-3 text-xs text-gray500">slug {order.publicSlugSnapshot} · policy {order.policyVersion}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-gray500">No attributed orders.</p>}</section>

              <section className="rounded-xl border border-gray200 p-5"><h3 className="font-semibold text-gray900">Action history</h3>{detail.history.length ? <ul className="mt-4 divide-y divide-gray100">{detail.history.map((history) => <li key={history.id} className="py-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-gray800">{history.action}</span><span className="text-xs text-gray500">{formatDate(history.createdAt)}</span></div><p className="mt-1 text-gray600">{history.reason || 'Enrollment request'}{history.slug ? ` · ${history.slug}` : ''}</p></li>)}</ul> : <p className="mt-4 text-sm text-gray500">No administrative actions recorded.</p>}</section>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
