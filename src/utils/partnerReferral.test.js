import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { actionsFor, referralAction } from './partnerReferral.js'
import { settlementStatusLabel } from './payoutStatus.js'
test('only enrolled pending programs are offered approval', () => {
  assert.deepEqual(actionsFor('NOT_ENROLLED'), [])
  assert.deepEqual(actionsFor('PENDING'), ['APPROVE'])
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


test('admin portfolio consumes shared analytics with factual filters and no opaque score', () => {
  const ui = readFileSync(new URL('../pages/partners.jsx', import.meta.url), 'utf8')
  for (const value of ['analytics/portfolio', 'sessionToCompletedBasisPoints', 'completionBasisPoints', 'cancellationBasisPoints', 'refundBasisPoints', 'tierFilter', 'programFilter', 'activityFilter', 'signals']) assert.match(ui, new RegExp(value))
  assert.doesNotMatch(ui, /partnerScore|customerEmail|pickupAddress|dropoffAddress/)
})
