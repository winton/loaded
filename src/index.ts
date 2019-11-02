export type LoadedLoadResponse =
  | Record<string, any>
  | Promise<Record<string, any>>

export class Loaded {
  loaded: Record<string, any> = {}
  pending: Record<string, any> = {}

  load(libs: Record<string, any>): LoadedLoadResponse {
    for (const libName in libs) {
      const lib = libs[libName]
      if (lib.then) {
        this.pending[libName] = lib.then((lib: any) =>
          this.attach(libName, lib)
        )
      } else {
        this.loaded[libName] = lib
      }
    }

    for (const libName in libs) {
      const lib = libs[libName]
      if (!lib.then) {
        const promise = this.attach(libName, lib)
        if (promise) {
          this.pending[libName] = promise
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

  private attach(
    libName: string,
    lib: any
  ): void | Promise<any> {
    if (lib.default) {
      lib = lib.default
    }

    const attaches = []

    this.loaded[libName] = lib

    for (const key in lib) {
      const value = lib[key]

      if (value !== null) {
        continue
      }

      if (Object.keys(this.loaded).indexOf(key) > -1) {
        lib[key] = this.loaded[key]
        continue
      }

      if (Object.keys(this.pending).indexOf(key) > -1) {
        attaches.push(
          this.pending[key].then(() => {
            lib[key] = this.loaded[key]
          })
        )
      }
    }

    if (attaches.length) {
      return Promise.all(attaches)
    }
  }
}

export const instance = new Loaded()
export default instance.load.bind(instance)
