import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
    input: "src/editor/editor.ts",
    output: {
        dir: "out",
        name: "editor.js",
        sourcemap: true,
        format: "iife",
    },
    plugins: [resolve(), typescript({ tsconfig: "./tsconfig.editor.json" }), commonjs({ extensions: [".js", ".ts"] })],
};
