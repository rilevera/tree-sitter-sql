declare const process: { argv: string[] };
declare const Bun: {
  file(path: string): { json(): Promise<any> };
  write(path: string, contents: string): Promise<number>;
};

export {};

const packagePath = "package.json";
const grammarMetadataPath = "tree-sitter.json";
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type Mode = "set" | "minor" | "patch";

const mode = process.argv[2] as Mode | undefined;
const requestedVersion = process.argv[3];

if (!mode || !["set", "minor", "patch"].includes(mode)) {
  throw new Error("Expected one of: set, minor, patch");
}

const packageJson = await Bun.file(packagePath).json();
const grammarMetadata = await Bun.file(grammarMetadataPath).json();
const currentVersion = packageJson.version;

if (typeof currentVersion !== "string" || !semverPattern.test(currentVersion)) {
  throw new Error(`package.json contains an unsupported version: ${currentVersion}`);
}

if (grammarMetadata.metadata?.version !== currentVersion) {
  throw new Error(
    `Version mismatch: package.json is ${currentVersion}, but tree-sitter.json is ${grammarMetadata.metadata?.version}`,
  );
}

let nextVersion: string;

if (mode === "set") {
  if (!requestedVersion || !semverPattern.test(requestedVersion)) {
    throw new Error("VERSION must be a semantic version in MAJOR.MINOR.PATCH form");
  }
  nextVersion = requestedVersion;
} else {
  const match = currentVersion.match(semverPattern);
  if (!match) throw new Error(`Unable to parse current version: ${currentVersion}`);

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  nextVersion = mode === "minor"
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;
}

packageJson.version = nextVersion;
grammarMetadata.metadata.version = nextVersion;

await Promise.all([
  Bun.write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
  Bun.write(grammarMetadataPath, `${JSON.stringify(grammarMetadata, null, 2)}\n`),
]);

console.log(`${currentVersion} -> ${nextVersion}`);
