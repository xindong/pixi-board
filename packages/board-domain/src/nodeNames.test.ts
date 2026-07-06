import { describe, expect, it } from "vitest";
import { displayNodeName } from "./nodeNames";

describe("displayNodeName", () => {
  it("uses the node name when present", () => {
    expect(displayNodeName(" Scene 01 ")).toBe("Scene 01");
  });

  it("falls back for missing or blank names", () => {
    expect(displayNodeName(undefined)).toBe("未命名节点");
    expect(displayNodeName("   ")).toBe("未命名节点");
  });
});
