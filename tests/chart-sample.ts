import { addChild, addParent, addPartner, createFamily, createPerson } from "../src/domain/tree";
import { emptyTree } from "../src/domain/tree";
import type { Tree } from "../src/domain/types";
import { renderFamilyChartSvg, type ChartCardPerson } from "../src/views/chartSvg";
import { familyLayout, wrapDisplayName } from "../src/views/family";

/** One grandparent, one couple, one child, one hidden grandchild. */
export function renderLookSample(): string {
  const grace = createPerson({ given: "Grace", surname: "Hopper", sex: "F" });
  let ada = createPerson({ given: "Ada", surname: "Lovelace", sex: "F" });
  const william = createPerson({ given: "William", surname: "King", sex: "M" });
  const anne = createPerson({ given: "Anne", surname: "King", sex: "U" });
  const byron = createPerson({ given: "Byron", surname: "King", sex: "M" });
  const linked = addParent({ child: ada, parent: grace });
  ada = linked.updatedChild;
  const couple = addPartner({ a: ada, b: william });
  const withAnne = addChild({
    family: couple.family,
    childId: anne.id,
    parent: couple.updatedA,
    child: anne,
  });
  const withByron = addChild({
    family: createFamily({ partners: [withAnne.updatedChild!.id] }),
    childId: byron.id,
    parent: withAnne.updatedChild!,
    child: byron,
  });
  const persons = [
    linked.updatedParent,
    couple.updatedA,
    couple.updatedB,
    withByron.updatedParent,
    withByron.updatedChild!,
  ].filter((person, index, all) => all.findIndex((other) => other.id === person.id) === index);
  const tree: Tree = {
    ...emptyTree(),
    persons,
    families: [linked.family, withAnne.family, withByron.family],
  };
  const layout = familyLayout(tree, couple.updatedA.id, { depth: 1, showSiblings: false, showCousins: false });
  const people = new Map<string, ChartCardPerson>();
  for (const person of tree.persons) {
    const name = `${person.names[0]?.given ?? ""} ${person.names[0]?.surname ?? ""}`.trim();
    people.set(person.id, {
      name,
      nameLines: wrapDisplayName(name),
      sex: person.sex,
      living: person.isLiving,
    });
  }
  return renderFamilyChartSvg(layout, people);
}
