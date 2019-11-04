export type LoadedLoadResponse =
  | Record<string, any>
  | Promise<Record<string, any>>

export interface LoadedAttachResponse {
  keys: string[]
  lib: any | Promise<any>
  name: string
}

export interface LoadedEvent {
  name: string
  loaded: Record<string, any>
  byName?: string
  by?: any
}

export class Loaded {
  loaded: Record<string, any> = {}
  pending: Record<string, any> = {}

  load(libs: Record<string, any>): LoadedLoadResponse {
    for (const name in libs) {
      const lib = libs[name]

      if (lib instanceof Promise) {
        this.pending[name] = lib
          .then((lib: any) => this.attach(name, lib))
          .then(this.callbacks.bind(this))
      } else {
        this.loaded[name] = lib
      }
    }

    for (const name in libs) {
      const lib = libs[name]

      if (!(lib instanceof Promise)) {
        const attachOut = this.attach(name, lib)

        if (attachOut instanceof Promise) {
          this.pending[name] = attachOut.then(
            this.callbacks.bind(this)
          )
        } else {
          const { keys } = attachOut
          const callbacksOut = this.callbacks({
            keys,
            lib,
            name,
          })

          if (callbacksOut instanceof Promise) {
            this.pending[name] = callbacksOut
          }
        }
      }
    }

    const pending = Object.values(this.pending)

    if (pending.length) {
      return Promise.all(pending).then(() => this.loaded)
    } else {
      return this.loaded
    }
  }

  public reset(): void {
    this.loaded = {}
    this.pending = {}
  }

  private attach(
    name: string,
    lib: any
  ): LoadedAttachResponse | Promise<LoadedAttachResponse> {
    if (lib.default) {
      lib = lib.default
    }

    const attaches: Promise<any>[] = []
    const keys: string[] = []

    this.loaded[name] = lib

    for (const key in lib) {
      const value = lib[key]

      if (value !== null) {
        continue
      }

      if (Object.keys(this.loaded).indexOf(key) > -1) {
        lib[key] = this.loaded[key]
        keys.push(key)
      } else if (
        Object.keys(this.pending).indexOf(key) > -1
      ) {
        attaches.push(
          this.pending[key].then(() => {
            lib[key] = this.loaded[key]
            keys.push(key)
          })
        )
      }
    }

    if (attaches.length) {
      return Promise.all(attaches).then(() => ({
        keys,
        lib,
        name,
      }))
    } else {
      return { keys, lib, name }
    }
  }

  private callback(
    cb: string,
    name: string,
    lib: any,
    args: Record<string, any> = {}
  ): any | Promise<any> {
    if (lib[cb]) {
      return lib[cb]({ ...args, name, loaded: this.loaded })
    }
  }

  private callbacks({
    keys,
    lib,
    name,
  }: LoadedAttachResponse): Promise<any> {
    const promises = []

    const callbackOut = this.callback("loaded", name, lib)

    if (callbackOut instanceof Promise) {
      promises.push(callbackOut)
    }

    for (const key of keys) {
      if (callbackOut instanceof Promise) {
        promises.push(
          callbackOut.then(() =>
            this.byCallback({ key, lib, name })
          )
        )
      } else {
        const out = this.byCallback({
          key,
          lib,
          name,
        })

        if (out instanceof Promise) {
          promises.push(out)
        }
      }
    }

    if (promises.length) {
      return Promise.all(promises)
    }
  }

  private byCallback({
    key,
    lib,
    name,
  }: {
    key: string
    lib: any
    name: string
  }): Promise<any> {
    return this.callback(
      "loadedBy",
      key,
      this.loaded[key],
      {
        byName: name,
        by: lib,
      }
    )
  }
}

export const instance = new Loaded()

export default instance.load.bind(
  instance
) as typeof instance.load
