### src
* compiler    编译相关
* core        核心代码
  + instance/state  初始化data, methods，props， watch， computed等方法
  + instance 向Vue实例对象注入方法：this.$emit(),this.$forceUpdate()等
  + global-api 向Vue对象注入全局方法：Vue.use()，Vue.extend()等
  + observer 实现data与Watch对象的依赖收集与更新
  + util 工具类
  + vdom Vdom有关方法
* platforms   不同平台的支持
* server      服务端渲染
* sfc         .vue 文件解析
* shared       共享代码

* Object.defineProperty(obj, props(添加newKey),get(),set())
* 发布订阅模式
```angular2html
<script>
  // 订阅者发布者
  class Event{
    constructor() {
      this.event = {}
    }
    on(target, callBack) {
      this.event[target] = callBack
    }
    emit(target, str) {
      this.event[target](str)
    }
    dele(target) {
      delete this.event[target]
    }
  }
  let event = new Event()
  // 订阅
  event.on('name', (name) => {
    console.log(name);
  })
  // 发布
  event.emit('name', '张三')
  // 取消
  event.dele('name')
</script>
```
* 订阅者模式
```javascript
<script>
    // 观察者模式
    class Event{
      constructor() {
        this.event = []
      }
      suberscript(target) {
        this.event.push(target)
      }
      unsuberscript(target) {
        this.event = this.event.filter(item => item !== target)
      }
      notify(target) {
        this.event.forEach(item => {
          item(target)
        })
      }
    }
    let event = new Event()
    // 被观测者，用于添加观测方法或对象
    event.suberscript(() => {
      console.log('beibei')
    });
    // 通知所有的观察者
    event.notify('name')
    // 移除观察者
    event.unsuberscript(() => {
      console.log('beibei')
    })
  </script>
```

### 那Vue里的订阅和发布是用的那种模式呢，答案是：===观察者模式===
* 1、设计一个被观测者，用于添加观测者，观测者可以处理发布的消息
    + 设计Dep类
* 2、 被观测对象通过Object.defineProperty进行包装，劫持get、set方法。
    + 既然被观测者是data，那么我们要劫持的对象也是data
* 3、设计一个观测者，用于处理发布更新后的操作，即订阅后的回调
* 4、观测时机：取值操作时，触发get用于添加观测者。赋值操作时，触发set通知观测者进行更新

##### 流程
* 首先initData()，获取Data返回的对象（也初始化methods，props， watch， computed等方法）
* observe(), 对整个Data进行监听,检查data对象是否已受观察（是否有__ob__属性）
  + 有则说明已受观察不做处理, 若无则设置观察者new Observer(value)
* new Observer()
  + 给data绑定一个__ob__属性，用来存放Observer实例，避免重复绑定
  + 如果data是Object, 遍历对象的每一个属性进行defineReactive绑定
  + 如果data是Array, 则需要对每一个成员进行observe。vue.js会重写Array的push、pop、shift、unshift、splice、sort、reverse这7个方法，保证之后pop/push等操作进去的对象也有进行双向绑定. (具体代码参见observer/array.js)
* defineReactive()方法主要通过Object.defineProperty()做了以下几件事:
  + 在闭包里定义一个Dep实例；
  + getter用来收集依赖，Dep.target是一个全局的属性，指向的那个watcher收集到dep里来（如果之前添加过就不会重复添加）；
  + setter是在更新value的时候通知所有getter时候通知所有收集的依赖进行更新（dep.notify）。这边会做一个判断，如果newVal和oldVal一样，就不会有操作
* Dep
  + Dep是一个发布者，可以订阅多个观察者，依赖收集之后Dep中会有一个subs存放一个或多个观察者，在数据变更的时候通知所有的watcher。
  + Dep和Observer的关系就是Observer监听整个data，遍历data的每个属性给每个属性绑定defineReactive方法劫持getter和setter, 在getter的时候往Dep类里塞依赖（dep.depend），在setter的时候通知所有watcher进行update(dep.notify)
* Watcher 接受到通知之后，会通过回调函数进行更新。
  + dep.depend()的时候往dep里添加自己；
  + dep.notify()的时候调用watcher.update()方法，对视图进行更新；
  要注意的是，watcher中有个sync属性，绝大多数情况下，watcher并不是同步更新的，而是采用异步更新的方式，也就是调用queueWatcher(this)推送到观察者队列当中，待nextTick的时候进行调用
