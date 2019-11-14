const fs = require('fs')
const path = require('path')
const yaml = require('yamljs')

const STDIN = 0 // Posix stdin fd 0
const STDOUT = 1 // Posix stdout fd 1

const defaults = 'utf8'
const eolRegex = /\r?\n/

const friendlyName = name => {
  switch (name) {
    case '':
      return '<none>'
    case STDIN:
      return '<stdin>'
    case STDOUT:
      return '<stdout>'
    default:
      return name
  }
}

const pathWithoutExt = (name, ext) =>
  name && (ext || (ext = path.extname(name))) ? name.substr(0, name.length - ext.length) : name

const parseJsonLine = (line, index) => {
  try {
    line = line.trim()
    return line ? JSON.parse(line) : null
  } catch (error) {
    error.line = line
    error.lineIndex = index
    throw error
  }
}

const readJson = (file = STDIN, options = defaults) => JSON.parse(fs.readFileSync(file, options))

readJson.format = 'json'

const readJsonLines = (file = STDIN, options = defaults) =>
  // TODO: use readline module with async generator: https://github.com/tc39/proposal-async-iteration
  fs
    .readFileSync(file, options)
    .split(eolRegex)
    .map(parseJsonLine)
    .filter(l => l != null)

readJsonLines.format = 'jsonlines'

const readYaml = (file = STDIN, options = defaults) => yaml.parse(fs.readFileSync(file, options))

readYaml.format = 'yaml'

const Readers = {
  json: readJson,
  jsonlines: readJsonLines,
  yaml: readYaml,
  yml: readYaml,
  default: readJson,
}

const writeNone = data => data

writeNone.isNone = true
writeNone.format = 'none'

const writeJson = (data, file = STDOUT, options = defaults) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2), options) || data

writeJson.format = 'json'

const writeYaml = (data, file = STDOUT, options = defaults) =>
  fs.writeFileSync(file, yaml.stringify(data, 100, 2), options) || data

writeYaml.format = 'yaml'

const Writers = {
  none: writeNone,
  json: writeJson,
  yaml: writeYaml,
  yml: writeYaml,
  default: writeJson,
}

const processFiles = (files, processData, options) => {
  const { inputFormat, outputFormat, noStdInDefault, isAsync, exit, log } = options

  const done = result => {
    if (log) log.info('done')
    if (exit) process.exit()
    return result
  }

  const fail = _e => {
    if (exit) process.exit(1)
  }

  // Use stdin if no file names are provided
  if (!files.length && noStdInDefault) return isAsync ? Promise.resolve(done()) : done()
  if (!files.length) files = [STDIN]

  // Use selected, or default input format
  const readers = options.readers || (options.readers = Readers)
  if (!options.reader) options.reader = readers[inputFormat] || readers.default

  // Use same, or default format for output
  const writers = options.writers || (options.writers = Writers)
  if (!options.writer) options.writer = writers[outputFormat] || writers[inputFormat] || writers.default

  try {
    const results = files.map(file => processFile(file, processData, options))
    return isAsync
      ? Promise.all(results)
          .then(done)
          .catch(fail)
      : done(results)
  } catch (e) {
    fail(e)
  }
}

const processFile = (file, processData, options) => {
  const { reader, writer, outputSuffix, noStdIn, isAsync, log } = options

  // Use stdin when '-' is provided instead of a file name
  const input = noStdIn || file !== '-' ? file : STDIN

  // Use stdout for input from stdin
  const output = writer.isNone
    ? ''
    : input === STDIN
    ? STDOUT
    : `${pathWithoutExt(input)}${outputSuffix}${writer.extension || `.${writer.format}`}`

  const label =
    log && `${friendlyName(input)} [${reader.format}]${output && ` => ${friendlyName(output)} [${writer.format}]`}`

  if (log) log.info(`init ${label}`)

  const done = result => {
    if (log) log.info(`done ${friendlyName(input)}`)
    return result
  }

  const fail = e => {
    if (log)
      log.error(
        `fail ${friendlyName(input)}${
          e.lineIndex == null ? '' : ` on line ${e.lineIndex} [${(e.line && e.line.length) || 0}]`
        }:${e.line == null ? '' : `\n${e.line}\n`}`,
        e,
      )
    throw e
  }

  try {
    return isAsync
      ? processData(reader(input), options)
          .then(data => done(writer(data, output)))
          .catch(fail)
      : done(writer(processData(reader(input), options), output))
  } catch (e) {
    fail(e)
  }
}

module.exports = {
  STDIN,
  STDOUT,
  friendlyName,
  pathWithoutExt,
  parseJsonLine,
  readJson,
  readJsonLines,
  readYaml,
  writeJson,
  writeYaml,
  processFiles,
}
