import { babel } from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import filesize from "rollup-plugin-filesize";
import { terser } from "rollup-plugin-terser";

const resolveConfig = { extensions: [".ts"] };
const babelConfig = { extensions: [".ts"], babelHelpers: "bundled" };

export default [
  {
    input: "./src/index.ts",
    output: {
      file: "./dist/index.min.js",
      sourcemap: true,
      format: "cjs",
    },
    plugins: [
      nodeResolve(resolveConfig),
      babel(babelConfig),
      replace({
        values: {
          "process.env.NODE_ENV": JSON.stringify("production"),
        },
        preventAssignment: true,
      }),
      terser(),
      filesize(),
    ],
  },
  {
    input: "./src/index.ts",
    output: {
      file: "./dist/index.js",
      sourcemap: true,
      format: "cjs",
    },
    plugins: [nodeResolve(resolveConfig), babel(babelConfig), filesize()],
  },
  {
    input: "./src/index.ts",
    output: {
      file: "./dist/index.es.js",
      sourcemap: true,
      format: "es",
    },
    plugins: [nodeResolve(resolveConfig), babel(babelConfig)],
  },
];
