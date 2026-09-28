/* eslint-env node */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'
import * as financial from './partnerCommission.js'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../components/partners/paymentInvalidationReconciliation.jsx', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(source, 'inspection.jsx', { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const firstId = '11111111-1111-4111-8111-111111111111'
const nextId = '22222222-2222-4222-8222-222222222222'
// Synthetic DTO from backend 55ede772; all requests below are intercepted in memory.
const report = () => ({
  observedAt: '2026-09-27T12:00:00Z', nextCursor: firstId, limit: 5,
  rows: [{
    earningId: firstId, orderId: 'order-1', beneficiaryId: 'beneficiary-1', attributionId: 'attribution-1',
    reference: 'ORDER-FIXTURE', transactionId: 'transaction-1', paymentIntentId: 'pi_fixture',
    chargeIds: ['ch_fixture'], refundIds: ['re_fixture'], disputeIds: ['dp_fixture'], currency: 'CAD',
    finalChargedMinor: 1489, eligibleBasisMinor: 1446, commissionRateBasisPoints: 300, commissionAmountMinor: 43,
    confirmedLossMinor: 1489, eligibleLossMinor: 1446, expectedNetCommissionMinor: 0,
    activeReservedMinor: 0, transferredMinor: 43, recoveredMinor: 0,
    classification: 'MISSING_REVERSAL', reason: null,
    expectedReversalMinor: 43, recordedReversalMinor: 0, expectedRestorationMinor: 0,
    recordedRestorationMinor: 0, expectedRecoveryDueMinor: 43, recordedRecoveryDueMinor: 0,
  }],
  summary: {
    scope: 'PAGE', totalEarningsInspected: 1, consistent: 0, missingReversal: 1, missingRestoration: 0,
    missingRecovery: 0, otherInconsistent: 0, unresolved: 0,
    totals: [{ currency: 'CAD', resolvedEarnings: 1, unresolvedEarnings: 0, expectedReversalMinor: '43',
      recordedReversalMinor: '0', expectedRestorationMinor: '0', recordedRestorationMinor: '0',
      expectedRecoveryDueMinor: '43', recordedRecoveryDueMinor: '0' }],
  },
})

function harness(initial = null, get = async () => ({ data: { data: report() } })) {
  const slots = []
  const pending = { current: false }
  let index = 0
  const calls = []
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return { ...React, useRef: () => pending, useState: initialValue => {
      const slot = index++
      if (!(slot in slots)) slots[slot] = slot === 0 ? initial : initialValue
      return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }]
    } }
    if (name === '../../utils/customFetch') return { get: (...args) => { calls.push(args); return get(...args) } }
    if (name === '../../utils/partnerCommission') return financial
    return require(name)
  }, loaded, loaded.exports)
  const tree = () => { index = 0; return loaded.exports.PaymentInvalidationReconciliation() }
  const button = label => elements(tree(), 'button').find(node => node.props.children === label)
  return { tree, calls, button, click: label => button(label).props.onClick(), html: () => renderToStaticMarkup(tree()) }
}
function elements(node, type) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(item => elements(item, type))
  return [...(node.type === type ? [node] : []), ...elements(node.props?.children, type)]
}
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

test('no reconciliation run yet: mounting and rerendering never request history', () => {
  const h = harness()
  assert.ok(text(h.html()).includes('No reconciliation run yet'))
  h.tree()
  assert.equal(h.calls.length, 0)
  assert.deepEqual(elements(h.tree(), 'button').map(button => button.props.children), ['Inspect first page'])
})

test('first-page action is a bounded read-only GET through the authenticated Admin client', async () => {
  const h = harness()
  await h.click('Inspect first page')
  assert.deepEqual(h.calls, [['/admin/partners/payment-invalidation-reconciliation', { params: { limit: 5 }, timeout: 45000 }]])
  assert.ok(text(h.html()).includes('Earnings inspected 1'))
  assert.equal(h.button('Previous page').props.disabled, true)
})

test('loading is visible, all controls disable and duplicate requests are suppressed', async () => {
  let finish
  const h = harness(report(), () => new Promise(resolve => { finish = resolve }))
  const action = h.button('Inspect first page').props.onClick
  const pending = action()
  await action()
  assert.equal(h.calls.length, 1)
  assert.ok(h.html().includes('aria-busy="true"'))
  assert.ok(h.html().includes('role="status"'))
  assert.ok(text(h.html()).includes('Inspecting provider records'))
  for (const node of [...elements(h.tree(), 'button'), ...elements(h.tree(), 'select')]) assert.equal(node.props.disabled, true)
  finish({ data: { data: report() } })
  await pending
  assert.equal(h.button('Inspect first page').props.disabled, false)
})

test('empty page is distinct from not run yet and has no next page', () => {
  const r = report()
  r.rows = []; r.nextCursor = null
  r.summary = { scope: 'PAGE', totalEarningsInspected: 0, consistent: 0, missingReversal: 0, missingRestoration: 0, missingRecovery: 0, otherInconsistent: 0, unresolved: 0, totals: [] }
  const h = harness(r)
  assert.ok(text(h.html()).includes('No earnings on this page'))
  assert.ok(text(h.html()).includes('Earnings inspected 0'))
  assert.ok(!text(h.html()).includes('No reconciliation run yet'))
  assert.equal(h.button('Next page').props.disabled, true)
})

for (const [classification, label] of [
  ['CONSISTENT', 'Consistent'], ['MISSING_REVERSAL', 'Missing reversal'], ['EXCESS_REVERSAL', 'Excess reversal'],
  ['MISSING_RESTORATION', 'Missing restoration'], ['EXCESS_RESTORATION', 'Excess restoration'],
  ['MISSING_RECOVERY_OBLIGATION', 'Missing recovery obligation'], ['EXCESS_RECOVERY_OBLIGATION', 'Excess recovery obligation'],
  ['UNRESOLVED_PROVIDER_STATE', 'Provider state unresolved'], ['UNRESOLVED_OWNERSHIP', 'Ownership unresolved'],
  ['CURRENCY_MISMATCH', 'Currency mismatch'],
]) test(`${classification} retains its exact code and distinct readable label`, () => {
  const r = report()
  r.rows[0].classification = classification
  const unresolved = classification.startsWith('UNRESOLVED_') || classification === 'CURRENCY_MISMATCH'
  if (unresolved) Object.assign(r.rows[0], { expectedReversalMinor: null, expectedRestorationMinor: null, expectedRecoveryDueMinor: null, reason: 'FIXTURE_DIAGNOSTIC_CODE' })
  const html = harness(r).html()
  assert.ok(text(html).includes(label))
  assert.ok(html.includes(`<code class="mt-1 block break-all text-xs text-gray500">${classification}</code>`))
  assert.equal(text(html).includes('Requires investigation'), unresolved)
  if (unresolved) {
    assert.equal(text(html).match(/Unavailable \/ \$0.00/g)?.length, 3)
    assert.ok(text(html).includes('This does not establish a financial discrepancy'))
    assert.ok(text(html).includes('FIXTURE_DIAGNOSTIC_CODE'))
  }
})

test('summary counts and all six totals render backend values without recalculating rows', () => {
  const r = report()
  // Intentionally different from the single row: the client must not recompute these.
  Object.assign(r.summary, { totalEarningsInspected: 20, consistent: 1, missingReversal: 2, missingRestoration: 3, missingRecovery: 4, otherInconsistent: 5, unresolved: 5 })
  Object.assign(r.summary.totals[0], { resolvedEarnings: 15, unresolvedEarnings: 5, expectedReversalMinor: '101', recordedReversalMinor: '202', expectedRestorationMinor: '303', recordedRestorationMinor: '404', expectedRecoveryDueMinor: '505', recordedRecoveryDueMinor: '606' })
  r.summary.totals.push({ ...r.summary.totals[0], currency: 'USD' })
  const displayed = text(harness(r).html())
  for (const value of ['Earnings inspected 20', 'Consistent 1', 'Missing reversal 2', 'Missing restoration 3', 'Missing recovery 4', 'Other inconsistent 5', 'Unresolved 5', 'CAD totals: 15 resolved, 5 unresolved', 'USD totals: 15 resolved, 5 unresolved', 'Reversal expected / recorded: $1.01 / $2.02', 'Restoration expected / recorded: $3.03 / $4.04', 'Recovery due expected / recorded: $5.05 / $6.06']) assert.ok(displayed.includes(value), value)
  assert.ok(displayed.includes('page only'))
  assert.ok(displayed.includes('Unresolved rows are excluded from both sides of totals; unknown amounts are not zero'))
  assert.ok(displayed.includes('Net differences determine classification'))
})

test('row amounts and allowed order, beneficiary and payment references are visible', () => {
  const r = report()
  Object.assign(r.rows[0], { expectedReversalMinor: 101, recordedReversalMinor: 202, expectedRestorationMinor: 303, recordedRestorationMinor: 404, expectedRecoveryDueMinor: 505, recordedRecoveryDueMinor: 606 })
  const displayed = text(harness(r).html())
  for (const value of ['ORDER-FIXTURE', 'order-1', 'beneficiary-1', 'PaymentIntent: pi_fixture', 'Transaction: transaction-1', '$1.01 / $2.02', '$3.03 / $4.04', '$5.05 / $6.06']) assert.ok(displayed.includes(value), value)
})

test('integer-string totals retain precision and unavailable amounts never become zero', () => {
  const r = report()
  r.summary.totals[0].expectedRestorationMinor = '9007199254740993'
  r.rows[0].expectedReversalMinor = Number.MAX_SAFE_INTEGER + 1
  const displayed = text(harness(r).html())
  assert.ok(displayed.includes('$90,071,992,547,409.93'))
  assert.ok(displayed.includes('Unavailable / $0.00'))
})

test('next, back and repeat inspection each issue one explicit request with a saved cursor', async () => {
  const h = harness(report(), async () => {
    const r = report(); r.nextCursor = nextId
    return { data: { data: r } }
  })
  await h.click('Next page')
  await h.click('Inspect this page again')
  await h.click('Next page')
  await h.click('Previous page')
  await h.click('Previous page')
  assert.deepEqual(h.calls.map(call => call[1].params), [
    { limit: 5, cursor: firstId }, { limit: 5, cursor: firstId }, { limit: 5, cursor: nextId },
    { limit: 5, cursor: firstId }, { limit: 5 },
  ])
  assert.equal(h.button('Previous page').props.disabled, true)
  h.html()
  assert.equal(h.calls.length, 5)
})

test('failed next page keeps the completed report and cursor, and next retries that request', async () => {
  let fail = true
  const h = harness(report(), async () => {
    if (fail) throw new Error('PRIVATE_PROVIDER_ERROR')
    const r = report(); r.nextCursor = null
    return { data: { data: r } }
  })
  await h.click('Next page')
  assert.ok(text(h.html()).includes('The requested page was not loaded'))
  assert.ok(text(h.html()).includes('Last completed inspection'))
  assert.equal(h.button('Previous page').props.disabled, true)
  assert.doesNotMatch(h.html(), /PRIVATE_PROVIDER_ERROR/)
  fail = false
  await h.click('Next page')
  assert.deepEqual(h.calls[0], h.calls[1])
  assert.equal(h.button('Previous page').props.disabled, false)
  assert.equal(h.button('Next page').props.disabled, true)
  assert.ok(!h.html().includes('role="alert"'))
})

for (const status of [400, 401, 403, 429, 500, 'timeout']) test(`API failure ${status} is a generic error, never an empty success`, async () => {
  const h = harness(null, async () => { throw { response: { status, data: { message: 'PRIVATE_PROVIDER_ERROR' } } } })
  await h.click('Inspect first page')
  assert.ok(h.html().includes('role="alert"'))
  assert.doesNotMatch(h.html(), /PRIVATE_PROVIDER_ERROR|No earnings on this page|No reconciliation run yet/)
  assert.equal(h.button('Inspect first page').props.disabled, false)
  assert.equal(h.calls.length, 1)
})

test('invalid success payload is rejected while retaining the last completed report', async () => {
  const h = harness(report(), async () => ({ data: { data: null } }))
  await h.click('Next page')
  assert.ok(h.html().includes('role="alert"'))
  assert.ok(text(h.html()).includes('Last completed inspection'))
})

test('page-size changes reset history and errors without automatically inspecting', async () => {
  const h = harness(report(), async () => { throw new Error('unavailable') })
  await h.click('Next page')
  const select = elements(h.tree(), 'select')[0]
  assert.deepEqual(elements(select, 'option').map(option => option.props.value), [5, 10, 20])
  select.props.onChange({ target: { value: '20' } })
  assert.ok(text(h.html()).includes('No reconciliation run yet'))
  assert.ok(!h.html().includes('role="alert"'))
  assert.equal(h.calls.length, 1)
  await h.click('Inspect first page')
  assert.deepEqual(h.calls[1][1].params, { limit: 20 })
})

test('restarting first page clears back history only after successful inspection', async () => {
  const h = harness(report())
  await h.click('Next page')
  await h.click('Inspect first page')
  assert.equal(h.button('Previous page').props.disabled, true)
  assert.deepEqual(h.calls[1][1].params, { limit: 5 })
})

for (const classification of ['FUTURE_RESULT', 'toString', '__proto__', '<script>alert(1)</script>', null]) test(`unknown classification ${classification} is safe and never called consistent`, () => {
  const r = report(); r.rows[0].classification = classification
  const html = harness(r).html()
  assert.ok(text(html).includes('Unknown classification'))
  assert.ok(text(html).includes('Requires investigation'))
  assert.doesNotMatch(html, /<script>|text-emerald-700/)
  if (classification === 'FUTURE_RESULT') assert.ok(html.includes(classification))
})

test('only inspection controls exist and extra sensitive payload fields are not exposed', () => {
  const r = report()
  const hidden = { rawStripe: { secret: 'sk_DO_NOT_RENDER' }, card_number: 'CARD_DO_NOT_RENDER', bankDetails: 'BANK_DO_NOT_RENDER', paymentCredentials: 'CREDENTIALS_DO_NOT_RENDER', customer: { email: 'EMAIL_DO_NOT_RENDER' }, sourceKey: 'SOURCE_DO_NOT_RENDER', client_secret: 'CLIENT_SECRET_DO_NOT_RENDER' }
  Object.assign(r, hidden); Object.assign(r.rows[0], hidden); Object.assign(r.summary.totals[0], hidden)
  const h = harness(r)
  assert.deepEqual(elements(h.tree(), 'button').map(button => button.props.children), ['Inspect first page', 'Previous page', 'Next page', 'Inspect this page again'])
  assert.doesNotMatch(h.html(), /DO_NOT_RENDER|rawStripe|sourceKey|client_secret|card_number|bankDetails|paymentCredentials/)
  assert.doesNotMatch(source, /customFetch\.(post|patch|put|delete)|useEffect|JSON\.stringify/)
})
