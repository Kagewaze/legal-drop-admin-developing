/* eslint-env node */
// SYNTHETIC moderation data for local development, tests and browser QA.
//
// Nothing here describes a real person, listing, message or report: every identifier is a made-up
// pattern (a…… accounts, b…… listings, c…… messages, d…… reports, e…… audit rows) and every name and
// text is invented. Production has no moderation data at all, so the dashboard is
// built and tested against these, never against customer reports.

const synthetic = (letter) => (n) => `${letter}${String(n).padStart(7, "0")}-0000-4000-8000-000000000000`;
export const accountId = synthetic("a");
export const listingId = synthetic("b");
export const messageId = synthetic("c");
export const reportId = synthetic("d");
export const actionId = synthetic("e");
export const threadId = synthetic("f");

export const ADMIN = accountId(1);
export const SECOND_ADMIN = accountId(2);
export const BUYER = accountId(11);
export const SELLER = accountId(12);
export const DRIVER = accountId(13);
export const DELETED_ACCOUNT = accountId(14);
export const INACTIVE_ACCOUNT = accountId(15);
export const UNKNOWN_ACCOUNT = accountId(99);

// The portal stores whatever the login route returns. These are labels, not credentials: the mock
// reads them to decide who is calling.
export const TOKENS = {
  admin: "mock-admin",
  customer: "mock-customer",
  formerAdmin: "mock-former-admin",
  expired: "mock-expired",
};

/** What production's configuration yields today (recorded 2026-10-09, backend 071a452). */
export const PRODUCTION_FEATURES = {
  reporting: false,
  blocking: false,
  accountEnforcement: false,
  termsEnforcement: false,
};

export const VOCABULARY = {
  statuses: ["open", "in_review", "actioned", "dismissed"],
  reasons: [
    "spam",
    "harassment",
    "hate",
    "sexual_content",
    "threat",
    "fraud",
    "prohibited_item",
    "impersonation",
    "suspicious_activity",
    "other",
  ],
  targetTypes: ["user", "listing", "message"],
  listingKinds: ["general", "vehicle"],
  decisions: {
    actioned: ["content_removed", "account_suspended", "warning_issued"],
    dismissed: ["no_violation", "insufficient_evidence", "duplicate"],
  },
  actions: [
    "report_review_started",
    "report_actioned",
    "report_dismissed",
    "evidence_viewed",
    "listing_removed",
    "listing_restored",
    "account_suspended",
    "account_reinstated",
    "account_status_changed",
  ],
  subjectTypes: ["report", "listing", "user"],
};

export const NOTE_MAX_LENGTH = 2000;
export const EVIDENCE_CONTEXT_WINDOW = 10;

const at = (minutes) => new Date(Date.UTC(2026, 9, 1, 12, 0, 0) + minutes * 60000).toISOString();

export function syntheticAccounts() {
  return [
    { id: ADMIN, firstName: "Ada", lastName: "Admin", role: "ADMIN", status: "active", deletedAt: null },
    { id: SECOND_ADMIN, firstName: "Sam", lastName: "Second", role: "ADMIN", status: "active", deletedAt: null },
    { id: BUYER, firstName: "Bao", lastName: "Yang", role: "USER", status: "active", deletedAt: null },
    { id: SELLER, firstName: "Sela", lastName: "Rivers", role: "USER", status: "active", deletedAt: null },
    { id: DRIVER, firstName: "Dee", lastName: "Okoro", role: "RIDER", status: "active", deletedAt: null },
    { id: DELETED_ACCOUNT, firstName: "Gone", lastName: "Account", role: "USER", status: "active", deletedAt: at(-500) },
    { id: INACTIVE_ACCOUNT, firstName: "Ina", lastName: "Ctive", role: "USER", status: "inactive", deletedAt: null },
  ];
}

export function syntheticListings() {
  return [
    { id: listingId(1), kind: "general", title: "Synthetic listing: folding bike", status: "active", sellerId: SELLER },
    // Removed by a moderator (see syntheticActions): restoring it returns it to "active".
    { id: listingId(2), kind: "vehicle", title: "Synthetic listing: cargo van", status: "removed", sellerId: SELLER },
    { id: listingId(3), kind: "general", title: "Synthetic listing: desk lamp", status: "sold", sellerId: SELLER },
    { id: listingId(4), kind: "general", title: "Synthetic listing: removed elsewhere", status: "removed", sellerId: SELLER },
  ];
}

/** One Marketplace thread of 16 messages (the reported one is the 13th) and one short DropBatch thread. */
export function syntheticThreads() {
  const marketplace = Array.from({ length: 16 }, (_, index) => ({
    id: messageId(index + 1),
    threadId: threadId(1),
    senderUserId: index % 2 === 0 ? SELLER : BUYER,
    body: index === 12 ? "Synthetic reported message: this text is the subject of the report." : `Synthetic message ${index + 1}`,
    attachments: index === 14 ? ["https://example.invalid/synthetic/attachment-1.jpg"] : [],
    createdAt: at(index),
  }));
  const dropbatch = Array.from({ length: 3 }, (_, index) => ({
    id: messageId(100 + index),
    threadId: threadId(2),
    senderUserId: index === 1 ? DRIVER : BUYER,
    body: index === 1 ? "Synthetic reported DropBatch message." : `Synthetic DropBatch message ${index + 1}`,
    attachments: [],
    createdAt: at(200 + index),
  }));
  return { marketplace, dropbatch };
}

const report = (n, over) => ({
  id: reportId(n),
  createdAt: at(1000 + n * 7),
  updatedAt: at(1000 + n * 7),
  reporterUserId: BUYER,
  reportedUserId: SELLER,
  targetType: "user",
  targetId: SELLER,
  targetKind: null,
  contextId: null,
  reason: "spam",
  details: null,
  evidence: {},
  status: "open",
  decision: null,
  resolutionNote: null,
  resolvedAt: null,
  resolvedByUserId: null,
  ...over,
});

/** 23 reports: nine written by hand for specific cases, the rest generated so the queue paginates. */
export function syntheticReports() {
  const handwritten = [
    report(1, {
      targetType: "listing",
      targetKind: "general",
      targetId: listingId(1),
      reason: "prohibited_item",
      details: "Synthetic explanation: the reporter says this item is not allowed.",
      evidence: {
        title: "Synthetic listing: folding bike",
        description: "Synthetic description captured when the report was filed.",
        descriptionTruncated: false,
        price: "120.00",
        photos: ["https://example.invalid/synthetic/photo-1.jpg", "https://example.invalid/synthetic/photo-2.jpg"],
        status: "active",
      },
    }),
    report(2, {
      targetType: "message",
      targetKind: "marketplace",
      targetId: messageId(13),
      contextId: threadId(1),
      reason: "harassment",
      details: "Synthetic explanation: the reporter found this message abusive.",
      evidence: {
        body: "Synthetic reported message: this text is the subject of the report.",
        bodyTruncated: false,
        attachments: [],
        sentAt: at(12),
        listingId: listingId(1),
        listingKind: "general",
      },
    }),
    report(3, {
      status: "in_review",
      reason: "impersonation",
      details: "Synthetic explanation: the reporter believes this account pretends to be a business.",
    }),
    report(4, {
      targetType: "listing",
      targetKind: "vehicle",
      targetId: listingId(2),
      reason: "fraud",
      status: "actioned",
      decision: "content_removed",
      resolutionNote: "Synthetic note: the listing misdescribed the vehicle.",
      resolvedAt: at(2000),
      resolvedByUserId: ADMIN,
      evidence: {
        title: "Synthetic listing: cargo van",
        description: "Synthetic vehicle description.",
        descriptionTruncated: true,
        price: "8400.00",
        photos: [],
        status: "active",
      },
    }),
    report(5, {
      reason: "other",
      details: "Synthetic explanation for a report that was dismissed.",
      status: "dismissed",
      decision: "no_violation",
      resolvedAt: at(2100),
      resolvedByUserId: SECOND_ADMIN,
    }),
    report(6, {
      reportedUserId: DRIVER,
      targetType: "message",
      targetKind: "dropbatch",
      targetId: messageId(101),
      contextId: threadId(2),
      reason: "threat",
      evidence: {
        body: "Synthetic reported DropBatch message.",
        bodyTruncated: false,
        attachments: [],
        sentAt: at(201),
      },
    }),
    report(7, {
      targetType: "listing",
      targetKind: "general",
      targetId: listingId(3),
      reason: "suspicious_activity",
      evidence: {
        title: "Synthetic listing: desk lamp",
        description: "Synthetic description of a listing that has since been sold.",
        descriptionTruncated: false,
        price: "15.00",
        photos: [],
        status: "active",
      },
    }),
    report(8, { reportedUserId: SECOND_ADMIN, targetId: SECOND_ADMIN, reason: "harassment" }),
    report(9, { reportedUserId: DELETED_ACCOUNT, targetId: DELETED_ACCOUNT, reason: "spam" }),
  ];
  const generated = Array.from({ length: 14 }, (_, index) => {
    const n = index + 10;
    return report(n, {
      reason: VOCABULARY.reasons[n % VOCABULARY.reasons.length],
      reporterUserId: n % 3 === 0 ? DRIVER : BUYER,
    });
  });
  return [...handwritten, ...generated];
}

/** The audit rows that go with the two resolved reports above. */
export function syntheticActions() {
  const action = (n, over) => ({
    id: actionId(n),
    createdAt: at(1990 + n),
    actorUserId: ADMIN,
    action: "report_review_started",
    reportId: reportId(4),
    subjectType: "report",
    subjectId: reportId(4),
    subjectKind: null,
    note: null,
    metadata: {},
    ...over,
  });
  return [
    action(1, {}),
    action(2, {
      action: "listing_removed",
      subjectType: "listing",
      subjectId: listingId(2),
      subjectKind: "vehicle",
      note: "Synthetic reason: misdescribed vehicle.",
      metadata: { previousStatus: "active" },
    }),
    action(3, {
      action: "report_actioned",
      note: "Synthetic note: the listing misdescribed the vehicle.",
      metadata: { decision: "content_removed" },
    }),
    action(4, {
      actorUserId: SECOND_ADMIN,
      action: "report_dismissed",
      reportId: reportId(5),
      subjectId: reportId(5),
      metadata: { decision: "no_violation" },
    }),
    action(5, { action: "report_review_started", reportId: reportId(3), subjectId: reportId(3) }),
  ];
}
