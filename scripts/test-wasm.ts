declare const Bun: {
  Glob: new (pattern: string) => { scan(opts: { cwd: string }): AsyncIterable<string> };
  file(path: string): { text(): Promise<string> };
};
declare const process: { exit(code: number): never };

export {};

import { Parser, Language } from "web-tree-sitter";

const WASM_PATH = new URL("../tree-sitter-sql.wasm", import.meta.url).pathname;
const CORPUS_DIR = new URL("../test/corpus/", import.meta.url).pathname;

interface CorpusTest {
  name: string;
  attributes: string[];
  input: string;
  expected: string;
}

function isRule(line: string | undefined, char: string): boolean {
  return line !== undefined && line.length >= 3 && [...line].every((c) => c === char);
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  return lines.slice(start, end);
}

// Mirrors tree-sitter's corpus test format: a `===` delimited name (optionally
// followed by `:attribute` lines, e.g. `:error`/`:skip`), then input, then a
// `---` delimiter, then the expected S-expression.
function parseCorpus(contents: string): CorpusTest[] {
  const lines = contents.split("\n");
  const tests: CorpusTest[] = [];
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && !isRule(lines[i], "=")) i++;
    if (i >= lines.length) break;
    i++;

    const nameLines: string[] = [];
    while (i < lines.length && !isRule(lines[i], "=")) {
      nameLines.push(lines[i]);
      i++;
    }
    const attributes: string[] = [];
    while (nameLines.length > 0 && /^:\S/.test(nameLines[nameLines.length - 1].trim())) {
      attributes.unshift(nameLines.pop()!.trim().slice(1));
    }
    const name = nameLines.join("\n").trim();
    i++;

    const inputLines: string[] = [];
    while (i < lines.length && !isRule(lines[i], "-")) {
      inputLines.push(lines[i]);
      i++;
    }
    const input = trimBlankEdges(inputLines).join("\n");
    i++;

    const expectedLines: string[] = [];
    while (i < lines.length && !isRule(lines[i], "=")) {
      expectedLines.push(lines[i]);
      i++;
    }
    const expected = trimBlankEdges(expectedLines).join("\n");

    tests.push({ name, attributes, input, expected });
  }

  return tests;
}

interface SexpNode {
  field: string | null;
  type: string;
  children: SexpNode[];
}

// A minimal recursive-descent parser for the S-expressions tree-sitter emits,
// e.g. `field: (type (child) (child))`.
function parseSexp(source: string): SexpNode {
  let i = 0;

  function skipWs() {
    while (i < source.length && /\s/.test(source[i])) i++;
  }

  function parseNode(): SexpNode {
    skipWs();
    let field: string | null = null;
    const fieldMatch = /^([A-Za-z_][A-Za-z0-9_]*):\s*/.exec(source.slice(i));
    if (fieldMatch) {
      field = fieldMatch[1];
      i += fieldMatch[0].length;
    }

    if (source[i] !== "(") {
      throw new Error(`Expected '(' at offset ${i} in: ${source}`);
    }
    i++;

    skipWs();
    const typeMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
    if (!typeMatch) {
      throw new Error(`Expected node type at offset ${i} in: ${source}`);
    }
    const type = typeMatch[0];
    i += type.length;

    const children: SexpNode[] = [];
    while (true) {
      skipWs();
      if (source[i] === ")") {
        i++;
        break;
      }
      children.push(parseNode());
    }

    return { field, type, children };
  }

  const node = parseNode();
  skipWs();
  return node;
}

// Matches tree-sitter's own corpus comparison: node types and child order
// must always match, but a field is only checked when the expected output
// bothers to annotate it — omitting fields in expected output is allowed.
function sexpMatches(expected: SexpNode, actual: SexpNode): boolean {
  if (expected.type !== actual.type) return false;
  if (expected.field !== null && expected.field !== actual.field) return false;
  if (expected.children.length !== actual.children.length) return false;
  return expected.children.every((child, index) => sexpMatches(child, actual.children[index]));
}

function containsError(node: SexpNode): boolean {
  return node.type === "ERROR" || node.children.some(containsError);
}

async function main() {
  await Parser.init();
  const language = await Language.load(WASM_PATH);
  const parser = new Parser();
  parser.setLanguage(language);

  const files: string[] = [];
  for await (const file of new Bun.Glob("*.txt").scan({ cwd: CORPUS_DIR })) {
    files.push(file);
  }
  files.sort();

  let passed = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const file of files) {
    const contents = await Bun.file(CORPUS_DIR + file).text();

    for (const test of parseCorpus(contents)) {
      if (test.attributes.includes("skip")) {
        skipped++;
        continue;
      }

      const tree = parser.parse(test.input);
      const actualSexp = tree!.rootNode.toString();
      const actualNode = parseSexp(actualSexp);

      // Like tree-sitter's own test runner, `:error` tests only require an
      // ERROR node somewhere in the tree — the expected S-expression is not
      // compared node-for-node.
      const matches = test.attributes.includes("error")
        ? containsError(actualNode)
        : sexpMatches(parseSexp(test.expected), actualNode);

      if (matches) {
        passed++;
      } else {
        failures.push(
          `${file} > ${test.name}\n  input:    ${JSON.stringify(test.input)}\n  expected: ${test.expected.replace(/\s+/g, " ").trim()}\n  actual:   ${actualSexp}`,
        );
      }
    }
  }

  console.log(`wasm corpus tests: ${passed} passed, ${failures.length} failed, ${skipped} skipped`);

  if (failures.length > 0) {
    console.error(`\n${failures.join("\n\n")}`);
    process.exit(1);
  }
}

await main();
