import customFetch from "../../utils/customFetch";
import { createModerationApi } from "../../utils/moderationApi";

// The moderation routes on the portal's own HTTP client: the same base URL, the same bearer token,
// the same interceptors as every other page. There is no second client and no second sign-in.
export const moderationApi = createModerationApi(customFetch);
