const vs = require('vscode');
const which = require('which');
const uri2path = require('file-uri-to-path');
const { exec } = require('child_process');
const { existsSync } = require('fs');
const { basename } = require('path');
const { name, publisher } = require('./package.json');
const generator = require('./generator');

const log = vs.window.createOutputChannel('RsApiGen');

function writeLog(...args) {
  const line = [];
  for (const arg of args) {
    if (arg === null) line.push('null');
    else if (arg === undefined) line.push('undefined');
    else if (typeof arg === 'object' || Array.isArray(arg))
      line.push(JSON.stringify(arg, undefined, 2));
    else line.push(String(arg));
  }
  log.appendLine(line.join(' '));
}

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

async function getGroovyPath() {
  let groovy = vs.workspace.getConfiguration('rsapigen').get('groovy');
  if (groovy) {
    if (!existsSync(groovy)) {
      vs.window.showWarningMessage('Groovy not found on path:\n' + groovy);
      groovy = null;
      writeLog('Groovy not found at:', groovy);
    } else {
      writeLog('Groovy configured at:', groovy);
    }
  }

  if (!groovy) {
    groovy = await which('groovy', { nothrow: true });
    if (!groovy) {
      writeLog('Groovy not found in PATH');
      vs.window
        .showErrorMessage(
          'Groovy not found in PATH. Please specify groovy binary path in configuration.',
          'Open settings'
        )
        .then((x) => {
          if (x)
            vs.commands.executeCommand(
              'workbench.action.openSettings',
              'rsapigen.groovy'
            );
        });

      return null;
    } else {
      writeLog('Groovy found in PATH:', groovy);
    }
  }

  const output = await read_stdout(`"${groovy}" --version`);
  const m = /\b(\d+\.\d+\.\d+)\b/.exec(output);
  writeLog('Groovy version output:');
  writeLog(output);
  if (m && m[1].split('.')[0] < 4) {
    writeLog('Groovy too old:', m[1]);
    vs.window.showWarningMessage(
      [
        'Groovy may be too old. At least version 4.0.0 required.',
        `Detected groovy version: ${m[1]}`
      ].join('\n')
    );
  }

  return groovy;
}

const dialogOptions = {
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: true,
  filters: {
    'Groovy files': ['groovy'],
    'All files': ['*']
  },
  openLabel: 'Generate'
};

function activate(context) {
  const extPath = vs.extensions.getExtension(`${publisher}.${name}`).extensionPath;
  const parser = `${extPath}/Parser.groovy`;
  generator.debug = writeLog;

  async function runParser(filepath, groovy) {
    if (filepath.startsWith('file:')) filepath = uri2path(decodeURIComponent(filepath));
    if (filepath.startsWith('\\')) filepath = filepath.substring(1);
    writeLog('Parsing:', filepath);
    const generated = await generator.parseFile(filepath, parser, groovy);
    writeLog('Generated', generated.length, generated.length === 1 ? 'class' : 'classes');
    return `// ${basename(filepath)}\n` + generated.join('\n\n');
  }

  context.subscriptions.push(
    vs.commands.registerCommand('rsapigen.folder', async (target) => {
      try {
        const files = await vs.window.showOpenDialog(dialogOptions);
        if (!files || files.length === 0) return;
        const groovy = await getGroovyPath();
        const generated = await Promise.all(
          files.map((x) => runParser(x.toString(), groovy))
        );
        for (const src of generated) {
          const doc = await vs.workspace.openTextDocument({
            language: 'typescript',
            content: src
          });
          vs.window.showTextDocument(doc);
        }
      } catch (e) {
        writeLog('Command failed:');
        writeLog(e);
      }
    })
  );

  writeLog('RsApiGen Activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
