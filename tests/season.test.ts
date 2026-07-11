import { describe, expect, test } from "bun:test";
import {
  getCurrentSeason,
  isSeason,
  SEASON_LABELS,
  SEASONS,
  type Season,
} from "../src/shared/season";

describe("shared season values", () => {
  test("exposes the four canonical seasons in calendar order", () => {
    expect(SEASONS).toEqual(["WINTER", "SPRING", "SUMMER", "FALL"]);
  });

  test("provides a display label for every canonical season", () => {
    expect(SEASON_LABELS).toEqual({
      WINTER: "Winter",
      SPRING: "Spring",
      SUMMER: "Summer",
      FALL: "Fall",
    });
  });

  test.each([...SEASONS])("accepts %s as a season", (season) => {
    expect(isSeason(season)).toBe(true);
  });

  test.each(["winter", "AUTUMN", "", null, 1])(
    "rejects non-canonical season value %p",
    (value) => {
      expect(isSeason(value)).toBe(false);
    }
  );
});

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
