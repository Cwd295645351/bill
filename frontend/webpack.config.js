const path = require('path')

const webpack = require('webpack')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const HtmlWepackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const dayjs = require('dayjs')

module.exports = (env) => {
  const isBuild = env.build
  // const isDev = !isBuild

  /**
   * @type {import('webpack').Configuration}
   */
  const config = {
    mode: isBuild ? 'production' : 'development',
    entry: './src/main',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js'
    },
    resolve: {
      extensions: ['.js', '.vue', '.json', 'scss'],
      alias: {
        '@': path.join(__dirname, 'src')
      }
    },
    devtool: isBuild ? false : 'eval-cheap-module-source-map',
    module: {
      rules: [
        {
          test: /\.(png|jpg|gif)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 25 * 1024
            }
          },
          generator: {
            filename: 'assets/images/[name]-[hash:6].[ext]'
          }
        },
        {
          test: /\.(sc|c)ss$/,
          use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader']
        },
        {
          test: /\.vue$/,
          use: 'vue-loader'
        },
        {
          test: /\.js$/,
          use: 'babel-loader'
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        BUILD_TIME: JSON.stringify(dayjs().format('YYYY-MM-DD HH:mm:ss')),
        ENV: env.to ? JSON.stringify(env.to) : JSON.stringify('prod')
      }),
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin({
        filename: isBuild ? '[name].[contenthash].css' : '[name].css'
      }),
      new VueLoaderPlugin(),
      new HtmlWepackPlugin({
        title: '记账',
        templateParameters: {
          envPath: isBuild ? '/env.js' : 'env.local.js'
        },
        template: './index.html'
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'public'),
            to: path.resolve(__dirname, 'dist')
          }
        ]
      })
    ],
    watchOptions: {
      aggregateTimeout: 300,
      ignored: '**/node_modules',
      stdin: true
    },
    devServer: {
      host: 'localhost',
      port: 8880,
      hot: true,
      compress: true,
      open: true
    }
  }

  return config
}
