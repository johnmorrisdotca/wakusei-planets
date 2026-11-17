// api-surface.mjs: the public API as text. For every entry point in package.json "exports" (its source file is the "types" path with dist/ -> src/ and .d.ts -> .ts), it lists every
// export, sorted, with its kind and signature as the TypeScript compiler writes it (comments and function bodies left out), so the snapshot test can hold the whole surface still.
//
//   pnpm api:update    rewrite test/api-snapshot.txt: for a change to the public API you mean, in the same commit, with the reason in the CHANGELOG
//
// Reads source with the TypeScript compiler API (a dev dependency); needs no build.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope | ts.TypeFormatFlags.WriteArrowStyleSignature;

/** The entry points: [subpath, source file] for each export with a "types" path that has a source file. */
export function entryPoints() {
  const exports = JSON.parse(readFileSync(`${root}package.json`, "utf8")).exports;
  const found = [];
  for (const [key, value] of Object.entries(exports)) {
    const types = typeof value === "object" ? value.types : undefined;
    if (typeof types !== "string") continue;
    const source = `${root}${types.replace(/^\.\/dist\//, "src/").replace(/\.d\.ts$/, ".ts")}`;
    if (existsSync(source)) found.push([key, source]);
  }
  return found;
}

/** The surface of every entry point, as lines of text. */
export function surfaceOf() {
  const entries = entryPoints();
  const config = ts.getParsedCommandLineOfConfigFile(`${root}tsconfig.json`, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); } });
  const program = ts.createProgram(entries.map(([, file]) => file), { ...config.options, noEmit: true });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: true });
  const flat = (text) => text.replace(/\s+/g, " ").trim();
  const lines = [];
  for (const [key, file] of entries) {
    const source = program.getSourceFile(file);
    const module = checker.getSymbolAtLocation(source);
    lines.push(`## ${key}`);
    const exported = module ? checker.getExportsOfModule(module) : [];
    if (exported.length === 0) lines.push("(no exports: it registers itself when imported)");
    for (const symbol of [...exported].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const real = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      lines.push(describe(symbol.name, real));
    }
  }
  return `${lines.join("\n")}\n`;

  function describe(name, symbol) {
    const f = symbol.flags;
    const declaration = symbol.declarations?.[0];
    const node = (n) => flat(printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile()));
    if (f & ts.SymbolFlags.Function) {
      const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      return `function ${name}${type.getCallSignatures().map((s) => checker.signatureToString(s, undefined, FLAGS)).join(" | ")}`;
    }
    if (f & ts.SymbolFlags.Class) {
      const type = checker.getDeclaredTypeOfSymbol(symbol);
      const members = checker.getPropertiesOfType(type).filter((m) => !m.declarations?.some((d) => ts.getCombinedModifierFlags(d) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected))).map((m) => `${m.name}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(m, m.declarations[0]), undefined, FLAGS)}`).sort();
      return `class ${name} { ${members.join("; ")} }`;
    }
    if (f & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Enum)) {
      return (symbol.declarations ?? []).filter((d) => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d) || ts.isEnumDeclaration(d)).map(node).join(" ");
    }
    if (f & ts.SymbolFlags.Variable) {
      const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      return `const ${name}: ${checker.typeToString(type, undefined, FLAGS)}`;
    }
    return `${name} (${ts.SymbolFlags[f] ?? f})`;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = surfaceOf();
  if (process.argv.includes("--write")) {
    writeFileSync(`${root}test/api-snapshot.txt`, text);
    console.log(`wrote test/api-snapshot.txt: ${text.split("\n").length - 1} lines`);
  } else process.stdout.write(text);
}
