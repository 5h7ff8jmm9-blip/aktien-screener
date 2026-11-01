import { describe, expect, it } from "vitest";
import { buildFilters } from "./screener";

describe("buildFilters", () => {
  it("rechnet Marktkap. in Mrd. in USD um", () => {
    const f = buildFilters({ ranges: { marketCap: { min: "10" } }, sectors: [] });
    expect(f).toContainEqual({ field: "market_cap", operator: "gte", value: 10e9 });
  });
  it("rechnet Prozent in Dezimal um", () => {
    const f = buildFilters({ ranges: { netMargin: { min: "15" } }, sectors: [] });
    expect(f).toContainEqual({ field: "net_margin", operator: "gte", value: 0.15 });
  });
  it("fügt Sektor-Filter hinzu", () => {
    const f = buildFilters({ ranges: {}, sectors: ["Energy"] });
    expect(f).toContainEqual({ field: "sector", operator: "in", value: ["Energy"] });
  });
});
