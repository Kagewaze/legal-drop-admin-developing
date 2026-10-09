/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { useRef, useState } from "react";
import { conversationView, formatDateTime } from "../../utils/moderation";
import { createOnce } from "../../utils/moderationApi";
import { cardClass, linkClass, primaryButton, secondaryButton } from "./styles";
import { Badge, ConfirmDialog, Notice } from "./ui";

/**
 * The surrounding conversation, once it has been opened. Props: view (conversationView's result).
 * The reported message is marked; every other message is context. Attachments are counted and
 * linked, never loaded into the page.
 */
export function ConversationMessages({ view }) {
  if (!view.messages.length) {
    return (
      <Notice tone="info" title="The conversation is no longer available">
        The thread or the message has been removed. The snapshot submitted with the report still stands.
      </Notice>
    );
  }
  return (
    <ol aria-label={`${view.sourceLabel} messages, oldest first`} className="space-y-2">
      {view.messages.map((message) => (
        <li
          key={message.id}
          className={`rounded-lg border p-3 text-sm ${message.reported ? "border-amber-300 bg-amber-50" : "border-gray200 bg-white"}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray600">
            <span className="font-semibold text-gray900">{message.roleLabel}</span>
            <span>{formatDateTime(message.createdAt)}</span>
            {message.reported ? <Badge tone="warning">Reported message</Badge> : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-gray900">{message.body}</p>
          {message.attachmentCount ? (
            <p className="mt-1 text-xs text-gray600">
              {message.attachmentCount} attachment{message.attachmentCount === 1 ? "" : "s"} (not loaded)
              {message.attachmentLinks.map((href, index) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={`${linkClass} ml-2`}>
                  Open attachment {index + 1}
                </a>
              ))}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The private evidence viewer for a message report.
 *
 * ⚠️ OPENING THE CONVERSATION IS AN AUDITED WRITE. `POST reports/:id/evidence` records the
 * administrator every time it is called, so it is requested ONLY from the confirmation below:
 *   - never when the page renders, never from an effect, never on hover or focus;
 *   - once per confirmation — the request is wrapped in createOnce, so a double click or a
 *     re-render cannot send it twice;
 *   - the messages live in this component's state and nowhere else, and "Hide" discards them.
 * Viewing again after hiding is a new deliberate action, and the screen says it is recorded again.
 *
 * Props: report (the loaded report), api ({ openEvidence }), onViewed() — called after a
 * successful view so the report's history can show the new audit entry; contextWindow (how many
 * messages either side the backend returns).
 */
export function ConversationEvidence({ report, api, onViewed, contextWindow = 10 }) {
  const [phase, setPhase] = useState("closed");
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState(null);
  const request = useRef(null);
  const handling = useRef(false);

  function ask() {
    setError(null);
    // One submitter per confirmation.
    request.current = createOnce(() => api.openEvidence(report.id));
    setPhase("confirming");
  }

  async function confirm() {
    const run = request.current;
    // A second click while the first is being handled does nothing at all.
    if (!run || handling.current) return;
    handling.current = true;
    setPhase("loading");
    const result = await run();
    handling.current = false;
    request.current = null;
    if (result.ok) {
      setEvidence(result.data);
      setPhase("open");
      onViewed?.();
    } else {
      setError(result.error);
      setPhase("closed");
    }
  }

  function hide() {
    setEvidence(null);
    request.current = null;
    setPhase("closed");
  }

  return (
    <section aria-labelledby="conversation-evidence" className={cardClass}>
      <h2 id="conversation-evidence" className="text-lg font-semibold text-gray900">
        Conversation evidence
      </h2>
      <p className="mt-1 text-sm text-gray600">
        The messages around the reported one are other people&apos;s private conversation. They are not loaded with this
        page. Each time they are viewed, the access is recorded in the moderation audit history under your
        administrator account.
      </p>

      {error ? (
        <div className="mt-3">
          <Notice tone="error" title="The conversation could not be opened">
            {error.message}
          </Notice>
        </div>
      ) : null}

      {phase === "open" && evidence ? (
        <div className="mt-4 space-y-3">
          <Notice tone="info" title="Access recorded">
            This viewing was added to the audit history. Viewing again after hiding will be recorded again.
          </Notice>
          <ConversationMessages view={conversationView(evidence, report)} />
          <button type="button" className={secondaryButton} onClick={hide}>
            Hide conversation
          </button>
        </div>
      ) : (
        <button type="button" className={`${primaryButton} mt-4`} onClick={ask} disabled={phase === "loading"}>
          View conversation evidence
        </button>
      )}

      {phase === "confirming" || phase === "loading" ? (
        <ConfirmDialog
          title="View private conversation evidence?"
          confirmLabel="Record access and view"
          busyLabel="Opening…"
          busy={phase === "loading"}
          onConfirm={confirm}
          onClose={() => setPhase("closed")}
        >
          <p>
            You are about to open up to {contextWindow} messages either side of the reported message. They include
            messages written by people other than the reported account.
          </p>
          <p className="font-semibold text-gray900">This access is audited: it will be recorded with your administrator account.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
