declare const Bun: {
  version: string;
  file(path: string): { json(): Promise<any> };
};
declare const process: { exit(code: number): never };

export {};

type Version = [major: number, minor: number, patch: number];

function parseVersion(value: string): Version {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Unsupported Bun version: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(left: Version, right: Version): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

const packageJson = await Bun.file("package.json").json();
const range = packageJson.engines?.bun;
const rangeMatch = typeof range === "string"
  ? range.match(/^>=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)$/)
  : null;

if (!rangeMatch) {
  throw new Error(`Unsupported package.json engines.bun range: ${range}`);
}

const current = parseVersion(Bun.version);
const minimum = parseVersion(rangeMatch[1]);
const maximum = parseVersion(rangeMatch[2]);

if (compare(current, minimum) < 0 || compare(current, maximum) >= 0) {
  console.error(`Bun ${Bun.version} is unsupported; expected ${range}`);
  process.exit(1);
}

console.log(`Bun ${Bun.version} satisfies ${range}`);
