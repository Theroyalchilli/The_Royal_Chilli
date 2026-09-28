import { findDuplicateGroups } from "@/lib/customer-duplicates";

const c = (id: number, name: string, phone: string | null, email: string | null) => ({ id, name, phone, email });

describe("possible duplicates", () => {
  it("groups records sharing a mobile (any format), email or name — chains join up", () => {
    const groups = findDuplicateGroups([
      c(30, "Suresh", "07700 111222", "a@mail.com"),
      c(34, "Suresh", null, "s@mail.com"),
      c(35, "suresh", "+447700111222", null),
      c(31, "Hari", "07700999888", "h@mail.com"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual([30, 34, 35]);
    expect(groups[0].reasons).toEqual(["mobile", "name"]);
  });

  it("a shared email links two records", () => {
    const [g] = findDuplicateGroups([c(1, "Priya", "07700111222", "p@mail.com"), c(2, "P Shah", "07700333444", "P@Mail.com")]);
    expect(g.reasons).toEqual(["email"]);
  });

  it("nobody alike → nothing; 'Guest' names don't count", () => {
    expect(findDuplicateGroups([c(1, "Guest", "07700111222", null), c(2, "Guest", "07700333444", null)])).toEqual([]);
  });

  it("name-only matches are listed after stronger ones", () => {
    const groups = findDuplicateGroups([
      c(1, "Dilip", "07700111222", "d@mail.com"),
      c(2, "Dilip", "07700333444", "j@mail.com"),
      c(3, "Ravi", "07700555666", "r@mail.com"),
      c(4, "R Kumar", "07700555666", null),
    ]);
    expect(groups.map((g) => g.reasons)).toEqual([["mobile"], ["name"]]);
  });
});
