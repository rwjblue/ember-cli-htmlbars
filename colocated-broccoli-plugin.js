'use strict';

const fs = require('fs');
const mkdirp = require('mkdirp');
const copyFileSync = require('fs-copy-file-sync');
const path = require('path');
const walkSync = require('walk-sync');
const Plugin = require('broccoli-plugin');

module.exports = class ColocatedTemplateProcessor extends Plugin {
  constructor(tree, options) {
    super([tree], options);

    this.options = options;
  }

  build() {
    // TODO: do we need to pass through all files, or only template files?
    let files = walkSync(this.inputPaths[0], { directories: false });

    let filesToCopy = [];
    files.forEach(filePath => {
      let filePathParts = path.parse(filePath);
      let inputPath = path.join(this.inputPaths[0], filePath);

      // TODO: why are these different?
      // Apps: my-app/components/foo.hbs, my-app/templates/components/foo.hbs
      // Addons: components/foo.js, templates/components/foo.hbs

      // TODO: make this more robust
      let isInsideComponentsFolder =
        (filePath.includes('/components/') || filePath.startsWith('components/')) &&
        !filePath.includes('/templates/components/') &&
        !filePath.startsWith('templates/components');

      // copy forward non-hbs files
      // TODO: don't copy .js files that will ultimately be overridden
      if (!isInsideComponentsFolder || filePathParts.ext !== '.hbs') {
        filesToCopy.push(filePath);
        return;
      }

      // TODO: deal with alternate extensions (e.g. ts)
      let possibleJSPath = path.join(filePathParts.dir, filePathParts.name + '.js');
      let hasJSFile = fs.existsSync(path.join(this.inputPaths[0], possibleJSPath));

      if (filePathParts.name === 'template') {
        // TODO: maybe warn?
        return;
      }

      let templateContents = fs.readFileSync(inputPath, { encoding: 'utf8' });
      let jsContents = null;

      // TODO: deal with hygiene
      if (hasJSFile) {
        // add the template, call setComponentTemplate

        jsContents = fs.readFileSync(path.join(this.inputPaths[0], possibleJSPath), { encoding: 'utf8' });

        if (jsContents.includes('export default')) {
          jsContents = jsContents.replace('export default', 'const CLASS =');
        } else {
          let message = `${filePath}\` does not contain a \`default export\`. Did you forget to export the component class?`;
          jsContents = `${jsContents}\nthrow new Error(${JSON.stringify(message)})`;
        }

        jsContents = `${jsContents}
const setComponentTemplate = Ember._setComponentTemplate;
const TEMPLATE = ${this.options.precompile(templateContents)};
export default setComponentTemplate(TEMPLATE, CLASS);`;
      } else {
        // create JS file, use null component pattern
        jsContents = `const templateOnlyComponent = Ember._templateOnlyComponent;
const setComponentTemplate = Ember._setComponentTemplate;
const TEMPLATE = ${this.options.precompile(templateContents)};
const CLASS = templateOnlyComponent();
export default setComponentTemplate(TEMPLATE, CLASS);`;
      }


      let outputPath = path.join(this.outputPath, possibleJSPath);

      // TODO: don't speculatively mkdirSync (likely do in a try/catch with ENOENT)
      mkdirp.sync(path.dirname(outputPath));
      fs.writeFileSync(outputPath, jsContents, { encoding: 'utf8' });
    });

    filesToCopy.forEach(filePath => {
      let inputPath = path.join(this.inputPaths[0], filePath);
      let outputPath = path.join(this.outputPath, filePath);

      // avoid copying file over top of a previously written one
      if (fs.existsSync(outputPath)) {
        return;
      }

      // TODO: don't speculatively mkdirSync (likely do in a try/catch with ENOENT)
      mkdirp.sync(path.dirname(outputPath));
      copyFileSync(inputPath, outputPath);
    })
  }
}
