import { describe, expect, test } from "bun:test";
import {
  getCurrentSeason,
  type Season,
} from "../src/shared/season";

describe("current season boundaries", () => {
  const cases: ReadonlyArray<readonly [string, number, Season]> = [
    ["start of the year", 0, "WINTER"],
    ["end of winter", 2, "WINTER"],
    ["start of spring", 3, "SPRING"],
    ["end of spring", 5, "SPRING"],
    ["start of summer", 6, "SUMMER"],
    ["end of summer", 8, "SUMMER"],
    ["start of fall", 9, "FALL"],
    ["end of the year", 11, "FALL"],
  ];

  test.each([...cases])("returns the expected season at the %s", (_label, month, expected) => {
    expect(getCurrentSeason(new Date(2026, month, 15, 12))).toBe(expected);
  });
});
