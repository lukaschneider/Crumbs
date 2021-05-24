//@ts-check

'use strict';

const webpack = require('webpack');
const path = require('path');

/**@type {import('webpack').Configuration}*/
module.exports = [
  {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    devtool: 'nosources-source-map',
    externals: {
      vscode: 'commonjs vscode'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader'
            }
          ]
        }
      ]
    }
  },
  {
    entry: './src/webviews/src/index.tsx',
    mode: 'none',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'webview.js',
      libraryTarget: 'commonjs2'
    },
    devtool: 'nosources-source-map',
    resolve: {
      extensions: ['.ts', '.js', '.tsx'],
    },
    module: {
      rules: [
        {
          test: /\.ts*/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, 'src', 'webviews', 'tsconfig.json'),
              }
            }
          ]
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            'css-loader'
          ]
        }
      ]
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
    ],
  }
];
