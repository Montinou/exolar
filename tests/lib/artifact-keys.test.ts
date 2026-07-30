import { describe, expect, it } from "vitest"
import { generateArtifactKey } from "@/lib/r2"

// Every artifact uploaded during one execution must land on its own R2 object.
// Before this was enforced, the key was
// `artifacts/{exec}/{signature}/{type}/{filename}` and `filename` came from the
// Playwright attachment name — literally "screenshot" for every capture. Each
// retry of a test overwrote the previous attempt's object, so 1611 DB rows
// pointed at 434 objects and the evidence for the attempt that mattered was
// gone. See the artifact-consistency cutoff note in the QA agent's
// exolar-data-caveats skill.
describe("generateArtifactKey", () => {
  const exec = 3631
  const sig = "5e70ffd91ee1f544cbfce817c50a2a62"

  it("gives each retry of the same test its own key", () => {
    const first = generateArtifactKey(exec, sig, "screenshot", "screenshot", {
      attempt: 0,
      seq: 0,
    })
    const retry = generateArtifactKey(exec, sig, "screenshot", "screenshot", {
      attempt: 1,
      seq: 1,
    })

    expect(first).not.toBe(retry)
  })

  it("gives each artifact of a single attempt its own key", () => {
    const a = generateArtifactKey(exec, sig, "screenshot", "screenshot", {
      attempt: 0,
      seq: 0,
    })
    const b = generateArtifactKey(exec, sig, "screenshot", "screenshot", {
      attempt: 0,
      seq: 1,
    })

    expect(a).not.toBe(b)
  })

  it("keeps the execution and signature prefix so keys stay browsable", () => {
    const key = generateArtifactKey(exec, sig, "screenshot", "screenshot", {
      attempt: 2,
      seq: 7,
    })

    expect(key.startsWith(`artifacts/${exec}/${sig}/screenshot/`)).toBe(true)
  })

  it("keeps a filename from escaping its prefix", () => {
    const key = generateArtifactKey(exec, sig, "screenshot", "../../../etc/passwd", {
      attempt: 0,
      seq: 0,
    })

    expect(key.startsWith(`artifacts/${exec}/${sig}/screenshot/`)).toBe(true)
    expect(key).not.toContain("..")
  })

  it("still produces a distinct key when the reporter sends no attempt", () => {
    const a = generateArtifactKey(exec, sig, "screenshot", "screenshot", { seq: 0 })
    const b = generateArtifactKey(exec, sig, "screenshot", "screenshot", { seq: 1 })

    expect(a).not.toBe(b)
  })
})
