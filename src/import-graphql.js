const fs = require('fs')
const path = require('path')

const STDIN = 0 // Posix stdin fd 0

const defaults = 'utf8'
const eolRegex = /\r?\n/g
const importRegex = /^\s*#?import\s*(["'])([\\\/A-Za-z0-9.$_+-]+)\1\s*$/gm

const extensions = ['.graphql', '.gql']
const transforms = { default: content => content }

const basepath = file => (typeof file === 'string' ? path.dirname(file) : '.')

const transformer = file => (typeof file === 'string' && transforms[path.extname(file)]) || transforms.default

const readQuery = (file = STDIN, options = defaults) =>
  fs
    .readFileSync(file, options)
    .replace(eolRegex, '\n')
    .replace(importRegex, (_stmt, _quote, ref) => readQuery(path.resolve(basepath(file), ref), options))

const loadQuery = (file = STDIN, options = defaults) => transformer(file)(readQuery(file, options))

const requireQuery = (module, file) => Object.assign(module, { exports: loadQuery(file) })

const registerQueryExtension = (ext, transform = x => x) => {
  transforms[ext] = transform
  require.extensions[ext] = requireQuery
}

const register = options => {
  const { gqlTag, transform, extensions: exts } = { extensions, ...options }
  const gqlTransform = gqlTag && (content => gqlTag`${content}`)

  transforms.default = gqlTransform || transform || transforms.default

  exts.map(ext => registerQueryExtension(ext, gqlTransform || transform))

  return module.exports
}

module.exports = {
  register,
  loadQuery,
  readQuery,
  requireQuery,
  registerQueryExtension,
}
