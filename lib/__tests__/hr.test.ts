import { maskValue, maskHrDetails, MASKED_HR_FIELDS } from "@/lib/hr";

describe("maskValue", () => {
  it("keeps the last 4 characters visible and masks the rest", () => {
    expect(maskValue("12345678")).toBe("••••5678");
  });

  it("masks the whole value when it's 4 characters or shorter", () => {
    expect(maskValue("1234")).toBe("••••");
    expect(maskValue("12")).toBe("••");
  });

  it("passes through null/empty untouched", () => {
    expect(maskValue(null)).toBeNull();
    expect(maskValue("")).toBe("");
  });
});

describe("maskHrDetails", () => {
  it("masks every sensitive field present and leaves the rest alone", () => {
    const details = {
      name: "Jordan Smith",
      ni_number: "QQ123456C",
      sort_code: "123456",
      account_number: "12345678",
      notes: "Started Monday",
    };
    const masked = maskHrDetails(details);
    expect(masked.name).toBe("Jordan Smith");
    expect(masked.notes).toBe("Started Monday");
    expect(masked.ni_number).toBe("•••••456C");
    expect(masked.sort_code).toBe("••3456");
    expect(masked.account_number).toBe("••••5678");
  });

  it("does not throw or add fields when a masked field is absent from the record", () => {
    const details = { name: "Jordan Smith" };
    expect(maskHrDetails(details)).toEqual({ name: "Jordan Smith" });
  });

  it("only ever masks the fields explicitly listed as sensitive", () => {
    // Guards against someone quietly widening MASKED_HR_FIELDS without
    // realizing it changes what's exposed on the plain Employees page.
    expect(MASKED_HR_FIELDS).toEqual(["ni_number", "sort_code", "account_number"]);
  });
});
