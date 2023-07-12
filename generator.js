const prettier = require('prettier');

function nameEq(name) {
  return (x) => x.name === name;
}
function findAnnotation(obj, name) {
  return obj?.annotations?.find(nameEq(name));
}
function convertVarType(type) {
  const result =
    {
      Long: 'number',
      Boolean: 'boolean',
      GridRequest: 'SpringGridRequest'
    }[type] ?? type;
  return result.endsWith('Dto') ? result.slice(0, -3) : result;
}
function getMapping(method) {
  for (const anno of method.annotations) {
    if (anno.name === 'GetMapping') return ['GET', anno.values[0]];
    if (anno.name === 'PostMapping') return ['POST', anno.values[0]];
    if (anno.name === 'PutMapping') return ['PUT', anno.values[0]];
    if (anno.name === 'PatchMapping') return ['PATCH', anno.values[0]];
    if (anno.name === 'DeleteMapping') return ['DELETE', anno.values[0]];
  }
  return [];
}
function reducePathVars(path, [parName, varName]) {
  const rx = new RegExp(`{${varName}}`, 'g');
  return path.replace(rx, '${' + parName + '}');
}
function generateParameters(method) {
  const header = [];
  const optionalHeader = [];
  const optionalPars = [];
  const options = [];
  const path = [];
  let body = '';

  for (const par of method.parameters) {
    let optional = false;

    for (const anno of par.annotations) {
      if (anno.name === 'PathVariable') {
        path.push([par.name, anno.values[0]]);
      } else if (anno.name === 'RequestParam') {
        options.push(`'${anno.values[0]}': ${par.name}`);
        optional = anno.values[1]?.toLowerCase() === 'false';
      } else if (anno.name === 'RequestBody') {
        body = par.name;
      }
    }

    // TODO: figure out optional params.
    if (optional) {
      optionalHeader.push(`${par.name}: ${convertVarType(par.type)}`);
    } else {
      header.push(`${par.name}: ${convertVarType(par.type)}`);
    }
  }

  header.push(...optionalHeader);

  return { header, options, path, body };
}
function generatePath(classAddress, pathParams, mappingPath) {
  if (!mappingPath) {
    const split = classAddress.split(/[\/]/g);
    const head = split.slice(0, -1).join('/');
    const tail = split[split.length - 1];
    return generatePath(head, pathParams, tail);
  }

  if (pathParams.length === 0) {
    return [`'${classAddress}'`, `'${mappingPath}'`];
  }

  const action = pathParams.reduce(reducePathVars, mappingPath);
  return [`'${classAddress}'`, '`' + action + '`'];
}
function generateMethod(method, classAddress) {
  const name = method.name;

  const [httpMethod, mappingPath] = getMapping(method);
  if (!httpMethod) return null;

  const genParams = generateParameters(method);
  const params = genParams.header;
  const [address, action] = generatePath(classAddress, genParams.path, mappingPath);

  const options = [`method: '${httpMethod}'`];
  if (genParams.body) {
    options.push(`body: ${genParams.body}`);
  }
  if (genParams.options.length > 0) {
    options.push(`params: {\n${genParams.options.join(',\n')}\n}`);
  }

  const optionsString = options.join(',\n');
  const header = `${name}(${params.join(',')})`;
  const body = `return this.fetch<UNKNOWN>(${address},${action},{\n${optionsString}\n});`;
  return `${header}{${body}}`;
}

function getClassAddress(cls) {
  const RequestMapping = findAnnotation(cls, 'RequestMapping');
  return RequestMapping?.values[0]?.replace(/\\/g, '/') ?? '';
}
module.exports = function (cls) {
  const address = getClassAddress(cls);
  if (!address) throw new Error('Unable to find class address');

  const methods = cls.methods.map((x) => generateMethod(x, address)).filter((x) => !!x);

  const src = [
    "import { SpringApi, SpringGridRequest } from '@system/springApi';",
    '',
    'class SpringApiFacade extends SpringApi {',
    `static readonly ADDRESS = '${address}';`,
    '',
    'constructor() {super(UNKNOWN, UNKNOWN);}',
    '',
    methods.join('\n\n'),
    '}'
  ].join('\n');

  return prettier.format(src, {
    printWidth: 90,
    trailingComma: 'none',
    singleQuote: true,
    parser: 'typescript'
  });
};
