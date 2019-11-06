import Fn2Class from "fn2"

type LoadedOutput =
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

  load(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>
  ): LoadedOutput {
    for (const libName in libs) {
      const lib = libs[libName]

      if (lib.then) {
        this.pending[libName] = libs[libName].then(
          (lib: any) => {
            delete this.pending[libName]
            this.loaded[libName] = lib.default || lib
          }
        )
      } else {
        this.loaded[libName] =
          libs[libName].default || libs[libName]
      }
    }

    const out = new Fn2(
      Object.keys(libs).reduce((memo, libName) => {
        memo[libName] = (): LoadedOutput =>
          new Fn2(
            { [libName]: (): any => libs[libName] },
            { waitForDeps: this.waitForDeps.bind(this) },
            { attachDeps: this.attachDeps.bind(this) }
          ).run([Fn2, libs, libName])

        return memo
      }, {})
    ).run([Fn2, libs])

    if (out.then) {
      return out.then(() => this.loaded)
    } else {
      return this.loaded
    }
  }

  reset(): void {
    this.loaded = {}
    this.pending = {}
  }

  private waitForDeps(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>,
    libName: string
  ): LoadedOutput {
    const lib = this.loaded[libName]

    return new Fn2(
      Object.keys(libs).reduce((memo, depName) => {
        if (
          depName !== libName &&
          lib[depName] === null &&
          this.pending[depName]
        ) {
          memo[libName] = (): any => this.pending[depName]
        }

        return memo
      }, {})
    )
  }

  private attachDeps(
    Fn2: typeof Fn2Class,
    libs: Record<string, any>,
    libName: string
  ): void {
    const lib = this.loaded[libName]

    for (const depName in libs) {
      if (depName === libName || lib[depName] !== null) {
        continue
      }

      const dep = this.loaded[depName]

      lib[depName] = dep
    }
  }
}

export const instance = new Loaded()

export default instance.load.bind(
  instance
) as typeof instance.load
