<div align="center">
  <h1>DefineConstantPlugin</h1>
  With this plugin, you can use something like DefinePlugin.runtimeValue in Webpack3.  
</div>
<div align="center">
  <h2>Install</h2>
</div>

```
npm i --save-dev define-constant-plugin
```

<div align="center">
  <h2>Usage</h2>
</div>

**webpack.config.js**

```js
const DefineConstantPlugin = require('define-constant-plugin')

module.exports = {
  entry: 'index.js',
  plugins: [
    new DefineConstantPlugin({
      'process.env':  DefineConstantPlugin.runtimeValue(Date.now, {
        fileDependencies: [fileDep],
      })
    })
  ],
}
```

