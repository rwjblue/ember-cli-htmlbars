'use strict';

const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');

class Plugin {
  transform(ast) {
    this.syntax.traverse(ast, {
      MustacheStatement(node) {
        if (node.path.original === 'ast-transform-will-replace') {
          let value = node.hash.pairs.find(x => x.key === 'with').value.value;

          node.type = 'TextNode';
          node.chars = value;
        }
      }
    });
  }
}

module.exports = function(defaults) {
  let app = new EmberAddon(defaults, {
    // Add options here
  });

  app.registry.add('htmlbars-ast-plugin', {
    name: 'replace-ast-transform',
    plugin: Plugin
  });

  /*
    This build file specifies the options for the dummy test app of this
    addon, located in `/tests/dummy`
    This build file does *not* influence how the addon or the app using it
    behave. You most likely want to be modifying `./index.js` or app's build file
  */

  return app.toTree();
};
