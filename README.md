# Graphcurl

GraphQL cURL-like command line client with #import support

## Getting Started

### Install

You need [Node.js](https://nodejs.org/en/download/) and optionally [Yarn](https://yarnpkg.com/en/docs/install).

You can install `graphcurl`:

```
yarn global add graphcurl
# or: npm install -g graphcurl
```

Or you can run it without installing:

```
npx graphcurl
```

## Usage

```
Usage: gc|graphcurl [options]

Options:
  -V, --version                        output the version number
  -e, --endpoint <url>                 graphql endpoint
  -k, --key <key>                      output only selected key from response data
  -o, --output <file>                  write response data to json file instead of stdout
  -q, --query <query|@file|->          graphql query (or mutation), may use #import
  -d, --data <variable:value|@file|->  query variables, file may be json or yaml (default: [])
  -H, --header <header:value|@file|->  custom headers, file may be json or yaml (default: [])
  -v, --verbose                        output more details
  -D, --debug                          output debug data
  -h, --help                           output usage information
```

## Roadmap

- [x] Implement working prototype
- [ ] Set default query variable value from environment and .env
- [ ] Select endpoints from [GraphQL Config](https://graphql-config.com), [Prisma config extension](https://github.com/prisma-labs/graphql-config-extension-prisma), and [Apollo config](https://www.apollographql.com/docs/references/apollo-config/)
- [ ] Cleanup code

## Development

### Code Style

Install [Prettier](https://github.com/prettier/prettier#editor-integration) support for used editor/IDE.
