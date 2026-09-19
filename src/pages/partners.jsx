import { referralAction } from '../utils/partnerReferral'
import { useEffect, useState } from 'react'
import customFetch from '../utils/customFetch'
import { toast } from 'react-toastify'
export function Partners() {
  const [partners, setPartners] = useState([])
  const [detail, setDetail] = useState(null)
  const [referralOrders, setReferralOrders] = useState([])
  const [reason, setReason] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    customFetch('/admin/partners')
      .then((r) => setPartners(r.data.data))
      .catch(() => setError('Could not load partners'))
  }, [])
  async function open(id) {
    setError('')
    setDetail(null)
    setReferralOrders([])
    setReason('')
    try {
      const [r, orders] = await Promise.all([
        customFetch('/admin/partners/' + id),
        customFetch('/admin/partners/' + id + '/referral-orders?limit=20'),
      ])
      setDetail(r.data.data)
      setReferralOrders(orders.data.data.items)
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
            </tr>
          ))}
        </tbody>
      </table>
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
          <h3>Referral orders</h3>
          {referralOrders.length ? <table><thead><tr><th>Reference</th><th>Attributed</th><th>Status</th><th>Payment</th><th>Value</th><th>Provenance</th></tr></thead><tbody>{referralOrders.map((o) => <tr key={o.reference}><td>{o.reference}</td><td>{o.attributedAt}</td><td>{o.orderStatus}</td><td>{o.paymentStatus}</td><td>{(o.orderValue.amountMinor / 100).toLocaleString('en-CA', { style: 'currency', currency: o.orderValue.currency })}</td><td>slug {o.publicSlugSnapshot} · session {o.referralSessionId} · policy {o.policyVersion}</td></tr>)}</tbody></table> : <p>No attributed orders.</p>}
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
