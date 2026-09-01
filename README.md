# tree-sitter-sql

[![CI](https://github.com/rilevera/tree-sitter-sql/actions/workflows/ci.yml/badge.svg)](https://github.com/rilevera/tree-sitter-sql/actions/workflows/ci.yml)

A general/permissive SQL grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter),
distributed as a prebuilt WebAssembly (WASM) module.

## Installation

The package is published to GitHub Packages as `@rilevera/tree-sitter-sql`. Configure your
package manager to use the GitHub Packages registry for the `@rilevera` scope, then install it:

```bash
# .npmrc
@rilevera:registry=https://npm.pkg.github.com

npm install @rilevera/tree-sitter-sql
```

## Usage

The package ships a single prebuilt `tree-sitter-sql.wasm` artifact. Load it with
[web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web):

```javascript
import { Parser, Language } from "web-tree-sitter";
import sqlWasm from "@rilevera/tree-sitter-sql";

await Parser.init();
const SQL = await Language.load(sqlWasm);

const parser = new Parser();
parser.setLanguage(SQL);

const tree = parser.parse("SELECT * FROM users WHERE id = 1;");
console.log(tree.rootNode.toString());
```

## Development

This project uses [Bun](https://bun.sh) and the [tree-sitter CLI](https://github.com/tree-sitter/tree-sitter)
to generate the parser, run the corpus tests, and build the WASM artifact.

```bash
make install   # validate Bun and install dependencies from the lockfile
make test      # regenerate the parser and run the grammar tests
make build     # generate, test, and build tree-sitter-sql.wasm
```

Run `make help` to see all available commands.

### Releasing

Bump the version (this keeps `package.json` and `tree-sitter.json` in sync):

```bash
make set-version VERSION=1.2.3   # or: make bump-minor / make bump-patch
```

Commit the change, then push a matching git tag. The `Publish package` workflow builds the WASM
and publishes the package to GitHub Packages.

## Features

For a complete list of features see the [tests](test/corpus).

## References

* [Wikipedia#SQL_syntax](https://en.wikipedia.org/wiki/SQL_syntax) - I consulted wikipedia for naming conventions,
  though I may not have been strict early on in the prototyping.
* [Phoenix Language Reference](https://forcedotcom.github.io/phoenix/index.html) - A reference diagram.
* [SQLite's railroad diagram for expr](https://www.sqlite.org/lang_expr.html) - Another reference diagram.
* [Postgresql syntax documentation](https://www.postgresql.org/docs/current/sql-commands.html)
* [Mariadb syntax documentation](https://mariadb.com/kb/en/sql-statements-structure/)
