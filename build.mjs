import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "pdf-export.js"];
const outputs = ["dist", "public"];

for (const output of outputs) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  for (const file of files) {
    await cp(file, `${output}/${file}`);
  }
}

console.log("Static app built into dist/ and public/");
