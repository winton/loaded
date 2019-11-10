import fn2, { fn2out } from "fn2"
import { DepGraph } from "dependency-graph"

export interface LoadedEvent {
  name: string
  loaded: Record<string, any>
  byName?: string
  by?: any
}

export class Loaded {
  graph: DepGraph<string>
  deps: Record<string, string[]>
  libs: Record<string, any>
  loaded: Record<string, any>
  pending: Record<string, any>
  retrieved: Record<string, any>

  constructor() {
    this.reset()
  }

  load(libs: Record<string, any>): fn2out {
    this.assignLibs(libs)
    this.setupLibs()

    const out = this.loadLibs(libs)

    if (out.then) {
      return out.then(() => this.retrieved)
    } else {
      return this.retrieved
    }
  }

  reset(): void {
    this.graph = new DepGraph()
    this.deps = {}
    this.libs = {}
    this.loaded = {}
    this.pending = {}
    this.retrieved = {}

    this.load({ fn2 })
  }

  private assignLibs(libs: Record<string, any>): void {
    for (const libName in libs) {
      this.libs = { ...this.libs, [libName]: libs[libName] }
    }
  }

  private setupLibs(): void {
    for (const libName in this.libs) {
      const lib = this.libs[libName]

      if (lib.then) {
        this.pending[libName] = lib.then((lib: any) =>
          this.setupLib(libName, lib)
        )
      } else {
        this.setupLib(libName, lib)
      }
    }
  }

  private setupLib(libName: string, lib: any): void {
    this.pending[libName] = undefined
    this.retrieved[libName] = lib.default || lib

    this.graph.addNode(libName)

    for (const depName in this.libs) {
      if (this.retrieved[libName][depName] === null) {
        this.deps[libName] = this.deps[libName] || []
        this.deps[libName] = this.deps[libName].concat(
          depName
        )

        this.graph.addNode(depName)
        this.graph.addDependency(libName, depName)
      }
    }
  }

  private loadLibs(libs: Record<string, any>): fn2out {
    return fn2.run(
      Object.keys(libs).reduce((memo, libName) => {
        memo[libName] = (): fn2out => this.loadLib(libName)
        return memo
      }, {})
    )
  }

  private loadLib(libName: string): fn2out {
    return fn2.run(
      [libName],
      {
        [libName]: (): any => this.pending[libName],
      },
      {
        waitRetrieved: this.waitRetrieved.bind(this),
      },
      {
        attachRetrieved: this.attachRetrieved.bind(this),
      },
      {
        loadDeps: this.loadDeps.bind(this),
      }
    )
  }

  private waitRetrieved(libName: string): fn2out {
    const deps = this.graph.dependenciesOf(libName)

    if (deps.length === 0) {
      return
    }

    return fn2.run(
      deps.reduce((memo, depName) => {
        if (this.pending[depName]) {
          memo[depName] = (): any => this.pending[depName]
        }
        return memo
      }, {})
    )
  }

  private attachRetrieved(libName: string): fn2out {
    const deps = this.graph
      .dependenciesOf(libName)
      .concat([libName])

    return fn2.run(
      deps.reduce((memo, depName) => {
        memo[depName] = (): any => this.attachDeps(depName)
        return memo
      }, {})
    )
  }

  private attachDeps(libName: string): void {
    const lib = this.retrieved[libName]
    const deps = this.deps[libName]

    if (!deps) {
      return
    }

    for (const depName of deps) {
      lib[depName] = this.retrieved[depName]
    }
  }

  private loadDeps(libName: string): fn2out {
    const deps = this.graph
      .dependenciesOf(libName)
      .concat([libName])

    return fn2.run(
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

    return fn2.run(
      (deps || []).reduce((memo, depName) => {
        memo[`${depName}LoadedBy`] = (): any =>
          this.loadedByCallback(libName, depName)
        return memo
      }, {}),
      {
        loadedCallback: () => this.loadedCallback(libName),
      },
      {
        setLoaded: () =>
          (this.loaded[libName] = this.retrieved[libName]),
      }
    )
  }

  loadedByCallback(libName: string, depName: string): any {
    const lib = this.retrieved[libName]
    const dep = this.retrieved[depName]

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

  loadedCallback(libName: string): any {
    const lib = this.retrieved[libName]

    if (this.loaded[libName] || !lib.loaded) {
      return
    }

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: libName,
    }

    return lib.loaded(event)
  }
}

export const instance = new Loaded()
export { fn2 }

export default instance.load.bind(
  instance
) as typeof instance.load
