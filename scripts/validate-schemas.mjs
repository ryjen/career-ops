import fs from 'node:fs';
import path from 'node:path';

const directory = 'schemas';
const files = fs.readdirSync(directory).filter((name) => name.endsWith('.schema.json')).sort();
if (files.length === 0) throw new Error('no public schemas found');
const ids = new Set();
for (const file of files) {
  const schema = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') throw new Error(`${file}: unsupported JSON Schema dialect`);
  if (typeof schema.$id !== 'string' || ids.has(schema.$id)) throw new Error(`${file}: missing or duplicate $id`);
  if (schema.type !== 'object' || schema.additionalProperties !== false) throw new Error(`${file}: public object contracts must fail closed on unknown fields`);
  if (!Array.isArray(schema.required) || !schema.properties) throw new Error(`${file}: missing required/properties contract`);
  ids.add(schema.$id);
}
console.log(`schema checks passed (${files.length} schemas)`);
