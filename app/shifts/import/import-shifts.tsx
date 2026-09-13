"use client";

/**
 * MOUNT POINT — owned by P37c (Excel import UI). Created by the manager as a stub so P37a can mount
 * it on the Shifts screen before P37c exists, without either parcel editing the other's file.
 *
 * FROZEN PROPS. P37c may add optional props; it may not rename or remove these.
 *
 *  - no `target`: the screen-level entry. A button, plus a drop target for the whole Shifts page —
 *    the coordinator drags the client's file anywhere onto it.
 *  - with `target`: import straight into one existing section (programme), from that section's
 *    header. Campaign and section are already decided, so the wizard skips those steps.
 */
export type ImportShiftsProps = {
  target?: {
    programmeId: string;
    programmeName: string;
    campaignId: string;
  };
};

export function ImportShifts(_props: ImportShiftsProps) {
  return null;
}
