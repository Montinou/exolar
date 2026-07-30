import { describe, expect, it } from "vitest"
import { attemptKey, resolveArtifactResultId } from "@/lib/db/ingestion"

// A retried test produces one `test_results` row per attempt, all sharing the
// same signature. The ingestion map used to be keyed by signature alone, so the
// last row inserted won and every attempt's artifacts were attached to it —
// the screenshot of attempt 0 showed up under attempt 2's result. Keying by
// (signature, attempt) puts each artifact on the row it came from.
describe("resolveArtifactResultId", () => {
  const sig = "0f99861663435d53f20769e4f028171c"

  const map = new Map<string, number>([
    [attemptKey(sig, 0), 100],
    [attemptKey(sig, 1), 101],
    [attemptKey(sig, 2), 102],
    [sig, 102], // fallback entry: the last attempt, as before
  ])

  it("attaches an artifact to the result of its own attempt", () => {
    expect(resolveArtifactResultId(map, sig, 0)).toBe(100)
    expect(resolveArtifactResultId(map, sig, 1)).toBe(101)
  })

  it("falls back to the signature entry when the reporter sends no attempt", () => {
    expect(resolveArtifactResultId(map, sig, undefined)).toBe(102)
  })

  it("falls back to the signature entry for an attempt that has no row", () => {
    expect(resolveArtifactResultId(map, sig, 9)).toBe(102)
  })

  it("returns undefined when the test is unknown", () => {
    expect(resolveArtifactResultId(map, "unknown-signature", 0)).toBeUndefined()
  })
})
