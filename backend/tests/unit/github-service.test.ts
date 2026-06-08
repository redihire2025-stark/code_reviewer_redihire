import { shouldIgnoreFile, getDiffPosition } from '../../src/github/service';

describe('shouldIgnoreFile', () => {
  const ignoredFiles = [
    'dist/index.js',
    'build/output.js',
    'coverage/lcov.info',
    'node_modules/lodash/index.js',
    'bundle.min.js',
    'styles.min.css',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'generated/types.ts',
    '.next/server/pages.js',
    'storybook-static/index.html',
    'assets/logo.png',
    'fonts/icon.woff2',
  ];

  const reviewableFiles = [
    'src/components/Button.tsx',
    'src/hooks/useAuth.ts',
    'src/utils/format.ts',
    'README.md',
    'src/styles/main.css',
    'tests/unit/button.test.ts',
  ];

  test.each(ignoredFiles)('ignores %s', (file) => {
    expect(shouldIgnoreFile(file)).toBe(true);
  });

  test.each(reviewableFiles)('reviews %s', (file) => {
    expect(shouldIgnoreFile(file)).toBe(false);
  });
});

describe('getDiffPosition', () => {
  const samplePatch = `@@ -1,5 +1,7 @@
 import React from 'react';
+import { useState } from 'react';
 
 const Component = () => {
-  const [state] = React.useState();
+  const [state, setState] = useState();
+  console.log(state);
   return null;
 };`;

  it('returns position for an existing line', () => {
    // Line 2 is the added useState import (position 2 in patch)
    const position = getDiffPosition(samplePatch, 2);
    expect(position).toBeDefined();
    expect(typeof position).toBe('number');
  });

  it('returns undefined for a line beyond the patch', () => {
    const position = getDiffPosition(samplePatch, 9999);
    expect(position).toBeUndefined();
  });
});
