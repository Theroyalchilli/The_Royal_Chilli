// Kitchen Display: how many boxes fit per screen on each device, and paging.
import { boxesPerScreen, boxWidth, screenCount, screenOf } from "@/lib/kitchen-pages";

describe("kitchen screens", () => {
  it("fits boxes to the device width", () => {
    expect(boxesPerScreen(375)).toBe(1); // phone
    expect(boxesPerScreen(800)).toBe(2); // tablet upright
    expect(boxesPerScreen(1180)).toBe(4); // tablet sideways / small laptop
    expect(boxesPerScreen(1260)).toBe(4); // laptop
    expect(boxesPerScreen(1900)).toBe(6); // full-HD screen
    expect(boxesPerScreen(100)).toBe(1); // never zero
  });

  it("splits the width into equal slots, so one order doesn't stretch across", () => {
    expect(boxWidth(1260, 4)).toBe(306);
    expect(boxWidth(800, 2)).toBe(394);
  });

  it("pages boxes across screens", () => {
    expect(screenCount(0, 4)).toBe(1);
    expect(screenCount(9, 4)).toBe(3);
    expect([screenOf(0, 4), screenOf(3, 4), screenOf(4, 4), screenOf(8, 4)]).toEqual([0, 0, 1, 2]);
  });
});
