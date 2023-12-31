const prettier = require('prettier');
const { exec } = require('child_process');
const { writeFileSync } = require('fs');

function nameEq(name) {
  return (x) => x.name === name;
}
function findAnnotation(obj, name) {
  return obj?.annotations?.find(nameEq(name));
}
function convertType(type) {
  if(type === 'void -> void') return 'void';
  if(!type || type === '?') return 'UNKNOWN';

  const m = /^([^<]+)<([^>]*)>$/.exec(type);
  if (m) {
    if (m[1] === 'List') return convertType(m[2]) + '[]';
    if (m[1] === 'ResponseEntity') return convertType(m[2]);
  }

  const result =
    {
      Long: 'number',
      Boolean: 'boolean',
      GridRequest: 'SpringGridRequest',
      String: 'string'
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
      optionalHeader.push(`${par.name}: ${convertType(par.type)}`);
    } else {
      header.push(`${par.name}: ${convertType(par.type)}`);
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

  if (mappingPath.startsWith('/')) mappingPath = mappingPath.substring(1);

  if (pathParams.length === 0) {
    return [classAddress, `'${mappingPath}'`];
  }

  const action = pathParams.reduce(reducePathVars, mappingPath);
  return [classAddress, '`' + action + '`'];
}
function generateMethod(method, classAddress, className) {
  const name = method.name;

  const [httpMethod, mappingPath] = getMapping(method);
  if (!httpMethod) return null;

  const genParams = generateParameters(method);
  const params = genParams.header;
  const [address, action] = generatePath(classAddress, genParams.path, mappingPath);
  const retType = convertType(method.returnType);

  const options = [`method: '${httpMethod}'`];
  if (genParams.body) {
    options.push(`body: ${genParams.body}`);
  }
  if (genParams.options.length > 0) {
    options.push(`params: {\n${genParams.options.join(',\n')}\n}`);
  }

  const fetchString = retType === 'string' ? 'fetchText' : `fetch<${retType}>`;
  const optionsString = options.join(',\n');
  const addrString =
    address === classAddress ? `${className}.ADDRESS` : `'${address}'`;
  const header = `${name}(${params.join(',')})`;
  const body = `return this.${fetchString}(${addrString},${action},{\n${optionsString}\n});`;
  return `${header}{${body}}`;
}

function getClassAddress(cls) {
  const RequestMapping = findAnnotation(cls, 'RequestMapping');
  return RequestMapping?.values[0]?.replace(/\\/g, '/') ?? '';
}
function generateClass(cls, imports) {
  const address = getClassAddress(cls);
  if (!address) throw new Error('Unable to find class address');

  const className = cls.name.split(/\./g).slice(-1)[0];
  const methods = cls.methods
    .map((x) => generateMethod(x, address, className))
    .filter((x) => !!x);

  const src = [
    `class ${className} extends SpringApi {`,
    `static readonly ADDRESS = '${address}';`,
    '',
    'constructor() {super(UNKNOWN, UNKNOWN);}',
    '',
    methods.join('\n\n'),
    '}'
  ];

  if (imports)
    src.unshift("import { SpringApi, SpringGridRequest } from '@system/springApi';", '');

  return prettier.format(src.join('\n'), {
    printWidth: 90,
    trailingComma: 'none',
    singleQuote: true,
    parser: 'typescript'
  });
}

function read_stdout(command) {
  exports.debug?.('>', command);
  return new Promise((resolve, reject) => {
    exec(command, function (error, stdout, stderr) {
      if (error) {
        exports.debug?.('ERR', error);
        reject(error);
      }
      if (stderr) {
        exports.debug?.('STDERR', stderr);
        reject(new Error(stderr));
      }
      exports.debug?.('STDOUT', error);
      resolve(stdout);
    });
  });
}

module.exports = {
  debug: null,
  parseFile: async function parseFile(srcname, parser, groovy) {
    const json = await read_stdout(`"${groovy}" "${parser}" "${srcname}"`);
    const parsed = JSON.parse(json);
    // writeFileSync('debug.json', JSON.stringify(parsed, undefined, 2));
    return parsed.map((x, i) => generateClass(x, i === 0, i));
  }
}
