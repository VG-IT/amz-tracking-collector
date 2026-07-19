import { describe, it, expect } from "vitest";
import { extractTrackInfoFromText } from "@/tracking/extract/extract-track-text";

describe("extractTrackInfoFromText", () => {
  it("parses Amazon tracking ID", () => {
    const result = extractTrackInfoFromText(
      "Tracking ID: TBA123456789",
      "Amazon Logistics",
    );

    expect(result).toEqual({
      tracking: "TBA123456789",
      carrier: "Amazon",
    });
  });

  it("parses UK carrier tracking", () => {
    const result = extractTrackInfoFromText(
      "Tracking ID: UK12345678",
      "Shipped with Royal Mail",
    );

    expect(result.tracking).toBe("UK12345678");
    expect(result.carrier).toBe("Royal Mail");
  });

  it("parses translated 'It was shipped with' carrier", () => {
    const result = extractTrackInfoFromText(
      "Tracking ID: 9087037061",
      "It was shipped with DHL.",
    );

    expect(result.tracking).toBe("9087037061");
    expect(result.carrier).toBe("DHL");
  });

  it("parses Spanish carrier phrase", () => {
    const result = extractTrackInfoFromText(
      "ID de seguimiento: 9087037061",
      "Se envió con DHL",
    );

    expect(result.tracking).toBe("9087037061");
    expect(result.carrier).toBe("DHL");
  });

  it("parses German tracking and carrier", () => {
    const result = extractTrackInfoFromText(
      "Sendungsnummer: DE123456789",
      "Versendet mit DHL",
    );

    expect(result.tracking).toBe("DE123456789");
    expect(result.carrier).toBe("DHL");
  });

  it("returns nulls when text missing", () => {
    const result = extractTrackInfoFromText(null, null);
    expect(result).toEqual({ tracking: null, carrier: null });
  });
});

