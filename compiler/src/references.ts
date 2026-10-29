export function collectReferencedNames(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) collectReferencedNames(item, out);
    return out;
  }
  if (node === null || typeof node !== 'object') return out;

  const obj = node as Record<string, unknown>;
  switch (obj.kind) {
    case 'UseDecl':
      return out;
    case 'NamedType':
    case 'GenericType':
    case 'Identifier':
      if (typeof obj.name === 'string') out.add(obj.name);
      break;
    case 'StructLiteral':
    case 'StructDestructure':
      if (typeof obj.typeName === 'string') out.add(obj.typeName);
      break;
    case 'Element':
      if (typeof obj.tag === 'string') out.add(obj.tag);
      break;
  }

  for (const key of Object.keys(obj)) collectReferencedNames(obj[key], out);
  return out;
}
