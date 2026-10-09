/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { useState } from "react";
import { decisionLabel, describeCapabilities, listingStatusLabel, validateNote } from "../../utils/moderation";
import { ConfirmDialog, Notice, ReasonField } from "./ui";

/**
 * Confirms a final decision. Props: decision, note, busy, error, onConfirm(), onClose().
 * ⚠️ It says what recording a decision does NOT do, before it is recorded.
 */
export function ResolveDialog({ decision, note, busy, error, onConfirm, onClose }) {
  const text = validateNote(note).trimmed;
  return (
    <ConfirmDialog
      title="Record this decision?"
      confirmLabel="Record decision"
      busyLabel="Recording…"
      busy={busy}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p>
        Decision: <strong className="text-gray900">{decisionLabel(decision)}</strong>
      </p>
      {text ? <p className="whitespace-pre-wrap break-words">Note: {text}</p> : <p>No note will be recorded.</p>}
      <p>This is final. A resolved report cannot be reopened or decided again.</p>
      <p className="font-semibold text-gray900">
        Recording a decision does not remove content or suspend an account. Those are separate actions on this page.
      </p>
    </ConfirmDialog>
  );
}

/**
 * Removing or restoring a listing. Props: verb ("remove" | "restore"), status (the listing's
 * current status), max, busy, error, onConfirm(reason), onClose().
 */
export function ListingActionDialog({ verb, status, max, busy, error, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const removing = verb === "remove";
  return (
    <ConfirmDialog
      title={removing ? "Remove this listing from Marketplace?" : "Restore this listing?"}
      confirmLabel={removing ? "Remove listing" : "Restore listing"}
      busyLabel={removing ? "Removing…" : "Restoring…"}
      tone={removing ? "danger" : "primary"}
      busy={busy}
      error={error}
      confirmDisabled={!validateNote(reason, { required: true, max }).ok}
      onConfirm={() => onConfirm(reason)}
      onClose={onClose}
    >
      <p>
        Current status: <strong className="text-gray900">{listingStatusLabel(status)}</strong>
      </p>
      {removing ? (
        <p>
          The listing leaves browse, listing detail and the home feed at once. Its conversations, offers and any order
          made from it are left as they are.
        </p>
      ) : (
        <p>
          The listing returns to the status it had before a moderator removed it. That is not necessarily
          &ldquo;active&rdquo;: the result will say which status it returned to.
        </p>
      )}
      <ReasonField
        id={`listing-${verb}-reason`}
        label="Reason (required)"
        value={reason}
        onChange={setReason}
        max={max}
        required
        disabled={busy}
        hint="Recorded in the audit history with your administrator account."
      />
    </ConfirmDialog>
  );
}

/**
 * Recording a suspension or a reinstatement. Props: verb ("suspend" | "reinstate"), capabilities
 * (null when they could not be loaded), max, busy, error, onConfirm(reason), onClose().
 *
 * ⚠️ BEFORE THE ADMINISTRATOR CONFIRMS, it says what will actually happen: with enforcement off a
 * suspension is recorded and nothing is restricted. It never promises that access will be revoked
 * unless enforcement is reported on, and the result panel repeats what the backend says happened.
 */
export function AccountActionDialog({ verb, capabilities, max, busy, error, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const view = describeCapabilities(capabilities);
  const suspending = verb === "suspend";
  const enforcing = view ? !view.enforcementOff : null;

  let effect;
  if (enforcing === null) {
    effect = (
      <Notice tone="info" title="Enforcement state could not be confirmed">
        The result will say whether the account is actually restricted.
      </Notice>
    );
  } else if (suspending && !enforcing) {
    effect = (
      <Notice tone="warning" title="Suspension enforcement is DISABLED">
        <p>This records the suspension and audits it. The account will still be able to sign in.</p>
        <p className="mt-1">A recorded suspension could take effect if enforcement is activated later.</p>
      </Notice>
    );
  } else if (suspending) {
    effect = (
      <Notice tone="warning" title="Suspension enforcement is ENFORCED">
        The account will be signed out and refused sign-in and API access.
      </Notice>
    );
  } else if (enforcing) {
    effect = (
      <Notice tone="info" title="Suspension enforcement is ENFORCED">
        The account&apos;s access is restored as soon as the reinstatement is recorded.
      </Notice>
    );
  } else {
    effect = (
      <Notice tone="info" title="Suspension enforcement is DISABLED">
        This changes the recorded status only. The account was not being restricted.
      </Notice>
    );
  }

  return (
    <ConfirmDialog
      title={suspending ? "Record a suspension for this account?" : "Reinstate this account?"}
      confirmLabel={suspending ? (enforcing ? "Suspend account" : "Record suspension") : "Reinstate account"}
      busyLabel="Recording…"
      tone={suspending ? "danger" : "primary"}
      busy={busy}
      error={error}
      confirmDisabled={!validateNote(reason, { required: true, max }).ok}
      onConfirm={() => onConfirm(reason)}
      onClose={onClose}
    >
      {effect}
      <ReasonField
        id={`account-${verb}-reason`}
        label="Reason (required)"
        value={reason}
        onChange={setReason}
        max={max}
        required
        disabled={busy}
        hint="Recorded in the audit history with your administrator account."
      />
    </ConfirmDialog>
  );
}
