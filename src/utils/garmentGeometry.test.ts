import assert from "node:assert/strict";
import test from "node:test";
import { createSewnGarmentGeometry, sampleGarmentSurface } from "./garmentGeometry";
import type { GarmentCategory } from "../types/studio";
import type { GarmentMode } from "./garmentGeometry";

const categories: GarmentCategory[] = ["tshirt", "shirt", "jacket", "pants"];
const modes: GarmentMode[] = ["rack", "mannequin"];

for (const category of categories) {
  for (const mode of modes) {
    test(`${category} / ${mode}: finite, indexed cloth with separate front/back surfaces`, () => {
      const geometry = createSewnGarmentGeometry(category, mode);
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      assert.ok(geometry.index);
      assert.ok(position.count > 2000);
      assert.ok(position.count < 150000, "mesh stays within the interactive viewport budget");
      assert.ok([...position.array].every(Number.isFinite), "no invalid cloth vertices");
      assert.ok([...normal.array].every(Number.isFinite), "no invalid vertex normals");
      assert.equal(geometry.groups.length, 3, "front, back, and sewn side surfaces");
      assert.equal(
        geometry.groups.reduce((sum, group) => sum + group.count, 0),
        geometry.index.count,
      );
      assert.ok(geometry.boundingBox!.max.z > 0.03);
      assert.ok(geometry.boundingBox!.min.z < -0.03);
      assert.ok(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y > 0.5);

      // Weld by location, not UV: the artwork UV seam must not detach the sewn panels.
      const locations = new Map<string, number>();
      const parent: number[] = [];
      const ids: number[] = [];
      const find = (id: number): number => {
        while (parent[id] !== id) {
          parent[id] = parent[parent[id]];
          id = parent[id];
        }
        return id;
      };
      for (let i = 0; i < position.count; i++) {
        const key = [position.getX(i), position.getY(i), position.getZ(i)]
          .map((n) => Math.round(n * 10000))
          .join(",");
        let id = locations.get(key);
        if (id === undefined) {
          id = parent.length;
          parent.push(id);
          locations.set(key, id);
        }
        ids.push(id);
      }
      const index = geometry.index.array;
      for (let i = 0; i < index.length; i += 3) {
        const a = find(ids[index[i]]);
        parent[find(ids[index[i + 1]])] = a;
        parent[find(ids[index[i + 2]])] = a;
      }
      assert.equal(
        new Set(parent.map((_, i) => find(i))).size,
        1,
        "no disconnected sleeve tubes or back panels",
      );
      geometry.dispose();
    });
  }
}

test("front and back of the crew neckline remain an opening, not a cylinder cap", () => {
  const front = sampleGarmentSurface("tshirt", "mannequin", 0, 0.211);
  const back = sampleGarmentSurface("tshirt", "mannequin", 0, 0.211, true);
  assert.ok(front.z - back.z > 0.1);
  assert.ok(back.y > front.y, "back neckline sits higher than the front");
});

test("gravity drape produces nonuniform cloth depth instead of flat planes", () => {
  const samples = Array.from(
    { length: 30 },
    (_, i) => sampleGarmentSurface("shirt", "rack", -0.12 + i * 0.008, -0.21).z,
  );
  assert.ok(Math.max(...samples) - Math.min(...samples) > 0.012);
});
