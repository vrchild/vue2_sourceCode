### src
* compiler    编译相关
* core        核心代码
* platforms   不同平台的支持
* server      服务端渲染
* sfc         .vue 文件解析
* shared       共享代码

### compiler 编译相关，模板解析成 ast 语法树，ast 语法树优化，代码生成等功能。（将template字符串转化为render函数的过程）
https://juejin.cn/post/6939434400576700446#heading-5
构建时compiler：vue-loader会 将 .vue文件的内容，转化为render函数
运行时compiler：compiler动态将template转化为render函数
本质上，构建时compiler和运行时compiler都是转化为render函数。 显示构建时效率更高，在我们的生产环境中，尽量避免运行的时候，再去compiler。
手写render，vue会直接执行render， 省去了compiler过程。 但是手写render，对于我们开发和维护 都不友好。还是建议大家 使用 webpack + vue-loader，构建时compiler。
* compileToFunctions
  + parse - Convert HTML string to AST.（主要是处理字符串）
    ```
    3种类型的 ast
      type == 1, 普通元素节点
      type == 2, 包含变量的文本 加上static = false标识
      type == 3, 纯文本，不包含变量  加上static = true标识
    ```
    - parseHTML
  + optimize - 获取到ast树后，vue做了一层静态标记优化。给一些不变的节点打上标记，提升后面patch diff的性能
* parseHTML
  + while循环 template 字符串 (有一个下标计数器)
  + 判断不能是 script, style这些标签，给出对应的警告信息
  + 通过正则，获取开始标签 < 的字符串位置
  + 通过正则，判断是否是注释节点，调用advance方法，重新记录index下标，跳过注释长度，截取去注释继续循环
  + 通过正则，判断是否是条件注释节点。因为我们可能在template中使用条件注释，针对ie做一些事件。同理，调用advance方法，将index下标，跳转到条件注释字符串的尾部，截取掉条件注释，继续循环。
  + 通过正则，判断是否是 Doctype 节点，同理，调用advance方法，将index下标跳转到 doctype 节点字符串尾部，截取掉 doctype, 继续循环。
  + 通过正则，判断是否是开始标签，将开始标签的内容提取出来，提取前后对比：
+ optimize --获取到ast树后，vue做了一层静态标记优化。给一些不变的节点打上标记，提升后面patch diff的性能
##### 总结
  * compiler是将template字符串转化为render函数的过程
  * 调用parse方法生成ast
    + 2.1 parseHTML通过正则动态匹配出标签的开始内容，标签内内容，标签结束内容
    + 2.2 不建议template中出现script, style标签，给出警告
    + 2.3 从index = 0开始，匹配开始标签内容，调用advance将index移动至前一次的字符串末尾位置，返回出对应的数据结构描述标签开始内容。另外调用parse的开始生命周期函数，生成对应的 ast
    + 2.4 分别处理 注释节点， 条件注释，Doctype节点，调用advance将index移动到特殊节点字符串的末尾
    + 2.5 while循环计算下一个字符串类型，匹配标签内容
    + 2.6 标签内容调用 parse生命周期的chars方法，生成对应的ast
    + 2.7 匹配结束标签，调用advance将index移动到对应字符串尾部，调用parse的end生命 周期方法，更新对应ast的end标识位
    + 2.8 如此往复调用，直到解析html字符串的最后。
  * 优化ast，给各个节点的ast打上静态标记，以及静态 根节点，以便patch过程做diff时，去除不必要的对比，提升性能。
  * 将ast的数据结构，递归遍历每个childrens，将其转化为对应的方法调用。
  * 返回render函数，将方法挂载至vm.$options上，等待后面执行到updateComponent时生成虚拟DOM

