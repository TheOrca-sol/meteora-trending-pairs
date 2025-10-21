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
  }
};

// Process each package
for (const [packageName, config] of Object.entries(packages)) {
  const packagePath = path.join(__dirname, 'node_modules', packageName);

  // Create files if missing
  for (const [fileName, content] of Object.entries(config.files)) {
    const filePath = path.join(packagePath, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${packageName}/${fileName} missing, creating it...`);
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
