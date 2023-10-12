
'use strict'

const ConstDependency = require('webpack/lib/dependencies/ConstDependency')
const BasicEvaluatedExpression = require('webpack/lib/BasicEvaluatedExpression')
const ParserHelpers = require('webpack/lib/ParserHelpers')
const NullFactory = require('webpack/lib/NullFactory')

class RuntimeValue {
	constructor(fn, options) {
		this.fn = fn
		this.options = options || {}
	}

	exec(parser) {
		const module = parser.state.module;
		for (const fileDependency of this.options.fileDependencies) {
			if (!module.fileDependencies.includes(fileDependency)) module.fileDependencies.push(fileDependency)
		}
		return this.fn()
	}
}

module.exports = class DefineConstantPlugin {

	constructor(definitions) {
		this.definitions = definitions
	}

	static runtimeValue(fn, options) {
		return new RuntimeValue(fn, options)
	}

	apply(compiler) {
		const definitions = this.definitions
		compiler.plugin('compilation', (compilation, params) => {
			compilation.dependencyFactories.set(ConstDependency, new NullFactory())
			compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template())

			params.normalModuleFactory.plugin("parser", (parser) => {
				(function walkDefinitions(definitions, prefix) {
					Object.keys(definitions).forEach((key) => {
						const code = definitions[key]
						if (code && typeof code === "object" && !(code instanceof RuntimeValue) && !(code instanceof RegExp)) {
							walkDefinitions(code, prefix + key + ".")
							applyObjectDefine(prefix + key, code)
							return
						}
						applyDefineKey(prefix, key)
						applyDefine(prefix + key, code)
					})
				}(definitions, ''))

				function stringifyObj(obj) {
					return 'Object({' + Object.keys(obj).map((key) => {
						const code = obj[key]
						return JSON.stringify(key) + ':' + toCode(code)
					}).join(',') + '})'
				}

				function toCode(code) {
					if (code === null) return 'null'
					else if (code === undefined) return 'undefined'
					else if (code instanceof RuntimeValue) return toCode(
						code.exec(parser)
					)
					else if (code instanceof RegExp && code.toString) return code.toString()
					else if (typeof code === 'function' && code.toString) return '(' + code.toString() + ')'
					else if (typeof code === 'object') return stringifyObj(code)
					else return code + ''
				}

				function applyDefineKey(prefix, key) {
					const splittedKey = key.split('.')
					splittedKey.slice(1).forEach((_, i) => {
						const fullKey = prefix + splittedKey.slice(0, i + 1).join('.')
						parser.plugin('can-rename ' + fullKey, ParserHelpers.approve)
					})
				}

				function applyDefine(key, code) {
					const isTypeof = /^typeof\s+/.test(key)
					if (isTypeof) key = key.replace(/^typeof\s+/, '')
					let recurse = false
					let recurseTypeof = false
					if (!isTypeof) {
						parser.plugin('can-rename ' + key, ParserHelpers.approve)
						parser.plugin('evaluate Identifier ' + key, (expr) => {
							/**
							 * this is needed in case there is a recursion in the DefinePlugin
							 * to prevent an endless recursion
							 * e.g.: new DefinePlugin({
							 * 'a': 'b',
							 * 'b': 'a'
							 * });
							 */
							if (recurse) return
							recurse = true
							const res = parser.evaluate(toCode(code))
							recurse = false
							res.setRange(expr.range)
							return res
						})
						parser.plugin('expression ' + key, function(expr) {
							return ParserHelpers.toConstantDependency(toCode(code)).call(this, expr)
						})
					}
					parser.plugin('evaluate typeof ' + key, (expr) => {
						/**
						 * this is needed in case there is a recursion in the DefinePlugin
						 * to prevent an endless recursion
						 * e.g.: new DefinePlugin({
						 * 'typeof a': 'tyepof b',
						 * 'typeof b': 'typeof a'
						 * });
						 */
						if (recurseTypeof) return
						recurseTypeof = true
						const typeofCode = isTypeof ? code : 'typeof (' + toCode(code) + ')'
						const res = parser.evaluate(typeofCode)
						recurseTypeof = false
						res.setRange(expr.range)
						return res
					})
					parser.plugin('typeof ' + key, (expr) => {
						const typeofCode = isTypeof ? code : 'typeof (' + toCode(code) + ')'
						const res = parser.evaluate(typeofCode)
						if (!res.isString()) return
						return ParserHelpers.toConstantDependency(JSON.stringify(res.string)).bind(parser)(expr)
					})
				}

				function applyObjectDefine(key, obj) {
					parser.plugin('can-rename ' + key, ParserHelpers.approve)
					parser.plugin('evaluate Identifier ' + key, (expr) => new BasicEvaluatedExpression().setTruthy().setRange(expr.range))
					parser.plugin('evaluate typeof ' + key, ParserHelpers.evaluateToString('object'))
					parser.plugin('expression ' + key,function(expr) {
						const code = stringifyObj(obj)
						return ParserHelpers.toConstantDependency(code).call(this, expr)
					})
					parser.plugin('typeof ' + key, ParserHelpers.toConstantDependency(JSON.stringify('object')))
				}
			})
		})
	}
}

