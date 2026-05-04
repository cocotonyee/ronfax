import type { FaxTrackRecord } from "@/lib/fax-track";
import { getTrackTokenForPhaxioFax, updateTrackRecord } from "@/lib/fax-track";
import { mapPhaxioToUi } from "@/lib/phaxio-status";

/**
 * Applies Phaxio **outbound** send callbacks (`direction=sent`) to our Redis track record.
 */
export async function applyPhaxioOutboundStatus(params: {
  faxId: string | number;
  statusRaw: string;
  errorMessage?: string | null;
}): Promise<boolean> {
  const token = await getTrackTokenForPhaxioFax(params.faxId);
  if (!token) {
    console.warn(
      "[Phaxio outbound] no Redis mapping for fax id — send may predate fax→track linking",
      params.faxId,
    );
    return false;
  }

  const ui = mapPhaxioToUi(params.statusRaw);
  const patch: Partial<FaxTrackRecord> = {
    phaxioLastStatus: params.statusRaw,
  };

  if (ui === "failure") {
    patch.deliveryStatus = "failure";
    const err =
      typeof params.errorMessage === "string" && params.errorMessage.trim()
        ? params.errorMessage.trim()
        : "Transmission failed";
    patch.errorMessage = err;
  } else if (ui === "success") {
    patch.deliveryStatus = "success";
    patch.errorMessage = "";
  }

  await updateTrackRecord(token, patch);
  return true;
}
