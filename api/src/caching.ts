import { Db } from 'mongodb'
import config from './config'
import { RequestContext } from './types'

type DynamicComputeCall = (context: RequestContext, ...args: any[]) => Promise<any>

type ArgumentTypes<F> = F extends (context: RequestContext, ...args: infer A) => Promise<any>
    ? A
    : never

type ResultType<F> = F extends (...args: any[]) => infer P
    ? P extends Promise<infer R>
        ? R
        : never
    : never

/**
 * Compute a cache key from a function and its arguments,
 * the function should have a name in order to generate a proper key.
 */
export const computeKey = (func: Function, args?: any) => {
    const serializedArgs = args
        ? args
              .map((a: any) => {
                  return typeof a === 'function' ? a.name : JSON.stringify(a)
              })
              .join(', ')
        : ''

    if (func.name === '') {
        // enforce regular function usage over arrow functions, to have a proper cache key
        // console.trace is used to be able to know where the call comes from
        console.trace(
            `found a function without name, please consider using a regular function instead of an arrow function to solve this issue as it can lead to cache mismatch`
        )
    }

    return `${func.name}(${serializedArgs})`
}

/**
 * Cache results in a dedicated mongo collection to improve performance,
 * if the result isn't already available in the collection, it will be created.
 */
export const useCache = async <F extends DynamicComputeCall>(
    func: F,
    context: RequestContext,
    args: ArgumentTypes<F>
): Promise<ResultType<F>> => {
    const key = computeKey(func, args)
    const { db, isDebug = false } = context
    const collection = db.collection(config.mongo.cache_collection)
    const existingResult = await collection.findOne({ key })

    const useCache = !process.env.DISABLE_CACHE && !isDebug

    if (existingResult && useCache) {
        console.log(`> using result from cache for: ${key}`)
        return existingResult.value
    } else {
        const value = await func(context, ...(args || []))

        if (isDebug) {
            console.log(`> fetching result for: ${key} (isDebug = true)`)
        } else if (process.env.DISABLE_CACHE) {
            console.log(`> fetching result for: ${key} (DISABLE_CACHE = true)`)
        } else {
            console.log(`> fetching and caching result for: ${key}`)
            // in case previous cached entry exists, delete it
            await collection.deleteOne({ key })
            await collection.insertOne({ key, value })
        }

        return value
    }
}

export const clearCache = async (db: Db) => {
    const collection = db.collection(config.mongo.cache_collection)
    const result = await collection.deleteMany({})
    return result
}
