function stripComment(line) {
  let single = false;
  let double = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\' && double) {
      escaped = true;
      continue;
    }
    if (character === "'" && !double) single = !single;
    else if (character === '"' && !single) double = !double;
    else if (character === '#' && !single && !double && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

function splitMapping(text) {
  let single = false;
  let double = false;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "'" && !double) single = !single;
    else if (character === '"' && !single && text[index - 1] !== '\\') double = !double;
    else if (!single && !double) {
      if (character === '[') square += 1;
      else if (character === ']') square -= 1;
      else if (character === '{') curly += 1;
      else if (character === '}') curly -= 1;
      else if (character === ':' && square === 0 && curly === 0) {
        return [text.slice(0, index).trim(), text.slice(index + 1).trim()];
      }
    }
  }
  return null;
}

function splitInline(text) {
  const parts = [];
  let start = 0;
  let single = false;
  let double = false;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "'" && !double) single = !single;
    else if (character === '"' && !single && text[index - 1] !== '\\') double = !double;
    else if (!single && !double) {
      if (character === '[') square += 1;
      else if (character === ']') square -= 1;
      else if (character === '{') curly += 1;
      else if (character === '}') curly -= 1;
      else if (character === ',' && square === 0 && curly === 0) {
        parts.push(text.slice(start, index).trim());
        start = index + 1;
      }
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function scalar(text) {
  if (text === '') return undefined;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    const body = text.slice(1, -1);
    return text.startsWith('"') ? JSON.parse(text) : body.replace(/''/g, "'");
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    return splitInline(text.slice(1, -1)).map(scalar);
  }
  if (text.startsWith('{') && text.endsWith('}')) {
    const object = {};
    for (const part of splitInline(text.slice(1, -1))) {
      const pair = splitMapping(part);
      if (!pair) throw new Error(`invalid inline mapping: ${part}`);
      object[pair[0]] = scalar(pair[1]);
    }
    return object;
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null' || text === '~') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function tokenize(source, filename) {
  const lines = [];
  const rawLines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let number = 0; number < rawLines.length; number += 1) {
    if (/\t/.test(rawLines[number])) throw new Error(`${filename}:${number + 1}: tabs are not allowed in workflow YAML`);
    const stripped = stripComment(rawLines[number]);
    if (!stripped.trim()) continue;
    const trimmed = stripped.trim();
    const mapping = splitMapping(trimmed);
    const yamlValue = mapping ? mapping[1] : (trimmed.startsWith('- ') ? trimmed.slice(2).trim() : trimmed);
    if (/^%YAML\b/.test(trimmed) || /^(?:[&*]|![A-Za-z])[A-Za-z0-9_.-]*/.test(yamlValue)) {
      throw new Error(`${filename}:${number + 1}: YAML directives, anchors, aliases, and tags are not supported`);
    }
    const indent = stripped.match(/^ */)[0].length;
    lines.push({ indent, text: stripped.slice(indent), number: number + 1 });
  }
  return lines;
}

function parseBlock(lines, state, indent, filename) {
  if (state.index >= lines.length || lines[state.index].indent < indent) return undefined;
  const sequence = lines[state.index].indent === indent && lines[state.index].text.startsWith('- ');
  const value = sequence ? [] : {};

  while (state.index < lines.length) {
    const line = lines[state.index];
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error(`${filename}:${line.number}: unexpected indentation`);

    if (sequence) {
      if (!line.text.startsWith('- ')) throw new Error(`${filename}:${line.number}: mixed mapping and sequence`);
      const itemText = line.text.slice(2).trim();
      state.index += 1;
      const pair = splitMapping(itemText);
      if (pair) {
        const item = {};
        const [key, remainder] = pair;
        item[key] = remainder === ''
          ? parseNested(lines, state, indent, filename)
          : scalar(remainder);
        if (state.index < lines.length && lines[state.index].indent > indent) {
          const extra = parseBlock(lines, state, lines[state.index].indent, filename);
          if (!extra || Array.isArray(extra)) throw new Error(`${filename}:${line.number}: sequence mapping continuation must be an object`);
          Object.assign(item, extra);
        }
        value.push(item);
      } else if (itemText === '') {
        value.push(parseNested(lines, state, indent, filename));
      } else {
        value.push(scalar(itemText));
      }
      continue;
    }

    if (line.text.startsWith('- ')) throw new Error(`${filename}:${line.number}: mixed mapping and sequence`);
    const pair = splitMapping(line.text);
    if (!pair || !pair[0]) throw new Error(`${filename}:${line.number}: expected a mapping entry`);
    const [key, remainder] = pair;
    if (key === '<<') throw new Error(`${filename}:${line.number}: YAML merge keys are not supported`);
    if (Object.hasOwn(value, key)) throw new Error(`${filename}:${line.number}: duplicate key ${key}`);
    state.index += 1;
    if (remainder === '|' || remainder === '>') {
      const fragments = [];
      while (state.index < lines.length && lines[state.index].indent > indent) {
        fragments.push(lines[state.index].text);
        state.index += 1;
      }
      value[key] = fragments.join(remainder === '|' ? '\n' : ' ');
    } else {
      value[key] = remainder === '' ? parseNested(lines, state, indent, filename) : scalar(remainder);
    }
  }
  return value;
}

function parseNested(lines, state, parentIndent, filename) {
  if (state.index >= lines.length || lines[state.index].indent <= parentIndent) return {};
  return parseBlock(lines, state, lines[state.index].indent, filename);
}

export function parseWorkflowYaml(source, filename = '<workflow>') {
  const lines = tokenize(source, filename);
  if (lines.length === 0) throw new Error(`${filename}: workflow is empty`);
  const state = { index: 0 };
  const parsed = parseBlock(lines, state, lines[0].indent, filename);
  if (!parsed || Array.isArray(parsed)) throw new Error(`${filename}: workflow root must be a mapping`);
  if (state.index !== lines.length) throw new Error(`${filename}:${lines[state.index].number}: unparsed content`);
  return parsed;
}
