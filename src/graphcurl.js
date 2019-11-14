const fs = require('fs')
const { inspect } = require('util')
const gql = require('graphql-tag')
const options = require('commander')
const { getMainDefinition } = require('apollo-utilities')

const { createClient } = require('./apollo-client')
const { loadQuery } = require('./import-graphql').register({ gqlTag: gql })
const { createLogger } = require('./logging')
const { readJson, readYaml, writeJson, STDIN, STDOUT } = require('./process-files')

let log

const fail = (error, exitcode = 1) => {
  if (log) log.error(error, ...(typeof error === 'string' ? [] : [error]))
  process.exit(exitcode)
}

try {
  const append = (value, list) => [...list, value]

  options
    .version('0.3.0')
    .usage('[options]')
    .requiredOption('-e, --endpoint <url>', 'graphql endpoint')
    .option('-k, --key <key>', 'output only selected key from response data')
    .option('-o, --output <file>', 'write response data to json file instead of stdout')
    .requiredOption('-q, --query <query|@file|->', 'graphql query (or mutation), may use #import')
    .option('-d, --data <variable:value|@file|->', 'query variables, file may be json or yaml', append, [])
    .option('-H, --header <header:value|@file|->', 'custom headers, file may be json or yaml', append, [])
    .option('-v, --verbose', 'output more details')
    .option('-D, --debug', 'output debug data')
    .parse(process.argv)

  log = createLogger({ name: options.name(), info: options.verbose, debug: options.debug })
  const usage = error => fail(`Invalid usage (try --help): ${error}`, 2)
  const isStdIn = input => input === '-' || input === '@' || input === '@-'
  const isStdOut = output => !output || output === '-'
  const isInputFile = input => input === '-' || input.startsWith('@')
  const getInputFile = input => (isStdIn(input) ? STDIN : input.substring(1))
  const getOutputFile = output => (isStdOut(output) ? STDOUT : output)
  const tagWith = tag => input => tag`${input}`
  const readInput = (input, load, parse) =>
    input && (isInputFile(input) ? load(getInputFile(input)) : parse ? parse(input) : input)
  const writeFile = (data, output, opts = 'utf8') => fs.writeFileSync(output, data, opts)
  const writeOutput = (data, output, write) =>
    (write || (typeof data === 'string' ? writeFile : writeJson))(data, getOutputFile(output))
  const isYaml = file => typeof file === 'string' && (file.endsWith('.yaml') || file.endsWith('.yml'))
  const loadData = file => (isYaml(file) ? readYaml(file) : readJson(file))
  const ident = any => any
  const safe = (fn, fallback) => (...args) => {
    try {
      return fn(...args)
    } catch (e) {
      return fallback ? fallback(...args) : null
    }
  }
  const coerce = safe(JSON.parse, ident)
  const combine = objects => objects.reduce((c, o) => Object.assign(c, o), {})
  const parseData = (input, sep = ':') =>
    ((key, ...values) => ({ [key.trim()]: coerce(values.join(sep).trim()) }))(...input.split(sep))
  const operationType = op => getMainDefinition(op).operation
  const operations = { query: 'query', mutation: 'mutate' }

  log.debug('Options', options.opts())

  if (options.args.length) usage(`Unused arguments: ${args.join(' ')}`)
  if ([options.query, ...options.data, options.header].filter(isStdIn).length > 1)
    usage('At most one of --query, --data, --header options may read from <stdin>')

  const query = readInput(options.query, loadQuery, tagWith(gql)) || usage('Missing valid --query option')
  const data = combine(options.data.map(d => readInput(d, loadData, parseData) || {}))
  const headers = combine(options.header.map(h => readInput(h, loadData, parseData) || {}))

  log.debug('Query', {
    operation: query && query.definitions.map(d => `${d.kind} ${d.operation || 'fragment'} ${d.name && d.name.value}`),
    data,
    headers,
  })

  const type = operationType(query)
  const method = operations[type]

  if (!method) fail(`Invalid operation type '${type}'`)

  const graphql = createClient(options.endpoint, { log, headers })

  graphql[method]({
    [type]: query,
    variables: data,
  })
    .then(response => {
      if (!response || !response.data) fail(`Invalid response: ${inspect(response)}`)
      log.debug(`Response [key=${options.key ? inspect(options.key) : '*'}]`, response)
      writeOutput(options.key ? response.data[options.key] : response.data, options.output)
    })
    .catch(fail)
} catch (error) {
  fail(error)
}
