const { inspect } = require('util')
const winston = require('winston')

const {
  format: { combine, colorize, label, logstash, ms, printf, timestamp },
} = winston

const createLogger = ({ name, level, info, debug, file, console }) => {
  if (!level) level = debug ? 'debug' : info ? 'info' : 'warn'

  const transports = []
  const format = printf(
    m =>
      `[${m.label}] ${m.level} (${m.ms}): ${m.message} ${(m[Symbol.for('splat')] || [])
        .map(a => inspect(a, { colors: true }))
        .join(' ')}`,
  )

  if (console !== false)
    transports.push(
      new winston.transports.Console({
        format: combine(label({ label: name }), ms(), colorize(), format),
        ...console,
      }),
    )

  if (file !== false && (file || name))
    transports.push(
      new winston.transports.File({
        format: combine(ms(), timestamp(), logstash()),
        filename: `${name}.log`,
        ...file,
      }),
    )

  const log = winston.createLogger({ level, transports })

  if (console !== false || (file !== false && (file || name))) {
    log.debug(
      `Logging to ${[console !== false && 'console', file !== false && (file || `${name}.log`)]
        .filter(s => s)
        .join(' and ')}`,
    )
  }

  return log
}

module.exports = {
  createLogger,
}
