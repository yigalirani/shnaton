import * as esbuild from './tools/esbuild/node_modules/esbuild/lib/main.js'

esbuild.build({ 
  entryPoints: ['src/index.ts'],
  platform: 'node',
  bundle: true,
  outdir: './dist',
  sourcemap: true,
  target: 'node10',
  minifySyntax:false, 

})
 