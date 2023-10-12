const webpack = require('webpack')
const path = require('path')
const fs = require('fs')
const DefineConstantPlugin = require('../src/define-constant-plugin.js')

const options = {
  entry: ['./example/foo.js', './example/bar.js'],
  plugins: [
    new DefineConstantPlugin({
      'process.env':  DefineConstantPlugin.runtimeValue(() => {
        const localFile = path.join(__dirname, 'env.local.js')
        const envFile = fs.existsSync(localFile) ?  require.resolve('./env.local.js') : require.resolve('./env.js')
        delete require.cache[envFile]
        return require(envFile)
      }, {
        fileDependencies: [path.resolve(__dirname, 'env.js'), path.join(__dirname, 'env.local.js')],
      })
    })
  ],
  watch: true,
  output: {
    filename: './example/dist/main.js'
  }
}
webpack(options, (err, stats) => {
  if(!(err || stats.hasErrors())) console.log('Compile Successed!')
  else console.log('Compile Failed!', err, stats.compilation.errors)
})