import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("installs the declared SDK from npm without bundling a private copy", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));

  expect(manifest.bundleDependencies ?? []).not.toContain("@manuelselch/pi-sdk");
  expect(manifest.bundledDependencies ?? []).not.toContain("@manuelselch/pi-sdk");
  expect(lock.packages[""].dependencies["@manuelselch/pi-sdk"]).toBe(manifest.dependencies["@manuelselch/pi-sdk"]);
  expect(lock.packages["node_modules/@manuelselch/pi-sdk"].resolved).toMatch(
    /^https:\/\/registry\.npmjs\.org\/@manuelselch\/pi-sdk\/-\/pi-sdk-[^/]+\.tgz$/,
  );
});
