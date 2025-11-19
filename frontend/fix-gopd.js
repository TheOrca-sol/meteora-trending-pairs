#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Define packages and their missing files
const packages = {
  'gopd': {
    files: {
      'gOPD.js': `'use strict';

/** @type {import('./gOPD')} */
module.exports = Object.getOwnPropertyDescriptor;
`,
      'gOPD.d.ts': `declare const gOPD: typeof Object.getOwnPropertyDescriptor;
export = gOPD;
`
    },
    verify: 'gopd/gOPD'
  },
  'es-object-atoms': {
    files: {
      'isObject.js': `'use strict';

/** @type {import('./isObject')} */
module.exports = function isObject(x) {
\treturn !!x && (typeof x === 'function' || typeof x === 'object');
};
`,
      'RequireObjectCoercible.js': `'use strict';

var $TypeError = require('es-errors/type');

/** @type {import('./RequireObjectCoercible')} */
module.exports = function RequireObjectCoercible(value) {
\tif (value == null) {
\t\tthrow new $TypeError((arguments.length > 0 && arguments[1]) || ('Cannot call method on ' + value));
\t}
\treturn value;
};
`,
      'ToObject.js': `'use strict';

var $Object = require('./');
var RequireObjectCoercible = require('./RequireObjectCoercible');

/** @type {import('./ToObject')} */
module.exports = function ToObject(value) {
\tRequireObjectCoercible(value);
\treturn $Object(value);
};
`
    },
    verify: 'es-object-atoms/isObject'
  },
  'webpack-sources': {
    files: {
      'helpers/stringBufferUtils.js': `'use strict';

const { Buffer } = require('buffer');

function contentToString(content) {
\tif (typeof content === 'string') {
\t\treturn content;
\t}
\tif (Buffer.isBuffer(content)) {
\t\treturn content.toString('utf-8');
\t}
\tif (content && typeof content === 'object' && typeof content.toString === 'function') {
\t\treturn content.toString();
\t}
\treturn String(content);
}

function contentToBuffer(content) {
\tif (Buffer.isBuffer(content)) {
\t\treturn content;
\t}
\tif (typeof content === 'string') {
\t\treturn Buffer.from(content, 'utf-8');
\t}
\treturn Buffer.from(String(content), 'utf-8');
}

exports.contentToString = contentToString;
exports.contentToBuffer = contentToBuffer;
`
    },
    verify: 'webpack-sources/lib/CachedSource'
  }
};

// Process each package
for (const [packageName, config] of Object.entries(packages)) {
  const packagePath = path.join(__dirname, 'node_modules', packageName);

  // Create files if missing
  for (const [fileName, content] of Object.entries(config.files)) {
    const filePath = path.join(packagePath, fileName);
    const dirPath = path.dirname(filePath);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${packageName}/${fileName} missing, creating it...`);
      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Created ${packageName}/${fileName}`);
    }
  }

  // Verify package can be loaded
  try {
    require(config.verify);
    console.log(`✅ ${packageName} verified successfully`);
  } catch (e) {
    console.error(`❌ ${packageName} verification failed:`, e.message);
    process.exit(1);
  }
}
