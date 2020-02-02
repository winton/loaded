import { Fn2, fn2out } from "fn2"
import { DepGraph } from "./dep-graph"

export interface LoadedEvent {
  name: string
  loaded: Record<string, any>
  byName?: string
  by?: any
}

export class Loaded {
  deps: Record<string, string[]>
  graph: DepGraph<string>
  graphCache: Record<string, string[]>
  fn2: Fn2
  libs: Record<string, any>
  loaded: Record<string, any>
  loading: Record<string, Promise<any>>
  loadingResolvers: Record<string, Function>
  retrieving: Record<string, any>

  constructor() {
    this.reset()
  }

  evalLoad(libs: Record<string, string>): fn2out {
    const rows = []

    for (const depName in libs) {
      rows.push(`${depName}: import("${libs[depName]}")`)
    }

    return eval(`loaded.load({ ${rows.join(", ")} })`)
  }

  load(libs: Record<string, any>): fn2out {
    this.initLibs(libs)

    const out = this.loadLibs(libs)

    if (out.then) {
      return out.then(() => this.libs)
    } else {
      return this.libs
    }
  }

  reset(): fn2out | void {
    const out = this.resetLibs()

    this.resetDeps()

    this.deps = {}
    this.fn2 = new Fn2()
    this.graph = new DepGraph()
    this.graphCache = {}
    this.libs = {}
    this.loaded = {}
    this.loading = {}
    this.loadingResolvers = {}
    this.retrieving = {}

    this.load({
      browser: typeof history !== "undefined",
      evalLoad: this.evalLoad.bind(this),
      fn2: this.fn2,
      libs: this.libs,
      load: this.load.bind(this),
      wait: this.wait.bind(this),
    })

    return out
  }

  wait(...libs: string[]): Promise<any> {
    return Promise.all(
      libs.map(libName => this.loading[libName])
    ).then(() => this.loaded)
  }

  private initLibs(libs: Record<string, any>): void {
    for (const libName in libs) {
      this.graph.addNode(libName)
      this.libs[libName] = undefined
      this.loading[libName] = new Promise(
        resolve =>
          (this.loadingResolvers[libName] = resolve)
      )
    }
  }

  private loadLibs(libs: Record<string, any>): fn2out {
    this.retrieving = Object.keys(libs).reduce(
      (memo, libName) => {
        memo[libName] = this.retrieve(
          libName,
          libs[libName]
        )
        return memo
      },
      {}
    )

    return this.fn2.run(
      Object.keys(libs).reduce((memo, libName) => {
        memo[libName] = (): fn2out =>
          this.loadLib(libName, libs[libName])
        return memo
      }, {})
    )
  }

  private loadLib(libName: string, lib: any): fn2out {
    return this.fn2.run(
      [libName, lib],
      { [libName]: () => this.retrieving[libName] },
      { attachRetrieved: this.attachRetrieved.bind(this) },
      { loadDeps: this.loadDeps.bind(this) }
    )
  }

  private retrieve(libName: string, lib: any): fn2out {
    return this.fn2.run(
      [libName, lib],
      {
        [libName]: (): any => {
          if (lib.then) {
            return lib.then(
              (lib: any) =>
                (this.libs[libName] = lib.default || lib)
            )
          } else {
            this.libs[libName] = lib
          }
        },
      },
      { setupLib: this.setupLib.bind(this) },
      { waitRetrieved: this.waitRetrieved.bind(this) }
    )
  }

  private setupLib(libName: string): void {
    for (const depName in this.libs) {
      if (this.libs[libName][depName] === null) {
        this.deps[libName] = (
          this.deps[libName] || []
        ).concat(depName)

        this.graph.addNode(depName)
        this.graph.addDependency(libName, depName)
      }
    }

    for (const libName in this.libs) {
      this.graphCache[libName] = this.graph.dependenciesOf(
        libName
      )
    }
  }

  private waitRetrieved(libName: string): fn2out {
    const deps = this.graphCache[libName]

    if (deps.length === 0) {
      return
    }

    return this.fn2.run(
      deps.reduce((memo, depName) => {
        if (this.retrieving[depName]) {
          memo[depName] = (): any =>
            this.retrieving[depName]
        }
        return memo
      }, {})
    )
  }

  private attachRetrieved(libName: string): fn2out {
    const deps = this.graphCache[libName].concat([libName])

    return this.fn2.run(
      deps.reduce((memo, depName) => {
        memo[depName] = (): any => this.attachDeps(depName)
        return memo
      }, {})
    )
  }

  private attachDeps(libName: string): void {
    const lib = this.libs[libName]
    const deps = this.deps[libName]

    for (const depName in this.libs) {
      if (this.libs[depName][libName] === null) {
        this.libs[depName][libName] = lib
      }
    }

    if (deps) {
      for (const depName of deps) {
        lib[depName] = this.libs[depName]
      }
    }
  }

  private loadDeps(libName: string): fn2out {
    const deps = this.graphCache[libName].concat([libName])

    return this.fn2.run(
      deps.reduce((memo, depName) => {
        memo[depName] = (): fn2out => this.loadDep(depName)
        return memo
      }, {})
    )
  }

  private loadDep(libName: string): fn2out {
    const deps = this.deps[libName]

    if (this.loaded[libName]) {
      return
    }

    return this.fn2.run(
      (deps || []).reduce((memo, depName) => {
        memo[`${depName}LoadedBy`] = (): any =>
          this.loadedByCallback(libName, depName)
        return memo
      }, {}),
      {
        loadedCallback: () => this.loadedCallback(libName),
      },
      {
        fullyLoaded: () => {
          this.loaded[libName] = this.libs[libName]
          this.loadingResolvers[libName]()
        },
      }
    )
  }

  private loadedByCallback(
    libName: string,
    depName: string
  ): any {
    const lib = this.libs[libName]
    const dep = this.libs[depName]

    if (this.loaded[libName] || !dep.loadedBy) {
      return
    }

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: depName,
      by: lib,
      byName: libName,
    }

    return dep.loadedBy(event)
  }

  private loadedCallback(libName: string): any {
    const lib = this.libs[libName]

    if (this.loaded[libName] || !lib.loaded) {
      return
    }

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: libName,
    }

    return lib.loaded(event)
  }

  private resetLibs(): fn2out {
    if (this.graph) {
      return this.fn2.run(
        this.graph
          .overallOrder()
          .reduce((memo, libName) => {
            const lib = this.loaded[libName]

            if (lib.reset) {
              memo[libName] = lib.reset()
            }

            return memo
          }, {})
      )
    }
  }

  private resetDeps(): void {
    for (const libName in this.deps) {
      for (const depName of this.deps[libName]) {
        this.libs[libName][depName] = null
      }
    }
  }
}

export default new Loaded()
export * from "fn2"
