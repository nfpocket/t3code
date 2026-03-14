import { describe, expect, it } from "vitest";

import { parseChatPanelRouteSearch } from "./chatPanelRouteSearch";

describe("parseChatPanelRouteSearch", () => {
  it("parses valid diff search values", () => {
    const parsed = parseChatPanelRouteSearch({
      diff: "1",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      diff: "1",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });
  });

  it("treats numeric and boolean diff toggles as open", () => {
    expect(
      parseChatPanelRouteSearch({
        diff: 1,
        diffTurnId: "turn-1",
      }),
    ).toEqual({
      diff: "1",
      diffTurnId: "turn-1",
    });

    expect(
      parseChatPanelRouteSearch({
        diff: true,
        diffTurnId: "turn-1",
      }),
    ).toEqual({
      diff: "1",
      diffTurnId: "turn-1",
    });
  });

  it("drops diff-specific values when diff is closed", () => {
    const parsed = parseChatPanelRouteSearch({
      diff: "0",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({});
  });

  it("drops diff file value when turn is not selected", () => {
    const parsed = parseChatPanelRouteSearch({
      diff: "1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      diff: "1",
    });
  });

  it("normalizes whitespace-only diff values", () => {
    const parsed = parseChatPanelRouteSearch({
      diff: "1",
      diffTurnId: "  ",
      diffFilePath: "  ",
    });

    expect(parsed).toEqual({
      diff: "1",
    });
  });

  it("parses a valid http preview URL", () => {
    expect(
      parseChatPanelRouteSearch({
        preview: "1",
        previewUrl: "http://localhost:3000",
      }),
    ).toEqual({
      preview: "1",
      previewUrl: "http://localhost:3000/",
    });
  });

  it("parses a valid https preview URL", () => {
    expect(
      parseChatPanelRouteSearch({
        preview: "1",
        previewUrl: "https://example.com/docs?q=1",
      }),
    ).toEqual({
      preview: "1",
      previewUrl: "https://example.com/docs?q=1",
    });
  });

  it("drops preview URL when preview is closed", () => {
    expect(
      parseChatPanelRouteSearch({
        preview: "0",
        previewUrl: "https://example.com",
      }),
    ).toEqual({});
  });

  it("drops invalid preview URLs", () => {
    expect(
      parseChatPanelRouteSearch({
        preview: "1",
        previewUrl: "not a url",
      }),
    ).toEqual({
      preview: "1",
    });
  });

  it("drops blank preview URLs", () => {
    expect(
      parseChatPanelRouteSearch({
        preview: "1",
        previewUrl: "   ",
      }),
    ).toEqual({
      preview: "1",
    });
  });

  it("rejects non-http preview URL schemes", () => {
    expect(
      parseChatPanelRouteSearch({
        preview: "1",
        previewUrl: "file:///tmp/test.html",
      }),
    ).toEqual({
      preview: "1",
    });

    expect(
      parseChatPanelRouteSearch({
        preview: "1",
        previewUrl: "javascript:alert(1)",
      }),
    ).toEqual({
      preview: "1",
    });
  });

  it("canonicalizes conflicting panel state to preview-only", () => {
    expect(
      parseChatPanelRouteSearch({
        diff: "1",
        diffTurnId: "turn-1",
        diffFilePath: "src/app.ts",
        preview: "1",
        previewUrl: "https://example.com",
      }),
    ).toEqual({
      preview: "1",
      previewUrl: "https://example.com/",
    });
  });
});
