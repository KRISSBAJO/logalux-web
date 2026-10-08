// What is waiting for an answer after the sale: return requests for online orders and
// problems clients reported about a visit. Loaded once per request, for the side menu
// and for the chips on Inventory and Inbox. Only managers and the owner may answer either.
import { cache } from "react";
import { getMe, mCan, mLoad, type Row } from "@/lib/merchant-api";

export const careCounts = cache(async (): Promise<{ returns: number; problems: number }> => {
  if (!mCan(await getMe(), "manager")) return { returns: 0, problems: 0 };
  const [r, p] = await Promise.all([mLoad("/returns?status=requested"), mLoad("/problems")]);
  return {
    returns: ((r.data.returns ?? []) as Row[]).length,
    problems: ((p.data.problems ?? []) as Row[]).filter((x) => x.status === "with_business").length,
  };
});
