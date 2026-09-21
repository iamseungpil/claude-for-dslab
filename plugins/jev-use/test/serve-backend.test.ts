import { describe, expect, it } from "vitest";

import { createServerBackend } from "../src/backends/index.js";

describe("createServerBackend", () => {
  it("resolves a configured backend like createBackend", () => {
    const { backend, via } = createServerBackend(undefined, { TYPESAFE_API_KEY: "k" });
    expect(backend.name).toBe("typesafe");
    expect(via).toContain("TYPESAFE_API_KEY");
  });

  it("stands in for a missing credential instead of throwing, so serve still starts", () => {
    const { backend, via } = createServerBackend(undefined, {});
    expect(backend.name).toBe("unconfigured");
    expect(via).toContain("TYPESAFE_API_KEY");
  });

  it("reports the remedy on every judgment call", async () => {
    const { backend } = createServerBackend(undefined, {});
    await expect(
      backend.judge({ state: {}, questions: [{ id: "q", type: "noul", question: "?" }] }),
    ).rejects.toThrow(/TYPESAFE_API_KEY/);
  });
});
