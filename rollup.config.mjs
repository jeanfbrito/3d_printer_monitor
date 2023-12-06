import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts', // Your main TypeScript file
  output: {
    dir: 'app', // Output file
    format: 'cjs',       // CommonJS format suitable for Node.js
    sourcemap: true      // Optional: Enable source maps
  },
  plugins: [
    typescript() // TypeScript plugin
  ]
};
