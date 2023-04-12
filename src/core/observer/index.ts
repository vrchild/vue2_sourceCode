import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
    def,
    warn,
    hasOwn,
    isArray,
    hasProto,
    isPlainObject,
    isPrimitive,
    isUndef,
    isValidArrayIndex,
    isServerRendering,
    hasChanged,
    noop
} from '../util/index'
import { isReadonly, isRef, TrackOpTypes, TriggerOpTypes } from '../../v3'
import { rawMap } from '../../v3/reactivity/reactive'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

const NO_INIITIAL_VALUE = {}

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
    shouldObserve = value
}

// ssr mock dep
const mockDep = {
    notify: noop,
    depend: noop,
    addSub: noop,
    removeSub: noop
} as Dep

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
    dep: Dep // 观察者的类, 每一个Data的属性都会绑定一个dep，用于存放watcher arr
    vmCount: number // number of vms that have this object as root $data

    constructor(public value: any, public shallow = false, public mock = false) {
        // this.value = value
        this.dep = mock ? mockDep : new Dep()
        this.vmCount = 0
        def(value, '__ob__', this) // 等同于value.__ob__ = this, 这个def的意思就是把Observer实例绑定到Data的__ob__属性上去
        if (isArray(value)) {
            // 如果是数组，将修改后可以截获响应的数组方法替换掉该数组的原型中的原生方法，达到监听数组数据变化响应的效果。
            if (!mock) {
                if (hasProto) {
                    /* eslint-disable no-proto */
                    ;(value as any).__proto__ = arrayMethods
                    /* eslint-enable no-proto */
                } else {
                    for (let i = 0, l = arrayKeys.length; i < l; i++) {
                        const key = arrayKeys[i]
                        def(value, key, arrayMethods[key])
                    }
                }
            }
            if (!shallow) {
                // 如果是数组则需要遍历数组的每一个成员进行observe
                this.observeArray(value)
            }
        } else {
            /**
             * Walk through all properties and convert them into
             * getter/setters. This method should only be called when
             * value type is Object.
             */
                // 如果是对象则直接defineReactive,劫持data的getter和setter
            const keys = Object.keys(value)
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]
                defineReactive(value, key, NO_INIITIAL_VALUE, undefined, shallow, mock)
            }
        }
    }

    /**
     * Observe a list of Array items.
     */
    observeArray(value: any[]) {
        for (let i = 0, l = value.length; i < l; i++) {
            observe(value[i], false, this.mock)
        }
    }
}

// helpers

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(
    value: any,
    shallow?: boolean,
    ssrMockReactivity?: boolean
): Observer | void {
    // 判断是否有__ob__观察者对象，
    // 这里用__ob__这个属性来判断是否已经有Observer实例，如果没有Observer实例则会新建一个Observer实例并赋值给__ob__这个属性，如果已有Observer实例则直接返回该Observer实例
    if (value && hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
        return value.__ob__
    }
    if (
        shouldObserve &&
        (ssrMockReactivity || !isServerRendering()) && // isServerRendering 不是服务器端渲染
        (isArray(value) || isPlainObject(value)) && // data必须是Array 或者 Object
        Object.isExtensible(value) && // data对象必须是可扩展的（可以额外添加属性）
        !value.__v_skip /* ReactiveFlags.SKIP */ &&
        !rawMap.has(value) &&
        !isRef(value) &&
        !(value instanceof VNode)
    ) {
        // 为数据对象添加ob属性，而这个属性就是一个Observer对象的实例
        // 创建一个Observer实例，绑定data进行监听
        return new Observer(value, shallow, ssrMockReactivity)
    }
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive(
    obj: object,
    key: string,
    val?: any,
    customSetter?: Function | null,
    shallow?: boolean,
    mock?: boolean
) {
    // 在闭包中定义一个dep对象
    const dep = new Dep()

    const property = Object.getOwnPropertyDescriptor(obj, key)
    if (property && property.configurable === false) {
        return
    }

    // cater for pre-defined getter/setters
    // 如果之前该对象已经预设了getter以及setter函数则将其取出来，新定义的getter/setter中会将其执行，保证不会覆盖之前已经定义的getter/setter。
    const getter = property && property.get
    const setter = property && property.set
    if (
        (!getter || setter) &&
        (val === NO_INIITIAL_VALUE || arguments.length === 2)
    ) {
        val = obj[key]
    }

    // 对象的子对象也会进行observe
    let childOb = !shallow && observe(val, false, mock)
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            // 如果原本对象拥有getter方法则执行
            const value = getter ? getter.call(obj) : val
            // Dep.target：全局属性，用于指向某一个watcher，用完即丢
            if (Dep.target) {
                if (__DEV__) {
                    dep.depend({
                        target: obj,
                        type: TrackOpTypes.GET,
                        key
                    })
                } else {
                    // 进行依赖收集 dep.depend()内部实现addDep，往dep中添加watcher实例  depend的时候会根据id判断watcher有没有添加过，避免重复添加依赖
                    dep.depend()
                }
                if (childOb) {
                    childOb.dep.depend()
                    if (isArray(value)) {
                        dependArray(value)
                    }
                }
            }
            return isRef(value) && !shallow ? value.value : value
        },
        set: function reactiveSetter(newVal) {
            const value = getter ? getter.call(obj) : val
            if (!hasChanged(value, newVal)) {
                return
            }
            if (__DEV__ && customSetter) {
                customSetter()
            }
            if (setter) {
                setter.call(obj, newVal)
            } else if (getter) {
                // #7981: for accessor properties without setter
                return
            } else if (!shallow && isRef(value) && !isRef(newVal)) {
                value.value = newVal
                return
            } else {
                val = newVal
            }
            childOb = !shallow && observe(newVal, false, mock)
            if (__DEV__) {
                dep.notify({
                    type: TriggerOpTypes.SET,
                    target: obj,
                    key,
                    newValue: newVal,
                    oldValue: value
                })
            } else {
                dep.notify()
            }
        }
    })

    return dep
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set<T>(array: T[], key: number, value: T): T
export function set<T>(object: object, key: string | number, value: T): T
export function set(
    target: any[] | Record<string, any>,
    key: any,
    val: any
): any {
    if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
        warn(
            `Cannot set reactive property on undefined, null, or primitive value: ${target}`
        )
    }
    if (isReadonly(target)) {
        __DEV__ && warn(`Set operation on key "${key}" failed: target is readonly.`)
        return
    }
    const ob = (target as any).__ob__
    if (isArray(target) && isValidArrayIndex(key)) {
        target.length = Math.max(target.length, key)
        target.splice(key, 1, val)
        // when mocking for SSR, array methods are not hijacked
        if (ob && !ob.shallow && ob.mock) {
            observe(val, false, true)
        }
        return val
    }
    if (key in target && !(key in Object.prototype)) {
        target[key] = val
        return val
    }
    if ((target as any)._isVue || (ob && ob.vmCount)) {
        __DEV__ &&
        warn(
            'Avoid adding reactive properties to a Vue instance or its root $data ' +
            'at runtime - declare it upfront in the data option.'
        )
        return val
    }
    if (!ob) {
        target[key] = val
        return val
    }
    defineReactive(ob.value, key, val, undefined, ob.shallow, ob.mock)
    if (__DEV__) {
        ob.dep.notify({
            type: TriggerOpTypes.ADD,
            target: target,
            key,
            newValue: val,
            oldValue: undefined
        })
    } else {
        ob.dep.notify()
    }
    return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del<T>(array: T[], key: number): void
export function del(object: object, key: string | number): void
export function del(target: any[] | object, key: any) {
    if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
        warn(
            `Cannot delete reactive property on undefined, null, or primitive value: ${target}`
        )
    }
    if (isArray(target) && isValidArrayIndex(key)) {
        target.splice(key, 1)
        return
    }
    const ob = (target as any).__ob__
    if ((target as any)._isVue || (ob && ob.vmCount)) {
        __DEV__ &&
        warn(
            'Avoid deleting properties on a Vue instance or its root $data ' +
            '- just set it to null.'
        )
        return
    }
    if (isReadonly(target)) {
        __DEV__ &&
        warn(`Delete operation on key "${key}" failed: target is readonly.`)
        return
    }
    if (!hasOwn(target, key)) {
        return
    }
    delete target[key]
    if (!ob) {
        return
    }
    if (__DEV__) {
        ob.dep.notify({
            type: TriggerOpTypes.DELETE,
            target: target,
            key
        })
    } else {
        ob.dep.notify()
    }
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i]
        if (e && e.__ob__) {
            e.__ob__.dep.depend()
        }
        if (isArray(e)) {
            dependArray(e)
        }
    }
}
