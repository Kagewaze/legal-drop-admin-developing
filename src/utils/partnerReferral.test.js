import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { actionsFor, partnerActionPath, referralAction, rowActionsFor } from './partnerReferral.js'
import { settlementStatusLabel } from './payoutStatus.js'
test('only enrolled pending programs are offered approval', () => {
  assert.deepEqual(actionsFor('NOT_ENROLLED'), [])
  assert.deepEqual(actionsFor('PENDING'), ['APPROVE'])
})
test('portfolio row actions expose review and approval only for pending enrollment', () => {
  assert.deepEqual(rowActionsFor('PENDING'), ['REVIEW', 'APPROVE'])
  assert.deepEqual(rowActionsFor('ACTIVE'), ['VIEW'])
  assert.deepEqual(rowActionsFor('NOT_ENROLLED'), ['VIEW'])
})
test('approval mutation path uses the exact Business UUID, including for same-name businesses', () => {
  const first = 'ed5099d0-f97e-4829-8f00-a8baf68127fe'
  const second = '0ae2cb2f-9c74-4079-b179-b382504155de'
  assert.equal(partnerActionPath(first), `/admin/partners/${first}/referral-program`)
  assert.equal(partnerActionPath(second), `/admin/partners/${second}/referral-program`)
  assert.notEqual(partnerActionPath(first), partnerActionPath(second))
  assert.throws(() => partnerActionPath('LegalDrop'))
})

test('disable and reenable are distinct, non-destructive actions', () => {
  assert.deepEqual(actionsFor('ACTIVE'), ['DISABLE', 'CHANGE_SLUG'])
  assert.deepEqual(actionsFor('DISABLED'), ['REENABLE'])
})
test('action data carries reason and normalized public slug, never beneficiary identity', () => {
  assert.deepEqual(referralAction('ACTIVE', 'CHANGE_SLUG', ' Rename channel ', ' ACME-Care '), {
    action: 'CHANGE_SLUG',
    reason: 'Rename channel',
    slug: 'acme-care',
  })
})
test('rejects invalid state, blank reason and malformed slug before posting', () => {
  assert.throws(() => referralAction('NOT_ENROLLED', 'APPROVE', 'valid'))
  assert.throws(() => referralAction('ACTIVE', 'DISABLE', '  '))
  assert.throws(() => referralAction('ACTIVE', 'CHANGE_SLUG', 'valid', 'a/b'))
})

test('completed settlement never claims bank receipt',()=>assert.equal(settlementStatusLabel('completed'),'Transfer completed / manual settlement'))

test('admin partner detail uses dedicated attributed order projection',()=>{const page=readFileSync(new URL('../pages/partners.jsx',import.meta.url),'utf8');assert.match(page,/\/referral-orders\?limit=20/);assert.match(page,/publicSlugSnapshot/);assert.match(page,/policyVersion/);assert.doesNotMatch(page,/pickupOtp|trackingToken|receiverAddress/)})


test('pending enrollment review is visible, confirmed, single-submit guarded and refetched', () => {
  const page = readFileSync(new URL('../pages/partners.jsx', import.meta.url), 'utf8')
  for (const value of ['<th>Actions</th>', "open(p.id, 'APPROVE')", 'Business ID:', 'window.confirm', 'if (!detail || busy) return', "customFetch('/admin/partners')", 'setPartners(list.data.data)', 'setError(e.response?.data?.message']) assert.ok(page.includes(value), value)
})

test('Admin route remains protected and backend remains the authorization authority', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /<ProtectedRoute>/)
  assert.match(app, /path="partners" element={<Partners \/>}/)
})

test('admin portfolio consumes shared analytics with factual filters and no opaque score', () => {
  const ui = readFileSync(new URL('../pages/partners.jsx', import.meta.url), 'utf8')
  for (const value of ['analytics/portfolio', 'sessionToCompletedBasisPoints', 'completionBasisPoints', 'cancellationBasisPoints', 'refundBasisPoints', 'tierFilter', 'programFilter', 'activityFilter', 'signals']) assert.match(ui, new RegExp(value))
  assert.doesNotMatch(ui, /partnerScore|customerEmail|pickupAddress|dropoffAddress/)
})

test('admin partner detail shows factual payout readiness without raw banking data', () => {
  const ui = readFileSync(new URL('../pages/partners.jsx', import.meta.url), 'utf8')
  for (const value of ['payoutSummary', 'readinessState', 'maskedSummary', 'heldMinor', 'availableMinor', 'reservedMinor', 'transferredMinor', 'signals', 'automation', 'timezone', 'automation-preview', 'payoutPreview', 'eligiblePayoutMinor', 'recoveryDueMinor']) assert.match(ui, new RegExp(value))
  assert.doesNotMatch(ui, /accountNumber|routingNumber|providerAccountId|providerExternalAccountId|bankPassword/)
})