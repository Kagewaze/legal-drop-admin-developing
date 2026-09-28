/* eslint-env node */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'
import * as financial from './partnerCommission.js'
import * as referral from './partnerReferral.js'

const require = createRequire(import.meta.url)
const page = readFileSync(new URL('../pages/partners.jsx', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(page, 'partners.jsx', { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const module = { exports: {} }
let state
const noRequest = () => { throw new Error('No API or provider calls permitted') }
new Function('require', 'module', 'exports', code)(name => {
  if (name === 'react') return { ...React, useEffect: () => {}, useState: () => [state.shift(), noRequest] }
  if (name === 'react-toastify') return { toast: noRequest }
  if (name === '../utils/customFetch') return noRequest
  if (name === '../utils/partnerReferral') return referral
  if (name === '../utils/partnerCommission') return financial
  return require(name)
}, module, module.exports)
const { Partners } = module.exports
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
function render({ reversed = 0, restored = 0, net = 43, recovery = 0, entryType = 'RESTORATION', commissionStatus = 'RESTORED' } = {}) {
  const hidden = { sourceKey: 'SOURCE_SECRET', rawStripe: { secret: 'RAW_SECRET' }, paymentCredentials: 'CREDENTIAL_SECRET' }
  const detail = { status: 'ACTIVE', business: { id: 'business-1', name: 'Fixture Partner' }, contact: {}, beneficiary: { exists: true, status: 'ACTIVE' }, metrics: { currency: 'CAD' }, history: [], financial: { grossEligibleBasisMinor: 1446, referralAdjustmentRevenueCollectedMinor: 43, pendingCommissionMinor: 0, grossEarnedCommissionMinor: 43, reversalMinor: reversed, restoredMinor: restored, recoveryDueMinor: recovery, netCommissionLiabilityMinor: net, ...hidden } }
  const balances = [{ currency: 'CAD', pendingEstimateMinor: 0, grossEarnedMinor: 43, reversedMinor: reversed, restoredMinor: restored, recoveryDueMinor: recovery, netEarnedMinor: net, availableMinor: 0, ...hidden }]
  const entries = [{ id: 'entry-1', orderId: 'order-1', earnedAt: '2026-09-01', currency: 'CAD', entryType, amountMinor: entryType === 'REVERSAL' ? -43 : restored, eligibleBasisMinor: 1446, commissionRateBasisPoints: 300, restoresCommissionId: 'reversal-link-1', ...hidden }]
  const orders = [{ reference: 'REF-1', orderValue: { amountMinor: 1489, currency: 'CAD' }, commissionStatus, commissionAmountMinor: net }]
  const reconciliation = [{ beneficiaryId: 'beneficiary-1', currency: 'CAD', period: '2026-09', earnedMinor: '43', reversalMinor: String(-reversed), restoredMinor: String(restored), netLiabilityMinor: String(net), consistent: true, ...hidden }]
  // Supply the screen's read-only query states; effects and all mutations are disabled.
  state = [[], detail, orders, { balances, entries }, reconciliation, [], null, null, null, 'THIS_MONTH', '', 'ALL', 'ALL', 'ALL', '', '', false, false, false, '', null]
  return renderToStaticMarkup(React.createElement(Partners))
}
for (const [name, reversed, restored, net] of [
  ['earning only', 0, 0, 43], ['full reversal', 43, 0, 0], ['partial reversal', 22, 0, 21],
  ['partial restoration', 43, 11, 11], ['full restoration', 43, 43, 43],
]) test(name + ' is rendered from backend financial detail and numeric-string reconciliation', () => {
  const html = render({ reversed, restored, net })
  const displayed = text(html)
  for (const [label, value] of [['Eligible basis', 1446], ['Gross earned', 43], ['Reversals', reversed], ['Restored', restored], ['Net liability', net]]) assert.ok(displayed.includes(`${label} ${financial.money(value)}`), label)
  const reconciliation = html.slice(html.indexOf('reconciliation-heading'), html.indexOf('partner-detail'))
  assert.ok(text(reconciliation).includes('Earned Reversals Restored Net liability'))
  assert.ok(text(reconciliation).includes(`$0.43 ${financial.money(-reversed)} ${financial.money(restored)} ${financial.money(net)}`))
  assert.doesNotMatch(html, /SOURCE_SECRET|RAW_SECRET|CREDENTIAL_SECRET/)
})
test('Admin keeps backend net liability even if component amounts do not add up locally', () => {
  assert.ok(text(render({ reversed: 43, restored: 11, net: 9 })).includes('Net liability $0.09'))
})
test('Admin distinguishes zero and outstanding recovery without asserting a bank debit', () => {
  assert.ok(text(render()).includes('Recovery due $0.00'))
  const html = text(render({ reversed: 43, recovery: 43, net: 0 }))
  assert.ok(html.includes('Recovery due $0.43'))
  assert.doesNotMatch(html, /already recovered|bank debited/i)
})
test('Admin ledger labels restorations and their reversal link operationally, with signed reversals', () => {
  const restored = text(render({ restored: 11 }))
  assert.ok(restored.includes('Commission restored'))
  assert.ok(restored.includes('Restores reversal: reversal-link-1'))
  const reversed = text(render({ entryType: 'REVERSAL', reversed: 43 }))
  assert.ok(reversed.includes('Commission reversed'))
  assert.ok(reversed.includes('-$0.43'))
  assert.ok(!reversed.includes('Restores reversal:'))
})
test('new and unknown statuses/types have safe labels', () => {
  assert.ok(text(render({ commissionStatus: 'PARTIALLY_REVERSED' })).includes('Partially reversed'))
  assert.ok(text(render({ commissionStatus: 'RESTORED' })).includes('Restored'))
  assert.ok(text(render({ commissionStatus: 'FUTURE_STATE', entryType: 'FUTURE_TYPE' })).includes('Commission adjustment'))
  assert.ok(text(render({ commissionStatus: null, entryType: null })).includes('Status unavailable'))
})
test('decimal integer strings display exactly without unsafe Number conversion or dollar arithmetic', () => {
  assert.equal(financial.money('9007199254740993'), '$90,071,992,547,409.93')
  assert.equal(financial.money('-1'), '-$0.01')
  assert.equal(financial.money('43'), '$0.43')
  for (const bad of [undefined, null, '', '1.5', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(financial.money(bad), 'Unavailable')
  assert.equal(financial.money(43, 'INVALID'), 'Unavailable')
})
