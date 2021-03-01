"use strict";

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

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
                    include: /(node_modules|src)/,
                    exclude: [/webviews/],
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
        entry: "./webviews/editor.ts",
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
                    include: /(node_modules|webviews)/,
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
        plugins: [
            new CopyPlugin({
                patterns: [
                    {from: path.resolve(__dirname, "node_modules/ag-grid-community/dist/styles/ag-grid.min.css"), to: path.join(__dirname, "dist/ag-grid.min.css")},
                    {from: path.resolve(__dirname, "node_modules/ag-grid-community/dist/styles/ag-theme-alpine.min.css"), to: path.join(__dirname, "dist/ag-theme-alpine.min.css")},
                ]
            })
        ]
    },
];
