#!/usr/bin/env node
const { exec } = require('child_process');
const { argv, stdout, stderr } = require('process');
const which = require('which');
const path = require('path');
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

async function parseFile(srcname, parser) {
  const groovy = await which('groovy', {nothrow:true});
  if(!groovy) {
    stderr.write('groovy not found. Please ensure "groovy" is available in PATH');
  }

  const json = await read_stdout(
    [groovy, parser, srcname]
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
  const [, myname, ...fileNames] = argv;
  if (fileNames.length === 0) {
    stderr.write('Filename required');
  } else {
    const parser = path.resolve(myname, '../Parser.groovy');
    parseFile(fileNames[0], parser);
  }
})()
