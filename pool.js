const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const WORKER = path.join(__dirname, 'worker.php')

const settings = {
  enabled: true,

  // one worker is enough while every page is about the same size, and is not enough as soon as one of them is not: a heavy page holds its worker for as long as it takes, and every page behind it waits. four is where the throughput of a mixed workload stops improving much, and each one is a php process worth about 24 MB, so this does not go higher on its own
  size: Math.min(4, Math.max(1, os.cpus().length)),

  // php checks whether a template has changed on disk before reusing its compiled form. leaving that on is what makes an edit to a template show up on the next render, and turning it off is faster but means a restart is needed before an edit is picked up
  validateTimestamps: true,

  // whether to send a template only the parts of the model it reads. the model has to reach php as JSON, so this is the difference between paying for the model a page uses and paying for the whole of whatever the app happened to pass
  trimModel: true,

  // php's command line runtime has no memory limit of its own, so a template that runs away — one that includes itself, say — would take the machine down with it rather than failing the render it belongs to. with a limit, php stops that render, the worker dies, and node reports it and starts another. set it to '-1' to go back to no limit
  memoryLimit: '256M'
}

// what each template was found to read, as reported by a worker, along with the files that answer came from and what they looked like at the time
//
// this is kept here rather than in a worker because there is more than one worker: an answer left with whichever one happened to work it out is an answer the next request probably will not reach
const reads = new Map()

// what the files behind an analysis look like now, so an edit can be noticed before a template is sent less than it needs. an edit changes what a template reads, and the old answer would leave the new part out
function stamp (files) {
  let out = ''
  for (const file of files) {
    try {
      const info = fs.statSync(file)
      out += file + ':' + info.mtimeMs + ':' + info.size + '\n'
    } catch (e) {
      out += file + ':gone\n'
    }
  }
  return out
}

// what a template reads, or undefined when that is not known or no longer trustworthy
function knownReads (template) {
  const known = reads.get(template)
  if (!known) return undefined
  // php stops looking at the files when it is told templates will not change, and so does this
  if (settings.validateTimestamps && stamp(known.files) !== known.stamp) {
    reads.delete(template)
    return undefined
  }
  return known.reads
}

let pool = []
let next = 0

// one php process, and everything needed to talk to it
//
// requests are answered in the order they were sent, so the pending list is a queue rather than a map: there is no request id to match on and none is needed
function createWorker () {
  const args = [
    // the cli runtime ships with its opcode cache switched off, so a process that did not ask for it would recompile every template on every render and throw away most of the reason to stay alive
    '-d', 'opcache.enable_cli=1',
    '-d', `opcache.validate_timestamps=${settings.validateTimestamps ? 1 : 0}`,

    // php only rechecks a template's timestamp every couple of seconds by default, so without this an edit could take that long to show up rather than appearing on the next render
    '-d', 'opcache.revalidate_freq=0',
    '-d', `memory_limit=${settings.memoryLimit}`,
    WORKER
  ]

  const worker = {
    child: spawn('php', args, { stdio: ['pipe', 'pipe', 'inherit'] }),
    pending: [],
    buffer: Buffer.alloc(0),
    expecting: null,
    expectingMeta: 0,
    status: null
  }

  worker.child.stdout.on('data', chunk => {
    worker.buffer = Buffer.concat([worker.buffer, chunk])
    read(worker)
  })

  // a template can still bring php down in ways it cannot catch, and the process can be killed from outside, so whatever was in flight has to be told rather than left waiting forever
  worker.child.on('exit', (code, signal) => {
    const reason = signal ? `was killed by ${signal}` : `exited with code ${code}`
    for (const request of worker.pending.splice(0)) {
      request.reject(new Error(`PHP worker process ${reason} while rendering "${request.template}"`))
    }
    pool = pool.filter(entry => entry !== worker)
  })

  worker.child.on('error', error => {
    for (const request of worker.pending.splice(0)) request.reject(error)
    pool = pool.filter(entry => entry !== worker)
  })

  // an idle worker should not be a reason for node to stay running
  worker.child.unref()
  worker.child.stdin.unref()
  worker.child.stdout.unref()

  return worker
}

// pulls whole responses out of whatever has arrived so far
function read (worker) {
  for (;;) {
    if (worker.expecting === null) {
      const newline = worker.buffer.indexOf(10)
      if (newline === -1) return
      const header = worker.buffer.subarray(0, newline).toString().split(' ')
      worker.status = header[0]
      worker.expecting = parseInt(header[1], 10)
      worker.expectingMeta = parseInt(header[2], 10)
      worker.buffer = worker.buffer.subarray(newline + 1)
    }
    if (worker.buffer.length < worker.expecting + worker.expectingMeta) return

    const body = worker.buffer.subarray(0, worker.expecting).toString()
    const meta = JSON.parse(worker.buffer.subarray(worker.expecting, worker.expecting + worker.expectingMeta).toString() || '{}')
    worker.buffer = worker.buffer.subarray(worker.expecting + worker.expectingMeta)
    worker.expecting = null

    const request = worker.pending.shift()
    if (!request) continue // a reply to a request nobody is waiting for, which should not happen
    if (!worker.pending.length) idle(worker)
    settle(request, worker.status, body, meta)
  }
}

// hands one reply back to whoever asked for it
//
// a worker answers "stale" when it was sent a trimmed model it can no longer vouch for, which means the template changed or this worker never analyzed it. the render is done again with the whole model, which is always correct, and the worker says afresh what the template reads
function settle (request, status, body, meta) {
  if (meta && 'reads' in meta) {
    reads.set(request.template, { reads: meta.reads, files: meta.files, stamp: stamp(meta.files) })
  }
  if (status === 'ok') request.resolve(body)
  else request.reject(new Error(body))
}

// only the parts of a model a template was found to read
function trim (model, keys) {
  const trimmed = {}
  for (const key of keys) {
    if (key in model) trimmed[key] = model[key]
  }
  return trimmed
}

// node should wait for a render that is still running, and should not wait for one that is not
function busy (worker) {
  worker.child.ref()
  worker.child.stdout.ref()
}

function idle (worker) {
  worker.child.unref()
  worker.child.stdout.unref()
}

function ensurePool () {
  while (pool.length < settings.size) pool.push(createWorker())
  return pool
}

// renders one template on the next worker in turn
//
// the first render of a template sends the whole model and asks the worker what the template reads. after that only those parts are sent, which is most of what makes this faster than the first render: the model has to be written as JSON here and read back as JSON there, and neither cost has anything to do with how much of it the page actually uses
function render (template, model, viewsPath, registerGlobalModel) {
  const workers = ensurePool()
  const worker = workers[next++ % workers.length]
  const known = settings.trimModel ? knownReads(template) : undefined
  // a list when the template was analyzed, null when it was analyzed and can reach a name that cannot be known ahead of time, and undefined when it has not been analyzed yet
  const analyze = settings.trimModel && known === undefined

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      template,
      model: Array.isArray(known) ? trim(model, known) : model,
      viewsPath,
      registerGlobalModel,
      analyze
    })
    worker.pending.push({ resolve, reject, template })
    busy(worker)
    worker.child.stdin.write(Buffer.byteLength(payload) + '\n' + payload)
  })
}

// stops every worker, which an app only needs to do if it wants php gone before it exits
function shutdown () {
  for (const worker of pool.splice(0)) worker.child.stdin.end()
  // what a worker learned about a template went with it
  reads.clear()
}

function configure (options = {}) {
  if (typeof options.enabled === 'boolean') settings.enabled = options.enabled
  if (typeof options.size === 'number') settings.size = Math.max(1, Math.floor(options.size))
  if (typeof options.validateTimestamps === 'boolean') settings.validateTimestamps = options.validateTimestamps
  if (typeof options.trimModel === 'boolean') settings.trimModel = options.trimModel
  if (typeof options.memoryLimit === 'string') settings.memoryLimit = options.memoryLimit

  // anything already running was started under the old settings
  shutdown()
}

module.exports = { render, shutdown, configure, settings }
