import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Repair only the six corrupted self-references in the published 2.10.0 class. */
export function repairTrialFilterIdentity(code) {
  const tree = ts.createSourceFile('trial.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const bindings = {};
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    for (const item of node.importClause?.namedBindings?.elements ?? []) {
      bindings[(item.propertyName ?? item.name).text] = item.name.text;
    }
  }
  const edits = [];
  const methodName = name => {
    if (ts.isComputedPropertyName(name)) return ts.isStringLiteral(name.expression) ? name.expression.text : undefined;
    return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
  };
  let candidates = 0;
  const visit = node => {
    if (ts.isClassExpression(node) && node.name
      && node.heritageClauses?.some(clause => clause.types.some(type => type.expression.getText(tree) === bindings.FilterPlugin))
      && node.members.some(member => member.name && ['getQuickFilter','getRowFilter'].includes(methodName(member.name)))) {
      candidates++;
      // Corrected obfuscation retains the class binding even if the import shares its name.
      if (node.name.text === bindings.BasePlugin) return;
      const memberCounts = [];
      for (const member of node.members) {
        const references = [];
        const collect = child => {
          if (ts.isIdentifier(child) && child.text === bindings.BasePlugin) references.push(child);
          ts.forEachChild(child, collect);
        };
        collect(member);
        if (!references.length) continue;
        if (!member.getText(tree).includes('getRowFilter')) throw new Error('Unexpected trial filter BasePlugin reference');
        memberCounts.push(references.length);
        for (const reference of references) edits.push({ start: reference.getStart(tree), end: reference.end, text: node.name.text });
      }
      if (memberCounts.length && memberCounts.sort().join(',') !== '1,2,3') {
        throw new Error('Unexpected trial filter identity shape; review the package before repairing');
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (candidates !== 1) throw new Error('Unexpected trial filter class count');
  let repaired = code;
  for (const edit of edits.sort((a,b) => b.start-a.start)) repaired = repaired.slice(0,edit.start)+edit.text+repaired.slice(edit.end);
  return { code: repaired, replacements: edits.length };
}

/** Temporary build-time compatibility for the exact public trial versions. */
export function trialFilterIdentityPlugin() {
  return {
    name: 'trial-2.10.0-filter-class-identity',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!/[/\\]dist[/\\](?:rv-pro-trial|pivot-trial)\.js$/.test(file)) return;
      const manifest = JSON.parse(readFileSync(resolve(dirname(file),'../package.json'),'utf8'));
      if (manifest.version !== '2.10.0' || !['@revolist/rv-pro-trial','@revolist/pivot-trial'].includes(manifest.name)) return;
      const result = repairTrialFilterIdentity(code);
      return result.replacements ? { code: result.code, map: null } : undefined;
    },
  };
}
