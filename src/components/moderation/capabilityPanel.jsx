/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { describeCapabilities, reportingInactiveNotice } from "../../utils/moderation";
import { STATE_TONES, cardClass, eyebrowClass } from "./styles";
import { Badge, Notice } from "./ui";

/**
 * Which safety features are in effect — DISABLED, AVAILABLE or ENFORCED — from
 * `GET admin/moderation/capabilities`.
 *
 * ⚠️ READ-ONLY. There is no control here that changes a feature, and there must never be one: the
 * states are part of a release. Only what the backend reports is shown — no setting names, no
 * values, nothing about how the service is configured.
 * Props: capabilities (the route's `data`, or null while unknown).
 */
export function CapabilityPanel({ capabilities }) {
  const view = describeCapabilities(capabilities);
  if (!view) return null;
  return (
    <section aria-labelledby="safety-feature-status" className={cardClass}>
      <h2 id="safety-feature-status" className="text-lg font-semibold text-gray900">
        Safety feature status
      </h2>
      <p className="mt-1 text-sm text-gray600">
        What is in effect right now. This screen cannot change any of it.
      </p>
      <ul className="mt-4 divide-y divide-gray100">
        {view.rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="font-semibold text-gray900">{row.name}</p>
              <p className="mt-0.5 text-sm text-gray600">{row.detail}</p>
            </div>
            <Badge tone={STATE_TONES[row.state]}>{row.state}</Badge>
          </li>
        ))}
      </ul>
      <h3 className={`${eyebrowClass} mt-4`}>Published policies</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {view.policies.map((policy) => (
          <li key={policy.policyId} className="flex items-center justify-between gap-3 rounded-lg bg-gray50 p-3 text-sm">
            <span className="font-medium text-gray800">
              {policy.label}
              {policy.version ? <span className="ml-2 font-normal text-gray600">version {policy.version}</span> : null}
            </span>
            <Badge tone={STATE_TONES[policy.state]}>{policy.state}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The standing warning while suspension enforcement is off: a recorded suspension restricts nothing.
 * Props: capabilities.
 */
export function EnforcementNotice({ capabilities }) {
  const view = describeCapabilities(capabilities);
  if (!view?.enforcementOff) return null;
  return (
    <Notice tone="warning" title="Account suspension enforcement is DISABLED">
      A suspension recorded now is saved and audited, but the account can still sign in. A recorded suspension could
      take effect if enforcement is activated later.
    </Notice>
  );
}

/** Why an empty queue is empty while reporting is off. Props: capabilities. */
export function ReportingNotice({ capabilities }) {
  const notice = reportingInactiveNotice(capabilities);
  if (!notice) return null;
  return (
    <Notice tone="info" title={notice.title}>
      {notice.detail}
    </Notice>
  );
}
