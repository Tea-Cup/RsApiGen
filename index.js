#!/usr/bin/env node
const { argv, stdout, stderr } = require('process');
const path = require('path');
const which = require('which');
const { parseFile } = require('./generator');

(async () => {
  const groovy = await which('groovy', { nothrow: true });
  if (!groovy) {
    throw new Error('groovy not found. Please ensure "groovy" is available in PATH');
  }

  const [, myname, ...fileNames] = argv;
  if (fileNames.length === 0) {
    throw new Error('Filename required');
  }

  const parser = path.resolve(myname, '../Parser.groovy');
  const generated = parseFile(fileNames[0], parser, groovy);

  return generated.join('\n\n');
})()
  .then((x) => void stdout.write(x))
  .catch((e) => void stderr.write(e.message));
