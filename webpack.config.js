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
    entry: './src/webviews/frameList/src/index.tsx',
    mode: 'none',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'frameList.js',
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
                configFile: path.resolve(__dirname, 'src', 'webviews', 'frameList', 'tsconfig.json'),
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
  },
  {
    entry: './src/webviews/frameHex/src/index.tsx',
    mode: 'none',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'frameHex.js',
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
                configFile: path.resolve(__dirname, 'src', 'webviews', 'frameHex', 'tsconfig.json'),
              }
            }
          ]
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            'css-loader',
          ]
        }
      ],
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      }),
    ],
  }
];
