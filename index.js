#!/usr/bin/env node
const { exec } = require('child_process');
const { argv, stdout, stderr } = require('process');
const which = require('which');
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
  const groovy = await which('groovy', {nothrow:true});
  if(!groovy) {
    stderr.write('groovy not found. Please ensure "groovy" is available in PATH');
  }

  const json = await read_stdout(
    [groovy, './Parser.groovy', srcname]
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

(async ()=> {
  const [,,...fileNames] = argv;
  if (fileNames.length === 0) {
    stderr.write('Filename required');
  } else {
    parseFile(fileNames[0]);
  }
})()
