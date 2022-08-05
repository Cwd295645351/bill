const path = require("path")

const { CleanWebpackPlugin } = require("clean-webpack-plugin")
const { VueLoaderPlugin } = require("vue-loader")
const HtmlWepackPlugin = require("html-webpack-plugin")
const CopyWebpackPlugin = require("copy-webpack-plugin")

module.exports = {
	mode: "development",
	entry: "./main",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js"
	},
	resolve: {
		extensions: ['.js', '.vue', '.json', 'scss'],
		alias: {
		  '@': path.join(__dirname, './src'),
		},
	  },
	module: {
		rules: [
			{
				test: /\.vue$/,
				use: "vue-loader"
			},
			{
				test: /\.js$/,
				use: "babel-loader"
			}
		]
	},
	plugins: [
		new CleanWebpackPlugin(),
		new VueLoaderPlugin(),
		new HtmlWepackPlugin({
			title: "Webpack Plugin Sample",
			template: "./index.ejs"
		}),
		new CopyWebpackPlugin({
			patterns: [
				{
					from: path.resolve(__dirname, "public"),
					to: path.resolve(__dirname, "dist")
				}
			]
		})
	],
	devServer: {
		host: "localhost",
		port: 8880,
		hot: true
	}
}
