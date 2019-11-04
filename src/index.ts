export type LoadedLoadResponse =
  | Record<string, any>
  | Promise<Record<string, any>>

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
      if (lib.then) {
        this.pending[name] = lib
          .then((lib: any) => this.attach(name, lib))
          .then((lib: any) =>
            this.callback("loaded", name, lib)
          )
      } else {
        this.loaded[name] = lib
      }
    }

    for (const name in libs) {
      const lib = libs[name]
      if (!lib.then) {
        const promise = this.attach(name, lib)
        if (promise.then) {
          this.pending[name] = promise.then((lib: any) =>
            this.callback("loaded", name, lib)
          )
        } else {
          const promise = this.callback("loaded", name, lib)
          if (promise && promise.then) {
            this.pending[name] = promise
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
  ): any | Promise<any> {
    if (lib.default) {
      lib = lib.default
    }

    const attaches = []

    const byArgs = {
      byName: name,
      by: lib,
    }

    this.loaded[name] = lib

    for (const key in lib) {
      const value = lib[key]

      if (value !== null) {
        continue
      }

      if (Object.keys(this.loaded).indexOf(key) > -1) {
        lib[key] = this.loaded[key]
        const out = this.callback(
          "loadedBy",
          key,
          this.loaded[key],
          byArgs
        )
        if (out && out.then) {
          attaches.push(out)
        }
      } else if (
        Object.keys(this.pending).indexOf(key) > -1
      ) {
        attaches.push(
          this.pending[key].then(() => {
            lib[key] = this.loaded[key]
            return this.callback(
              "loadedBy",
              key,
              this.loaded[key],
              byArgs
            )
          })
        )
      }
    }

    if (attaches.length) {
      return Promise.all(attaches).then(() => lib)
    } else {
      return lib
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
}

export const instance = new Loaded()

export default instance.load.bind(
  instance
) as typeof instance.load
