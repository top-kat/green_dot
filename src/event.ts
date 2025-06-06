
import { isset } from 'topkat-utils'
import { newSystemCtx } from './ctx.js'

export const event = {
    /**
     * @param priority the higher the prior
     */
    on<EventName extends keyof GDeventNames>(
        eventName: EventName,
        callback: (...params: GDeventNames[EventName]) => any,
        priority = 50
    ) {
        event.registeredEvents[eventName] ??= []
        event.registeredEvents[eventName].push([priority, callback])
        event.registeredEvents[eventName].sort(([priorityA], [priorityB]) => priorityA - priorityB)
    },
    /** unregister a callback from an event */
    off<EventName extends keyof GDeventNames>(
        eventName: EventName,
        callback: (...params: GDeventNames[EventName]) => any,
    ) {
        if (!isset(event.registeredEvents[eventName])) return
        const eventIndex = event.registeredEvents[eventName].findIndex(([, callback2]) => callback === callback2)
        if (eventIndex !== -1) {
            event.registeredEvents[eventName].splice(eventIndex, 1)
            return true
        } else return false
    },
    /** asynchronous error catchable event
     * will run all callbacks according to their priority
     * @param {array} paramsValidationArray
     * @returns {Object} metadata (will be passed as final argument of each event function to be modified by the different modules)
    */
    async emit<EventName extends keyof GDeventNames>(
        eventName: EventName,
        ...params: GDeventNames[EventName]
    ) {
        // TODO try catch in all events and message like plz use try catch in your events handlers
        const metadata = {}
        event.registeredEvents[eventName] ??= []
        for (const [, callback] of event.registeredEvents[eventName]) await callback(...params, metadata)
        return metadata
    },
    /** SYNCHRONOUS
    */
    emitSync<EventName extends keyof GDeventNames>(
        eventName: EventName,
        ...params: GDeventNames[EventName]
    ) {
        const metadata = {}
        event.registeredEvents[eventName] ??= []
        for (const [, callback] of event.registeredEvents[eventName]) callback(newSystemCtx(), ...params, metadata)
        return metadata
    },
    registeredEvents: {} as { [EventName: string]: Array<[priority: number, callback: Function]> },
}

export default event // @deprecated default