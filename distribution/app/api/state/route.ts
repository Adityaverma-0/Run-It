import { member, responseError } from "@/lib/auth";
import { getState } from "@/lib/state";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await getState(await member()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return responseError(e);
  }
}
