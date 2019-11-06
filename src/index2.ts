import Fn2Class, { Fn2Out } from "fn2"

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
    Fn2: typeof Fn2Class,
    libs: Record<string, any>
  ): Fn2Out {
    this.setupLoad(Fn2, libs)

    const out = this.loadLibs(Fn2, libs)

    if (out.then) {
      return out.then(() => this.retrieved)
    } else {
      return this.retrieved
    }
  }

  reset(): void {
    this.loaded = {}
    this.pendingRetrieved = {}
    this.retrieved = {}
  }

  private setupLoad(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>
  ): void {
    for (const libName in libs) {
      const lib = libs[libName]

      const set = (lib: any): void => {
        this.pendingRetrieved[libName] = undefined
        this.retrieved[libName] = lib.default || lib
      }

      if (lib.then) {
        this.pendingRetrieved[libName] = libs[libName].then(
          set
        )
      } else {
        set(libs[libName])
      }
    }
  }

  private loadLibs(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>
  ): Fn2Out {
    return new Fn2(
      Object.keys(libs).reduce((memo, libName) => {
        memo[libName] = (): Fn2Out =>
          new Fn2(
            {
              [libName]: (): any =>
                this.pendingRetrieved[libName],
            },
            {
              waitRetrieved: this.waitRetrieved.bind(this),
            },
            {
              attachRetrieved: this.attachRetrieved.bind(
                this
              ),
            },
            {
              loadedCallback: this.loadedCallback.bind(
                this
              ),
            },
            {
              // eslint-disable-next-line max-len
              loadedByCallbacks: this.loadedByCallbacks.bind(
                this
              ),
            }
          ).run([Fn2, libs, libName])

        return memo
      }, {})
    ).run([Fn2, libs])
  }

  private waitRetrieved(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    const lib = this.retrieved[libName]

    return new Fn2(
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
    ).run()
  }

  private attachRetrieved(
    Fn2: typeof Fn2Class,
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
    Fn2: typeof Fn2Class,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    const lib = this.retrieved[libName]

    const event: LoadedEvent = {
      loaded: this.loaded,
      name: libName,
    }
    return new Fn2(
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
    ).run()
  }

  private loadedByCallbacks(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>,
    libName: string
  ): Fn2Out {
    const lib = this.retrieved[libName]
    const queue = this.loadedByQueue[libName] || []

    return new Fn2(
      queue.reduce((memo, event) => {
        const lib = this.loaded[event.name]

        if (lib.loadedBy) {
          memo[
            `${event.byName} -> ${event.name}`
          ] = (): any => {
            return lib.loadedBy(event)
          }
        }

        return memo
      }, {}),
      Object.keys(libs).reduce((memo, depName) => {
        const dep = this.retrieved[depName]

        if (
          depName !== libName &&
          lib[depName] === dep &&
          dep.loadedBy
        ) {
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
            this.loadedByQueue[
              depName
            ] = this.loadedByQueue[depName].concat(event)
          }
        }

        return memo
      }, {})
    ).run()
  }
}

export const instance = new Loaded()

export default instance.load.bind(
  instance
) as typeof instance.load
