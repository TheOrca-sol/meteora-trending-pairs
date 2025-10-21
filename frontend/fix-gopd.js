#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const gopdPath = path.join(__dirname, 'node_modules', 'gopd', 'gOPD.js');
const gopdDtsPath = path.join(__dirname, 'node_modules', 'gopd', 'gOPD.d.ts');

// Check if gOPD.js exists
if (!fs.existsSync(gopdPath)) {
  console.log('⚠️  gOPD.js missing, creating it...');

  // Create gOPD.js
  const gopdContent = `'use strict';

/** @type {import('./gOPD')} */
module.exports = Object.getOwnPropertyDescriptor;
`;

  fs.writeFileSync(gopdPath, gopdContent, 'utf8');
  console.log('✅ Created gOPD.js');
}

// Check if gOPD.d.ts exists
if (!fs.existsSync(gopdDtsPath)) {
  console.log('⚠️  gOPD.d.ts missing, creating it...');

  // Create gOPD.d.ts
  const dtsContent = `declare const gOPD: typeof Object.getOwnPropertyDescriptor;
export = gOPD;
`;

  fs.writeFileSync(gopdDtsPath, dtsContent, 'utf8');
  console.log('✅ Created gOPD.d.ts');
}

// Verify gopd can be loaded
try {
  require('gopd/gOPD');
  console.log('✅ gopd verified successfully');
} catch (e) {
  console.error('❌ gopd verification failed:', e.message);
  process.exit(1);
}
