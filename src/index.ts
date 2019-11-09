import fn2, { fn2out } from "fn2"

export interface LoadedEvent {
  name: string
  loaded: Record<string, any>
  byName?: string
  by?: any
}

export class Loaded {
  loaded: Record<string, any>
  loadedByQueue: Record<string, LoadedEvent[]>
  pendingRetrieved: Record<string, any>
  retrieved: Record<string, any>

  constructor() {
    this.reset()
  }

  load(libs: Record<string, any>): fn2out {
    this.setupLoad(libs)

    const out = this.loadLibs(libs)

    if (out.then) {
      return out.then(() => this.retrieved)
    } else {
      return this.retrieved
    }
  }

  reset(): void {
    this.loaded = {}
    this.loadedByQueue = {}
    this.pendingRetrieved = {}
    this.retrieved = {}

    this.load({ fn2 })
  }

  private setupLoad(libs: Record<string, any>): void {
    for (const libName in libs) {
      const lib = libs[libName]

      if (lib.then) {
        this.pendingRetrieved[
          libName
        ] = lib.then((lib: any) =>
          this.setRetrieved(libName, lib)
        )
      } else {
        this.setRetrieved(libName, lib)
      }
    }
  }

  private setRetrieved(libName: string, lib: any): void {
    this.pendingRetrieved[libName] = undefined
    this.retrieved[libName] = lib.default || lib
  }

  private loadLibs(libs: Record<string, any>): fn2out {
    return fn2.run(
      [libs],
      Object.keys(libs).reduce((memo, libName) => {
        memo[libName] = (): fn2out =>
          this.loadLib(libs, libName)

        return memo
      }, {})
    )
  }

  private loadLib(
    libs: Record<string, any>,
    libName: string
  ): fn2out {
    return fn2.run(
      [libs, libName],
      {
        [libName]: (): any =>
          this.pendingRetrieved[libName],
      },
      {
        waitRetrieved: this.waitRetrieved.bind(this),
      },
      {
        attachRetrieved: this.attachRetrieved.bind(this),
      },
      {
        loadedCallback: this.loadedCallback.bind(this),
      },
      {
        loadedByCallbacks: this.loadedByCallbacks.bind(
          this
        ),
      }
    )
  }

  private waitRetrieved(
    libs: Record<string, any>,
    libName: string
  ): fn2out {
    const lib = this.retrieved[libName]

    return fn2.run(
      Object.keys(this.pendingRetrieved).reduce(
        (memo, depName) => {
          if (
            depName !== libName &&
            lib[depName] === null &&
            this.pendingRetrieved[depName]
          ) {
            memo[libName] = (): any =>
              this.pendingRetrieved[depName]
          }

          return memo
        },
        {}
      )
    )
  }

  private attachRetrieved(
    libs: Record<string, any>,
    libName: string
  ): void {
    const lib = this.retrieved[libName]

    for (const depName in this.pendingRetrieved) {
      if (depName === libName || lib[depName] !== null) {
        continue
      }

      lib[depName] = this.retrieved[depName]
    }
  }

  private loadedCallback(
    libs: Record<string, any>,
    libName: string
  ): fn2out {
    const lib = this.retrieved[libName]

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: libName,
    }

    return fn2.run(
      {
        loaded: (): any => {
          if (lib.loaded) {
            return lib.loaded(event)
          }
        },
      },
      {
        setLoaded: (): void => {
          this.loaded[libName] = this.retrieved[libName]
        },
      }
    )
  }

  private loadedByCallbacks(
    libs: Record<string, any>,
    libName: string
  ): fn2out {
    const lib = this.retrieved[libName]
    const queue = this.loadedByQueue[libName] || []

    return fn2.run(
      queue.reduce(
        this.processLoadedByQueue.bind(this),
        {}
      ),
      {
        clearLoadedByQueue: (): void => {
          this.loadedByQueue[libName] = undefined
        },
      },
      Object.keys(this.pendingRetrieved).reduce(
        (memo, depName) => {
          this.loadedByEnqueueOrCall(
            memo,
            depName,
            lib,
            libName
          )
          return memo
        },
        {}
      )
    )
  }

  private processLoadedByQueue(
    memo: Record<string, any>,
    event: LoadedEvent
  ): Record<string, any> {
    const lib = this.loaded[event.name]

    if (lib.loadedBy) {
      memo[
        `${event.byName} -> ${event.name}`
      ] = (): any => {
        return lib.loadedBy(event)
      }
    }

    return memo
  }

  private loadedByEnqueueOrCall(
    memo: Record<string, any>,
    depName: string,
    lib: any,
    libName: string
  ): void {
    const dep = this.retrieved[depName]

    if (
      depName === libName ||
      lib[depName] !== dep ||
      !dep.loadedBy
    ) {
      return
    }

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: depName,
      by: lib,
      byName: libName,
    }

    if (this.loaded[depName]) {
      memo[libName] = (): any => dep.loadedBy(event)
    } else {
      this.loadedByQueue[depName] =
        this.loadedByQueue[depName] || []

      this.loadedByQueue[depName] = this.loadedByQueue[
        depName
      ].concat(event)
    }
  }
}

export const instance = new Loaded()

export default instance.load.bind(
  instance
) as typeof instance.load
