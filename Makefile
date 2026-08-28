.DEFAULT_GOAL := help
.NOTPARALLEL: build parser-build test

WASM_NAME := tree-sitter-sql
WASM := $(WASM_NAME).wasm
SRC_DIR := src
GRAMMAR_DEPS := grammar.js $(wildcard grammar/*.js grammar/**/*.js)
GRAMMAR_JSON := $(SRC_DIR)/grammar.json
PARSER := $(SRC_DIR)/parser.c
PARSER_DEPS := $(PARSER) $(wildcard $(SRC_DIR)/scanner.c $(SRC_DIR)/scanner.cc)
TS := bun run tree-sitter

.PHONY: help install clean build test publish parser-clean parser-generate parser-build ts-version set-version bump-minor bump-patch FORCE

help: ## List available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <command>\n\nCommands:\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Validate Bun and install dependencies from the lockfile
	@bun scripts/check-bun-version.ts
	@bun install --frozen-lockfile

parser-clean: ## Remove parser compilation artifacts
	@$(RM) $(SRC_DIR)/*.o $(SRC_DIR)/*.obj $(WASM)
	@echo "Cleaned parser build artifacts"

clean: parser-clean ## Remove parser compilation artifacts

parser-generate: $(PARSER) ## Regenerate grammar and parser sources

test: install parser-generate ## Regenerate the parser and run grammar tests
	$(TS) test

parser-build: install ts-version parser-clean parser-generate test $(WASM) ## Generate, test, and build the WASM artifact

build: parser-build ## Fully rebuild the WASM artifact

publish: build ## Build, test, and publish the package to GitHub Packages
	@bun publish

ts-version: ## Report the tree-sitter CLI version used for builds
	@$(TS) --version

$(GRAMMAR_JSON): $(GRAMMAR_DEPS) FORCE
	$(TS) generate --no-parser grammar.js

$(PARSER): $(GRAMMAR_JSON)
	$(TS) generate $<

$(WASM): $(PARSER_DEPS) tree-sitter.json
	$(TS) build --wasm --output $@
	@test -s $@

FORCE:

set-version: ## Set the package version (usage: make set-version VERSION=1.2.3)
	@if [ -z "$(VERSION)" ]; then echo "VERSION is required (example: make set-version VERSION=1.2.3)" >&2; exit 1; fi
	@bun scripts/set-version.ts set "$(VERSION)"

bump-minor: ## Increment the minor version and reset the patch version
	@bun scripts/set-version.ts minor

bump-patch: ## Increment the patch version
	@bun scripts/set-version.ts patch
