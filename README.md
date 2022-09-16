# Monorepo

## Shared packages

To use a shared package in your app:
- Add a workspace dependency: "@devographics/core-models":"workspace:*"
- When deploying, configure the host to load the whole monorepo (eg on Vercel)
- If the shared code is not bundled, eg written in pure TypeScript, include it in the app bundle.
In Next.js this is done via [next-transpile-modules](https://www.npmjs.com/package/next-transpile-modules) in next.config.js


## Run scripts with Just

[Just](https://github.com/casey/just) is similar to NPM scripts or makefile, but language agnostic, simple and powerful.

Recommended installation with [asdf](https://github.com/asdf-vm/asdf):

```sh
asdf plugin add just
asdf install just latest
asdf global just latest
```

You might need to create the relevant `.tool-versions` files, that defines the
version of Node used by `asdf` (similarly to what .nvmrc do for NVM).

- Run redis (for external and internal API): `just redis`
- Run mongo (for Next and APIs): `just mongo`

## Pnpm with Corepack

The monorepo uses PNPM as its primary package manager.

Since we rely on Node 16+, you can use `yarn` and `pnpm` by enabling the [Corepack](https://nodejs.org/api/corepack.html) feature of Node:

```sh
# If you have Node 16 installed, this will just work
corepack enable
```
### Caveats with pnpm

- If you import a subdependency of a direct dependency, you need to install it explicitelyas well. 
For example, `apollo-server-express` depens on `apollo-server-core`. But if you want to use `apollo-server-core` directly in your code, it must be installed. Yarn and NPM were more flexible (but also less reliable).
- The `node_modules` folder structure is altered. This might trick Webpack cache (see the PNPM plugin used for Gatsby) and also our Apollo patch. Subdependencies are located in `node_modules/.pnpm/node_modules`, only direct dependencies of the project are located in `node_modules` (but they also link towards PNPM shared cache)
- You need `preserveSymlinks: true` in tsconfig.
