"use strict";

const path = require("path");

/**@type {import('webpack').Configuration}*/
module.exports = [
    {
        target: "node",
        entry: "./src/extension.ts",
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: "extension.js",
            libraryTarget: "commonjs2",
            devtoolModuleFilenameTemplate: "../[resource-path]",
        },
        devtool: "source-map",
        externals: {
            vscode: "commonjs vscode",
        },
        resolve: {
            extensions: [".ts", ".js"],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: [/node_modules/, /media/],
                    use: [
                        {
                            loader: "ts-loader",
                            options: {
                                configFile: "tsconfig.extension.json",
                            },
                        },
                    ],
                },
            ],
        },
    },
    {
        entry: "./media/editor.ts",
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: "editor.js",
        },
        devtool: "source-map",
        resolve: {
            extensions: [".ts", ".js"],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: [/node_modules/],
                    use: [
                        {
                            loader: "ts-loader",
                            options: {
                                configFile: "tsconfig.editor.json",
                            },
                        },
                    ],
                },
            ],
        },
    },
];
