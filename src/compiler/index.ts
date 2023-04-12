import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'
import { CompilerOptions, CompiledResult } from 'types/compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile(
  template: string, // template 模板内容
  options: CompilerOptions
): CompiledResult {
  // ast 全名：Abstract Syntax Tree，即抽象语法树。是源代码语法结构的一种抽象表示。
  // 在计算机中，任何问题的本质就是 数据结构 + 算法，ast也是一种数据结构，来描述源代码的一种结构化表示
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化AST抽象树,做了一层静态标记优化。给一些不变的节点打上标记，提升后面patch diff的性能。
    // 所有类型type添加static属性
    optimize(ast, options)
  }
  // 代码生成阶段，通过ast将转化为render函数
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
