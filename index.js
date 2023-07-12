const { exec } = require('child_process');
const { argv } = require('process');
const generateClass = require('./generator');

function read_stdout(command) {
  return new Promise((resolve, reject) => {
    exec(command, function (error, stdout, stderr) {
      if (error) reject(error);
      if (stderr) {
        console.error(stderr);
        reject(new Error('stderr'));
      }
      resolve(stdout);
    });
  });
}

async function parseFile(srcname) {
  const json = await read_stdout(
    ['./groovy-parser/groovy/bin/groovy.bat', './groovy-parser/Parser.groovy', srcname]
      .map((x) => `"${x}"`)
      .join(' ')
  );
  const parsed = JSON.parse(json);
  //writeFileSync('debug.json', JSON.stringify(parsed, undefined, 2), 'utf-8');
  if(parsed.length === 0) {
    stderr.write('No classes found');
    return;
  }
  const cls = parsed[0];
  const generated = generateClass(cls);
  stdout.write(generated);
}

const [,,...fileNames] = argv;
if (fileNames.length === 0) {
  stderr.write('Filename required');
} else {
  parseFile(fileNames[0]);
}

