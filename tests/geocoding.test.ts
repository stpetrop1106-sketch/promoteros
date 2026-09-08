import { afterEach, describe, expect, it, vi } from "vitest";
import { getGeocoder } from "@/lib/geocoding";
import { NominatimProvider, __resetRateLimiterForTests } from "@/lib/geocoding/nominatim";
import { LocationIqProvider } from "@/lib/geocoding/locationiq";
import { NullProvider } from "@/lib/geocoding/null-provider";

// Unit tests only — no network. Every test stubs globalThis.fetch and restores it afterward.
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GEOCODING_PROVIDER;
  delete process.env.GEOCODING_API_KEY;
  vi.restoreAllMocks();
  // Nominatim serialises requests through a module-level 1-req/sec queue; reset its clock so
  // tests never pay a real ~1s delay because an earlier test just made a call.
  __resetRateLimiterForTests();
});

describe("NominatimProvider", () => {
  it("parses a successful response into a GeocodeResult", async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toContain("nominatim.openstreetmap.org/search");
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.["User-Agent"]).toBeTruthy();
      return jsonResponse([
        {
          lat: "37.9838",
          lon: "23.7275",
          display_name: "Athens, Greece",
          importance: 0.7,
          type: "city",
        },
      ]);
    }) as unknown as typeof fetch;

    const provider = new NominatimProvider();
    const result = await provider.geocode("  Ερμού   15,  Αθήνα  ", { country: "gr" });

    expect(result).not.toBeNull();
    expect(result?.coordinates).toEqual({ lat: 37.9838, lng: 23.7275 });
    expect(result?.formattedAddress).toBe("Athens, Greece");
    expect(result?.confidence).toBe("high");
  });

  it("returns null for an empty result array", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    expect(await provider.geocode("Nowhere in particular, Greece")).toBeNull();
  });

  it("returns null for a non-200 response", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "rate limited" }, 429),
    ) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    expect(await provider.geocode("Athens")).toBeNull();
  });

  it("returns null for a malformed (non-JSON) body instead of throwing", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("<not json>", { status: 200 }),
    ) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    await expect(provider.geocode("Athens")).resolves.toBeNull();
  });

  it("returns null on a timeout/abort instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    }) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    await expect(provider.geocode("Athens")).resolves.toBeNull();
  });

  it("returns null on a plain network error instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    await expect(provider.geocode("Athens")).resolves.toBeNull();
  });

  it("rejects a result outside Greece's bounding box when country is gr", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse([{ lat: "48.8566", lon: "2.3522", display_name: "Paris, France", importance: 0.9 }]),
    ) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    expect(await provider.geocode("Some address", { country: "gr" })).toBeNull();
  });

  it("returns a low-confidence result rather than discarding it", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse([{ lat: "38.0", lon: "23.7", display_name: "Somewhere vague", importance: 0.1 }]),
    ) as unknown as typeof fetch;
    const provider = new NominatimProvider();
    const result = await provider.geocode("A vague description");
    expect(result?.confidence).toBe("low");
  });

  it("does not call fetch for an address that is empty after normalisation", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const provider = new NominatimProvider();
    expect(await provider.geocode("   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("LocationIqProvider", () => {
  it("parses a successful response into a GeocodeResult", async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain("us1.locationiq.com/v1/search");
      expect(String(url)).toContain("key=test-key");
      return jsonResponse([
        { lat: "37.98", lon: "23.72", display_name: "Athens", importance: 0.5, type: "residential" },
      ]);
    }) as unknown as typeof fetch;

    const provider = new LocationIqProvider("test-key");
    const result = await provider.geocode("Athens");
    expect(result?.coordinates).toEqual({ lat: 37.98, lng: 23.72 });
    expect(result?.confidence).toBe("medium");
  });

  it("returns null for an empty result array", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    const provider = new LocationIqProvider("test-key");
    expect(await provider.geocode("Nowhere")).toBeNull();
  });

  it("returns null for a non-200 response", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    const provider = new LocationIqProvider("test-key");
    expect(await provider.geocode("Athens")).toBeNull();
  });

  it("returns null for a malformed body instead of throwing", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("<not json>", { status: 200 }),
    ) as unknown as typeof fetch;
    const provider = new LocationIqProvider("test-key");
    await expect(provider.geocode("Athens")).resolves.toBeNull();
  });

  it("returns null on timeout/abort instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    }) as unknown as typeof fetch;
    const provider = new LocationIqProvider("test-key");
    await expect(provider.geocode("Athens")).resolves.toBeNull();
  });

  it("rejects a result outside Greece's bounding box when country is gr", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse([{ lat: "40.7128", lon: "-74.006", display_name: "New York" }]),
    ) as unknown as typeof fetch;
    const provider = new LocationIqProvider("test-key");
    expect(await provider.geocode("Somewhere", { country: "gr" })).toBeNull();
  });

  it("never logs the API key", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const provider = new LocationIqProvider("super-secret-key");
    await provider.geocode("Athens");
    const allLoggedText = [...warnSpy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
    expect(allLoggedText).not.toContain("super-secret-key");
  });
});

describe("NullProvider", () => {
  it("always returns null", async () => {
    const provider = new NullProvider();
    expect(await provider.geocode("Anything at all")).toBeNull();
    expect(provider.name).toBe("none");
  });
});

describe("getGeocoder provider selection", () => {
  it("defaults to nominatim when GEOCODING_PROVIDER is unset", () => {
    delete process.env.GEOCODING_PROVIDER;
    expect(getGeocoder().name).toBe("nominatim");
  });

  it("selects nominatim explicitly", () => {
    process.env.GEOCODING_PROVIDER = "nominatim";
    expect(getGeocoder().name).toBe("nominatim");
  });

  it("selects none, returning a provider that always resolves null", async () => {
    process.env.GEOCODING_PROVIDER = "none";
    const geocoder = getGeocoder();
    expect(geocoder.name).toBe("none");
    expect(await geocoder.geocode("Athens")).toBeNull();
  });

  it("selects locationiq when GEOCODING_API_KEY is set", () => {
    process.env.GEOCODING_PROVIDER = "locationiq";
    process.env.GEOCODING_API_KEY = "a-real-key";
    expect(getGeocoder().name).toBe("locationiq");
  });

  it("falls back to nominatim and warns when locationiq is selected without a key", () => {
    process.env.GEOCODING_PROVIDER = "locationiq";
    delete process.env.GEOCODING_API_KEY;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getGeocoder().name).toBe("nominatim");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("GEOCODING_API_KEY");
  });
});
