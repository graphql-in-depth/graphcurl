const { inspect } = require('util')
const { ApolloClient } = require('apollo-client')
const { ApolloLink } = require('apollo-link')
const { onError } = require('apollo-link-error')
const { setContext } = require('apollo-link-context')
const { WebSocketLink } = require('apollo-link-ws')
const { createHttpLink } = require('apollo-link-http')
const { InMemoryCache } = require('apollo-cache-inmemory')
const { getMainDefinition } = require('apollo-utilities')

// ApolloClient needs fetch
if (!global.fetch) global.fetch = require('node-fetch')

const getErrorMessage = ({ graphQLErrors, networkError, operation }) =>
  `GraphQL Error${networkError && networkError.statusCode ? ` (${networkError.statusCode}): ` : ': '}${networkError &&
    networkError.message.replace(/\.$/, '')}${
    graphQLErrors && graphQLErrors.length ? `:\n${graphQLErrors.map(({ message }) => message).join('\n')}` : ''
  }${operation ? `\n@ ${operation.operationName}` : ''}${
    operation && operation.variables && Object.keys(operation.variables).length
      ? `(${inspect(operation.variables)})`
      : ''
  }`

const createClient = (uri, { wsUri, wsOptions, cache, headers, log } = {}) => {
  // Create transport link
  const httpLink = createHttpLink({ uri })

  // Add optional websocket link split for subscriptions
  const transportLink = wsUri
    ? ApolloLink.split(
        ({ query }) =>
          (({ kind, operation }) => kind === 'OperationDefinition' && operation === 'subscription')(
            getMainDefinition(query),
          ),
        new WebSocketLink({ uri: wsUri, options: wsOptions || { reconnect: true } }),
        httpLink,
      )
    : httpLink

  // Compose links
  const link = ApolloLink.from([
    onError(error => (log || console).error(getErrorMessage(error)) && null),
    ...(headers && Object.keys(headers).length
      ? [
          setContext((_request, context) => ({
            headers: { ...context.headers, ...headers },
          })),
        ]
      : []),
    transportLink,
  ])

  if (log)
    log.info(
      `Connecting to GraphQL at ${uri}${wsUri ? ` with subscriptions at ${wsUri}` : ''}`,
      ...(headers && Object.keys(headers).length ? [headers] : []),
    )

  return new ApolloClient({ cache: cache || new InMemoryCache(), link })
}

module.exports = {
  createClient,
  getErrorMessage,
}
