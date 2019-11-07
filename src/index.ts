import fn2type, { Fn2Out } from "fn2"

export interface LoadedEvent {
  name: string
  loaded: Record<string, any>
  byName?: string
  by?: any
}

export class Loaded {
  loaded: Record<string, any> = {}
  loadedByQueue: Record<string, LoadedEvent[]> = {}
  pendingRetrieved: Record<string, any> = {}
  retrieved: Record<string, any> = {}

  load(
    fn2: typeof fn2type,
    libs: Record<string, any>
  ): Fn2Out {
    this.setupLoad(fn2, libs)

    const out = this.loadLibs(fn2, libs)

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
  }

  private setupLoad(
    fn2: typeof fn2type,
    libs: Record<string, any>
  ): void {
    for (const libName in libs) {
      const lib = libs[libName]

      if (lib.then) {
        this.pendingRetrieved[libName] = lib.then(
          (lib: any) => this.setRetrieved(libName, lib)
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

  private loadLibs(
    fn2: typeof fn2type,
    libs: Record<string, any>
  ): Fn2Out {
    return fn2(
      [fn2, libs],
      Object.keys(libs).reduce((memo, libName) => {
        memo[libName] = (): Fn2Out =>
          this.loadLib(fn2, libs, libName)

        return memo
      }, {})
    )
  }

  private loadLib(
    fn2: typeof fn2type,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    return fn2(
      [fn2, libs, libName],
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
    fn2: typeof fn2type,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    const lib = this.retrieved[libName]

    return fn2(
      Object.keys(libs).reduce((memo, depName) => {
        if (
          depName !== libName &&
          lib[depName] === null &&
          this.pendingRetrieved[depName]
        ) {
          memo[libName] = (): any =>
            this.pendingRetrieved[depName]
        }

        return memo
      }, {})
    )
  }

  private attachRetrieved(
    fn2: typeof fn2type,
    libs: Record<string, any>,
    libName: string
  ): void {
    const lib = this.retrieved[libName]

    for (const depName in libs) {
      if (depName === libName || lib[depName] !== null) {
        continue
      }

      lib[depName] = this.retrieved[depName]
    }
  }

  private loadedCallback(
    fn2: typeof fn2type,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    const lib = this.retrieved[libName]

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: libName,
    }

    return fn2(
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
    fn2: typeof fn2type,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    const lib = this.retrieved[libName]
    const queue = this.loadedByQueue[libName] || []

    return fn2(
      queue.reduce(
        this.processLoadedByQueue.bind(this),
        {}
      ),
      {
        clearLoadedByQueue: (): void => {
          this.loadedByQueue[libName] = undefined
        },
      },
      Object.keys(libs).reduce((memo, depName) => {
        this.loadedByEnqueueOrCall(
          memo,
          depName,
          lib,
          libName
        )
        return memo
      }, {})
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
