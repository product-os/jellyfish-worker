# Jellyfish Worker

Jellyfish workers are in charge of consuming action requests from the queue,
executing them, and reporting back the results. This module provides an lower
level interface to write a worker server. The intention is that we can write
multiple types of workers, optimised for different tasks using a single shared
framework.

# Usage

Below is an example how to use this library:

```js
const Worker = require('@balena/jellyfish-worker')

const worker = new Worker(jellyfish, jellyfish.sessions.admin, actionLibrary, consumer)
await worker.initialize(context)

const id = worker.getId()
console.log(`Worker ID: ${worker.getId()}`)
```

# Documentation

Jellyfish worker library module.


* [worker](#module_worker)
    * [.Worker](#module_worker.Worker)
        * [new exports.Worker(jellyfish, session, actionLibrary, consumer, producer)](#new_module_worker.Worker_new)
        * [.getId()](#module_worker.Worker+getId) ⇒ <code>String</code>
        * [.initialize(context)](#module_worker.Worker+initialize)
        * [.insertCard(context, insertSession, typeCard, options, card)](#module_worker.Worker+insertCard) ⇒ <code>Object</code>
        * [.patchCard(context, insertSession, typeCard, options, card, patch)](#module_worker.Worker+patchCard) ⇒ <code>Object</code>
        * [.replaceCard(context, insertSession, typeCard, options, card)](#module_worker.Worker+replaceCard) ⇒ <code>Object</code>
        * [.setTriggers(context, objects)](#module_worker.Worker+setTriggers)
        * [.upsertTrigger(context, card)](#module_worker.Worker+upsertTrigger)
        * [.removeTrigger(context, slug)](#module_worker.Worker+removeTrigger)
        * [.getTriggers()](#module_worker.Worker+getTriggers) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.pre(session, request)](#module_worker.Worker+pre) ⇒ <code>Object</code> \| <code>Undefined</code>
        * [.execute(session, request)](#module_worker.Worker+execute) ⇒ <code>Object</code>
        * [.tick(context, session, options)](#module_worker.Worker+tick)

<a name="module_worker.Worker"></a>

### worker.Worker
**Kind**: static class of [<code>worker</code>](#module_worker)  
**Summary**: The Jellyfish Actions Worker  
**Access**: public  

* [.Worker](#module_worker.Worker)
    * [new exports.Worker(jellyfish, session, actionLibrary, consumer, producer)](#new_module_worker.Worker_new)
    * [.getId()](#module_worker.Worker+getId) ⇒ <code>String</code>
    * [.initialize(context)](#module_worker.Worker+initialize)
    * [.insertCard(context, insertSession, typeCard, options, card)](#module_worker.Worker+insertCard) ⇒ <code>Object</code>
    * [.patchCard(context, insertSession, typeCard, options, card, patch)](#module_worker.Worker+patchCard) ⇒ <code>Object</code>
    * [.replaceCard(context, insertSession, typeCard, options, card)](#module_worker.Worker+replaceCard) ⇒ <code>Object</code>
    * [.setTriggers(context, objects)](#module_worker.Worker+setTriggers)
    * [.upsertTrigger(context, card)](#module_worker.Worker+upsertTrigger)
    * [.removeTrigger(context, slug)](#module_worker.Worker+removeTrigger)
    * [.getTriggers()](#module_worker.Worker+getTriggers) ⇒ <code>Array.&lt;Object&gt;</code>
    * [.pre(session, request)](#module_worker.Worker+pre) ⇒ <code>Object</code> \| <code>Undefined</code>
    * [.execute(session, request)](#module_worker.Worker+execute) ⇒ <code>Object</code>
    * [.tick(context, session, options)](#module_worker.Worker+tick)

<a name="new_module_worker.Worker_new"></a>

#### new exports.Worker(jellyfish, session, actionLibrary, consumer, producer)

| Param | Type | Description |
| --- | --- | --- |
| jellyfish | <code>Object</code> | jellyfish instance |
| session | <code>String</code> | worker privileged session id |
| actionLibrary | <code>Object</code> | action library |
| consumer | <code>Object</code> | action consumer |
| producer | <code>Object</code> | action producer |

**Example**  
```js
const worker = new Worker({ ... }, '4a962ad9-20b5-4dd8-a707-bf819593cc84', {
    'action-create-card': { ... },
    'action-update-card': { ... },
  },
  consumer,
  producer
)
```
<a name="module_worker.Worker+getId"></a>

#### worker.getId() ⇒ <code>String</code>
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Get this worker's unique id  
**Returns**: <code>String</code> - unique worker id  
**Access**: public  
**Example**  
```js
const worker = new Worker({ ... })
const id = worker.getId()
console.log(id)
```
<a name="module_worker.Worker+initialize"></a>

#### worker.initialize(context)
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Initialize the worker  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |

**Example**  
```js
const worker = new Worker({ ... })
await worker.initialize(context)
```
<a name="module_worker.Worker+insertCard"></a>

#### worker.insertCard(context, insertSession, typeCard, options, card) ⇒ <code>Object</code>
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Insert a card  
**Returns**: <code>Object</code> - inserted card  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| insertSession | <code>String</code> | The Jellyfish session to insert the card with |
| typeCard | <code>Object</code> | The type card for the card that will be inserted |
| options | <code>Object</code> | options |
| [options.timestamp] | <code>Date</code> | Upsert timestamp |
| card | <code>Object</code> | The card that should be inserted |

<a name="module_worker.Worker+patchCard"></a>

#### worker.patchCard(context, insertSession, typeCard, options, card, patch) ⇒ <code>Object</code>
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Patch a card  
**Returns**: <code>Object</code> - inserted card  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| insertSession | <code>String</code> | The Jellyfish session to insert the card with |
| typeCard | <code>Object</code> | The type card for the card that will be inserted |
| options | <code>Object</code> | options |
| [options.timestamp] | <code>Date</code> | Upsert timestamp |
| card | <code>Object</code> | The card that should be inserted |
| patch | <code>Array.&lt;Object&gt;</code> | JSON Patch |

<a name="module_worker.Worker+replaceCard"></a>

#### worker.replaceCard(context, insertSession, typeCard, options, card) ⇒ <code>Object</code>
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Replace a card  
**Returns**: <code>Object</code> - replaced card  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| insertSession | <code>String</code> | The Jellyfish session to insert the card with |
| typeCard | <code>Object</code> | The type card for the card that will be inserted |
| options | <code>Object</code> | options |
| [options.timestamp] | <code>Date</code> | Upsert timestamp |
| card | <code>Object</code> | The card that should be inserted |

<a name="module_worker.Worker+setTriggers"></a>

#### worker.setTriggers(context, objects)
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Set all registered triggers  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| objects | <code>Array.&lt;Object&gt;</code> | triggers |

**Example**  
```js
const worker = new Worker({ ... })
worker.setTriggers([ ... ])
```
<a name="module_worker.Worker+upsertTrigger"></a>

#### worker.upsertTrigger(context, card)
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Upsert a single registered trigger  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| card | <code>Object</code> | trigger card |

**Example**  
```js
const worker = new Worker({ ... })
worker.upsertTrigger({ ... })
```
<a name="module_worker.Worker+removeTrigger"></a>

#### worker.removeTrigger(context, slug)
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Remove a single registered trigger  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| slug | <code>Object</code> | slug of trigger card |

**Example**  
```js
const worker = new Worker({ ... })
worker.removeTrigger('trigger-ed3c21f2-fa5e-4cdf-b862-392a2697abe4')
```
<a name="module_worker.Worker+getTriggers"></a>

#### worker.getTriggers() ⇒ <code>Array.&lt;Object&gt;</code>
**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Get all registered triggers  
**Returns**: <code>Array.&lt;Object&gt;</code> - triggers  
**Access**: public  
**Example**  
```js
const worker = new Worker({ ... })
const triggers = worker.getTriggers()
console.log(triggers.length)
```
<a name="module_worker.Worker+pre"></a>

#### worker.pre(session, request) ⇒ <code>Object</code> \| <code>Undefined</code>
The "pre" hook of an action request is meant to run before
the action request is enqueued. The hook may return a
modified set of arguments.

**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Execute the "pre" hook of an action request  
**Returns**: <code>Object</code> \| <code>Undefined</code> - request arguments  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| session | <code>String</code> | session id |
| request | <code>Object</code> | action request options |

<a name="module_worker.Worker+execute"></a>

#### worker.execute(session, request) ⇒ <code>Object</code>
You still need to make sure to post the execution event
upon completion.

**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Execute an action request  
**Returns**: <code>Object</code> - action result  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| session | <code>String</code> | session id |
| request | <code>Object</code> | request |
| request.actor | <code>String</code> | actor id |
| request.action | <code>Object</code> | action card |
| request.timestamp | <code>String</code> | action timestamp |
| request.card | <code>String</code> | action input card id |
| request.arguments | <code>Object</code> | action arguments |
| [request.originator] | <code>String</code> | action originator card id] |

**Example**  
```js
const worker = new Worker({ ... })
const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84'
const result = await worker.execute(jellyfish, session, { ... })
console.log(result.error)
console.log(result.data)
```
<a name="module_worker.Worker+tick"></a>

#### worker.tick(context, session, options)
A tick is necessary to dispatch time-triggered actions and potentially
any other logic that depends on the concept of time.

Applications should "tick" on a certain interval. Shorter intervals
increase the accuracy of time-related actions, but introduces more
overhead.

The tick operation may enqueue new actions but will not execute them
right away.

**Kind**: instance method of [<code>Worker</code>](#module_worker.Worker)  
**Summary**: Execute a worker tick  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | execution context |
| session | <code>String</code> | session id |
| options | <code>Object</code> | options |
| options.currentDate | <code>Date</code> | current date |

**Example**  
```js
const worker = new Worker({ ... })
const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84'

await worker.tick({ ... }, session, {
  currentDate: new Date()
})
```
