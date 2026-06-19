import { BaseQueryFn, FetchArgs, FetchBaseQueryError, skipToken } from "@reduxjs/toolkit/query";
import { RootState } from "../store";
import { baseQueryWithReauth } from "./baseQueryWithReauth";

export const baseQueryWithProfileGuard: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const state = api.getState() as RootState;
  const selectedProfile = state.auth.selectedProfile;
  const isImpersonating =
    typeof localStorage !== "undefined" && localStorage.getItem("impersonationActive") === "true";

  const url = typeof args === "string" ? args : args.url;
    // console.log('url', url)
  // ✅ allowlist public endpoints (invite/sign-in pages need these without a profile)
  const isPublicEndpoint =
    url.startsWith("/auth") ||
    url.startsWith("/organizations") ||
    url.startsWith("/permissions") ||
    url.startsWith("/invites") ||
    url.startsWith("/org-storage");

  // 🚫 silently skip if profile required but missing (allow when impersonating – profile id comes from localStorage)
  if (!isPublicEndpoint && !selectedProfile && !isImpersonating) {
    return { data: skipToken } as { data: typeof skipToken }; // no error, no request
  }

  // 👉 forward to your existing reauth baseQuery
  return baseQueryWithReauth(args, api, extraOptions);
};
