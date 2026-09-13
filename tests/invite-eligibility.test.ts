import { describe, expect, it } from "vitest";
import {
  checkInviteEligibility,
  type AvailabilityWindow,
  type ConfirmedShiftWindow,
  type InviteEligibilityInput,
} from "@/lib/invite-eligibility";

// Hand-built fixtures only — this file is pure and takes plain inputs, no Supabase involved.
// See tests/README.md.

function baseInput(overrides: Partial<InviteEligibilityInput> = {}): InviteEligibilityInput {
  return {
    promoterStatus: "active",
    isBlocklistedForClient: false,
    alreadyConfirmedOnThisShift: false,
    hasPendingInvitationForThisShift: false,
    shift: { onDate: "2026-06-15", startTime: "10:00", endTime: "14:00" },
    otherConfirmedShifts: [],
    availabilityOnShiftDate: [{ status: "available", fromTime: null, toTime: null }],
    distanceM: 1000,
    travelRadiusM: 60_000,
    campaignHasPublishedBrief: false,
    briefAcknowledged: false,
    ...overrides,
  };
}

describe("checkInviteEligibility — clean case", () => {
  it("allows sending with no blocking and no warnings when everything lines up", () => {
    const result = checkInviteEligibility(baseInput());
    expect(result).toEqual({ blocking: [], warnings: [], canSend: true });
  });
});

describe("checkInviteEligibility — blocking rules", () => {
  it("blocks an archived promoter", () => {
    const result = checkInviteEligibility(baseInput({ promoterStatus: "archived" }));
    expect(result.blocking).toEqual(["archived"]);
    expect(result.canSend).toBe(false);
  });

  it("blocks a promoter whose status is blocklisted", () => {
    const result = checkInviteEligibility(baseInput({ promoterStatus: "blocklisted" }));
    expect(result.blocking).toContain("blocklisted");
    expect(result.canSend).toBe(false);
  });

  it("blocks a promoter on the agency/client blocklist even when status is active", () => {
    const result = checkInviteEligibility(baseInput({ isBlocklistedForClient: true }));
    expect(result.blocking).toEqual(["blocklisted"]);
  });

  it("blocks when already confirmed on this exact shift", () => {
    const result = checkInviteEligibility(baseInput({ alreadyConfirmedOnThisShift: true }));
    expect(result.blocking).toEqual(["already_confirmed"]);
  });

  it("blocks when a pending invitation already exists for this exact shift", () => {
    const result = checkInviteEligibility(baseInput({ hasPendingInvitationForThisShift: true }));
    expect(result.blocking).toEqual(["pending_invitation"]);
  });

  it("does not block on a merely declined or expired invitation for this shift", () => {
    // The caller only ever passes `true` for an unexpired pending one — declines and expiries
    // are exactly what this feature exists to let a coordinator override.
    const result = checkInviteEligibility(baseInput({ hasPendingInvitationForThisShift: false }));
    expect(result.blocking).not.toContain("pending_invitation");
  });

  it("blocks when confirmed on another shift that overlaps in time, same day", () => {
    const other: ConfirmedShiftWindow = { onDate: "2026-06-15", startTime: "09:00", endTime: "11:00" };
    const result = checkInviteEligibility(baseInput({ otherConfirmedShifts: [other] }));
    expect(result.blocking).toEqual(["overlapping_confirmed_shift"]);
  });

  it("does NOT block back-to-back shifts — one ending exactly when the other starts", () => {
    const backToBack: ConfirmedShiftWindow = { onDate: "2026-06-15", startTime: "06:00", endTime: "10:00" };
    const result = checkInviteEligibility(baseInput({ otherConfirmedShifts: [backToBack] }));
    expect(result.blocking).not.toContain("overlapping_confirmed_shift");
    expect(result.canSend).toBe(true);

    // And the mirror case: the candidate shift ends exactly when the other one starts.
    const backToBack2: ConfirmedShiftWindow = { onDate: "2026-06-15", startTime: "14:00", endTime: "18:00" };
    const result2 = checkInviteEligibility(baseInput({ otherConfirmedShifts: [backToBack2] }));
    expect(result2.blocking).not.toContain("overlapping_confirmed_shift");
  });

  it("does not treat shifts on different calendar dates as overlapping, even at adjacent clock times", () => {
    // Athens dates never shift across midnight: a shift ending 23:30 on the 14th and one starting
    // 00:00 on the 15th must never be merged into one continuous window by date arithmetic.
    const lateNight: ConfirmedShiftWindow = { onDate: "2026-06-14", startTime: "20:00", endTime: "23:59" };
    const input = baseInput({
      shift: { onDate: "2026-06-15", startTime: "00:00", endTime: "04:00" },
      otherConfirmedShifts: [lateNight],
    });
    expect(checkInviteEligibility(input).blocking).not.toContain("overlapping_confirmed_shift");
  });

  it("ignores a same-day confirmed shift that does not overlap in time at all", () => {
    const farApart: ConfirmedShiftWindow = { onDate: "2026-06-15", startTime: "18:00", endTime: "22:00" };
    const result = checkInviteEligibility(baseInput({ otherConfirmedShifts: [farApart] }));
    expect(result.blocking).toEqual([]);
  });

  it("combines every applicable blocking reason at once", () => {
    const other: ConfirmedShiftWindow = { onDate: "2026-06-15", startTime: "09:00", endTime: "11:00" };
    const result = checkInviteEligibility(
      baseInput({
        promoterStatus: "archived",
        alreadyConfirmedOnThisShift: true,
        hasPendingInvitationForThisShift: true,
        otherConfirmedShifts: [other],
      }),
    );
    expect(new Set(result.blocking)).toEqual(
      new Set(["archived", "already_confirmed", "pending_invitation", "overlapping_confirmed_shift"]),
    );
  });
});

describe("checkInviteEligibility — warning rules", () => {
  it("warns when there is no availability declared that day at all", () => {
    const result = checkInviteEligibility(baseInput({ availabilityOnShiftDate: [] }));
    expect(result.warnings).toContain("no_availability_declared");
    expect(result.canSend).toBe(true); // a warning never blocks
  });

  it("warns when the only available row does not cover the full shift window", () => {
    const partial: AvailabilityWindow = { status: "available", fromTime: "11:00", toTime: "14:00" };
    const result = checkInviteEligibility(baseInput({ availabilityOnShiftDate: [partial] }));
    expect(result.warnings).toContain("no_availability_declared");
  });

  it("does not warn about availability when a row covers the shift exactly", () => {
    const covering: AvailabilityWindow = { status: "available", fromTime: "10:00", toTime: "14:00" };
    const result = checkInviteEligibility(baseInput({ availabilityOnShiftDate: [covering] }));
    expect(result.warnings).not.toContain("no_availability_declared");
  });

  it("warns when an unavailable window overlaps the shift's hours", () => {
    const unavailable: AvailabilityWindow = { status: "unavailable", fromTime: "12:00", toTime: "13:00" };
    const result = checkInviteEligibility(
      baseInput({
        availabilityOnShiftDate: [{ status: "available", fromTime: null, toTime: null }, unavailable],
      }),
    );
    expect(result.warnings).toContain("declared_unavailable");
    expect(result.canSend).toBe(true);
  });

  it("warns on a whole-day unavailable row (both times null)", () => {
    const unavailable: AvailabilityWindow = { status: "unavailable", fromTime: null, toTime: null };
    const result = checkInviteEligibility(baseInput({ availabilityOnShiftDate: [unavailable] }));
    expect(result.warnings).toContain("declared_unavailable");
  });

  it("does NOT warn when a partial unavailable window never touches the shift's hours", () => {
    // Shift is 10:00–14:00; declared unavailable 08:00–09:00 says nothing about it.
    const untouching: AvailabilityWindow = { status: "unavailable", fromTime: "08:00", toTime: "09:00" };
    const result = checkInviteEligibility(
      baseInput({
        availabilityOnShiftDate: [
          { status: "available", fromTime: null, toTime: null },
          untouching,
        ],
      }),
    );
    expect(result.warnings).not.toContain("declared_unavailable");
  });

  it("does NOT warn when the unavailable window ends exactly when the shift starts", () => {
    const untouching: AvailabilityWindow = { status: "unavailable", fromTime: "08:00", toTime: "10:00" };
    const result = checkInviteEligibility(
      baseInput({
        availabilityOnShiftDate: [
          { status: "available", fromTime: null, toTime: null },
          untouching,
        ],
      }),
    );
    expect(result.warnings).not.toContain("declared_unavailable");
  });

  it("warns when the promoter is outside the agency's travel radius", () => {
    const result = checkInviteEligibility(baseInput({ distanceM: 90_000, travelRadiusM: 60_000 }));
    expect(result.warnings).toContain("outside_travel_radius");
  });

  it("does not warn about distance when the promoter has no geocode", () => {
    const result = checkInviteEligibility(baseInput({ distanceM: null, travelRadiusM: 60_000 }));
    expect(result.warnings).not.toContain("outside_travel_radius");
  });

  it("does not warn about distance when the radius could not be read", () => {
    const result = checkInviteEligibility(baseInput({ distanceM: 90_000, travelRadiusM: null }));
    expect(result.warnings).not.toContain("outside_travel_radius");
  });

  it("warns when the campaign has a published brief the promoter has not acknowledged", () => {
    const result = checkInviteEligibility(
      baseInput({ campaignHasPublishedBrief: true, briefAcknowledged: false }),
    );
    expect(result.warnings).toContain("brief_not_read");
  });

  it("does not warn when the brief is acknowledged", () => {
    const result = checkInviteEligibility(
      baseInput({ campaignHasPublishedBrief: true, briefAcknowledged: true }),
    );
    expect(result.warnings).not.toContain("brief_not_read");
  });

  it("does not warn about the brief when the campaign has never published one", () => {
    const result = checkInviteEligibility(
      baseInput({ campaignHasPublishedBrief: false, briefAcknowledged: false }),
    );
    expect(result.warnings).not.toContain("brief_not_read");
  });

  it("combines every applicable warning at once, independent of blocking", () => {
    const result = checkInviteEligibility(
      baseInput({
        availabilityOnShiftDate: [],
        distanceM: 90_000,
        travelRadiusM: 60_000,
        campaignHasPublishedBrief: true,
        briefAcknowledged: false,
      }),
    );
    expect(new Set(result.warnings)).toEqual(
      new Set(["no_availability_declared", "outside_travel_radius", "brief_not_read"]),
    );
    expect(result.canSend).toBe(true);
  });
});
