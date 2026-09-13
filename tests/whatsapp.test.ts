import { describe, expect, it } from "vitest";
import { toWhatsAppNumber, whatsappUrl } from "@/lib/whatsapp";

describe("toWhatsAppNumber", () => {
  it("adds the Greek country code to a bare mobile number", () => {
    expect(toWhatsAppNumber("6912345678")).toBe("306912345678");
  });

  it("adds the Greek country code to a bare landline", () => {
    expect(toWhatsAppNumber("2101234567")).toBe("302101234567");
  });

  it("accepts the forms people actually type", () => {
    expect(toWhatsAppNumber("+30 691 234 5678")).toBe("306912345678");
    expect(toWhatsAppNumber("0030 6912345678")).toBe("306912345678");
    expect(toWhatsAppNumber("(+30) 691-234-5678")).toBe("306912345678");
  });

  it("leaves a foreign number with its own country code alone", () => {
    expect(toWhatsAppNumber("+44 7700 900123")).toBe("447700900123");
  });

  it("refuses what cannot be dialled rather than building a dead link", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("12345")).toBeNull();
    expect(toWhatsAppNumber("1234567890123456")).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("encodes Greek text and the line breaks in a message", () => {
    const url = whatsappUrl("6912345678", "Γεια σου!\nΔήλωσε εδώ: https://x.test/a/tok?x=1&y=2");
    expect(url).toBe(
      "https://wa.me/306912345678?text=" +
        encodeURIComponent("Γεια σου!\nΔήλωσε εδώ: https://x.test/a/tok?x=1&y=2"),
    );
    // The link's own query string must survive intact inside the message.
    expect(decodeURIComponent(url!.split("?text=")[1]!)).toContain("?x=1&y=2");
  });

  it("returns null when the phone is unusable", () => {
    expect(whatsappUrl("abc", "hi")).toBeNull();
  });
});
