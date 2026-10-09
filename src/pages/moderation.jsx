import { useCallback } from "react";
import { moderationApi } from "../components/moderation/api";
import { OverviewBody } from "../components/moderation/overview";
import { ModerationPage } from "../components/moderation/ui";
import { useLoader } from "../components/moderation/useLoader";
import { loadOverview } from "../utils/moderationApi";

/** /moderation — counts, recent activity and which safety features are in effect. Read-only. */
export function ModerationOverview() {
  const loader = useCallback(() => loadOverview(moderationApi), []);
  const { loading, value, refresh } = useLoader(loader);
  return (
    <ModerationPage
      title="Moderation"
      description="Reports about Marketplace listings, chat messages and accounts: what has been received, what has been decided and what is actually enforced."
    >
      <OverviewBody loading={loading} overview={value} onRetry={refresh} />
    </ModerationPage>
  );
}
