const path = require('path')

const webpack = require('webpack')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const HtmlWepackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const dayjs = require('dayjs')

module.exports = (env) => {
  const isBuild = env.build
  // const isDev = !isBuild

  /**
   * @type {import('webpack').Configuration}
   */
  const config = {
    mode: isBuild ? 'production' : 'development',
    entry: './main',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    resolve: {
      extensions: ['.js', '.vue', '.json', 'scss'],
      alias: {
        '@': path.join(__dirname, 'src'),
      },
    },
    devtool: isBuild ? false : 'eval-cheap-module-source-map',
    module: {
      rules: [
        {
          test: /\.vue$/,
          use: 'vue-loader',
        },
        {
          test: /\.js$/,
          use: 'babel-loader',
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        BUILD_TIME: JSON.stringify(dayjs().format('YYYY-MM-DD HH:mm:ss')),
        ENV: env.to ? JSON.stringify(env.to) : JSON.stringify('prod'),
      }),
      new CleanWebpackPlugin(),
      new VueLoaderPlugin(),
      new HtmlWepackPlugin({
        title: '记账',
        templateParameters: {
          envPath: isBuild ? '/env.js' : 'env.local.js',
        },
        template: './index.html',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'public'),
            to: path.resolve(__dirname, 'dist'),
          },
        ],
      }),
    ],
    devServer: {
      host: 'localhost',
      port: 8880,
      hot: true,
      open: true,
    },
  }

  return config
}
