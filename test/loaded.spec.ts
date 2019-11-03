import expect from "./expect"
import load, { instance } from "../src"

function delay(t: number, v?: any): Promise<any> {
  return new Promise((resolve): void => {
    setTimeout(resolve.bind(null, v), t)
  })
}

beforeEach(instance.reset)

it("loads synchronous libraries", () => {
  const a = {
    b: null,
  }
  const b = {
    a: null,
  }
  const out = load({ a, b })
  expect(out).toEqual({ a, b })
  expect(a.b).toEqual(b)
  expect(b.a).toEqual(a)
})

it("loads asynchronous libraries", async () => {
  const a = {
    b: null,
  }
  const b = {
    a: null,
  }
  const out = await load({ a: delay(1, a), b: delay(1, b) })
  expect(out).toEqual({ a, b })
  expect(a.b).toEqual(b)
  expect(b.a).toEqual(a)
})

it("calls loaded callback with correct args", async () => {
  expect.assertions(6)

  class A {
    b = null

    loaded(
      name: string,
      loaded: Record<string, any>
    ): void {
      expect(name).toBe("a")
      expect(loaded.a).toBe(this)
      expect(loaded.b).toBe(this.b)
    }
  }

  class B {
    a = null

    loaded(
      name: string,
      loaded: Record<string, any>
    ): void {
      expect(name).toBe("b")
      expect(loaded.a).toBe(this.a)
      expect(loaded.b).toBe(this)
    }
  }

  const a = new A()
  const b = new B()

  load({ a, b })
})

it("calls async loaded callback on sync load", async () => {
  expect.assertions(1)

  const a = {
    b: null,
    loaded: async (): Promise<void> => {
      await delay(1)
      expect(true).toBeTruthy()
    },
  }
  const b = {
    a: null,
  }

  await load({ a, b })
})

it("calls async loaded callback on async load", async () => {
  expect.assertions(1)

  const a = {
    b: null,
    loaded: async (): Promise<void> => {
      await delay(1)
      expect(true).toBeTruthy()
    },
  }
  const b = {
    a: null,
  }

  await load({ a: delay(1, a), b: delay(1, b) })
})

it("calls loadedBy callback with correct args", async () => {
  expect.assertions(10)

  class A {
    b = null

    loadedBy(
      name: string,
      loaded: Record<string, any>,
      byName: string,
      byLib: any
    ): void {
      expect(name).toBe("a")
      expect(loaded.a).toBe(this)
      expect(loaded.b).toBe(this.b)
      expect(byName).toBe("b")
      expect(byLib).toBe(this.b)
    }
  }

  const a = new A()

  class B {
    a = null

    loadedBy(
      name: string,
      loaded: Record<string, any>,
      byName: string,
      byLib: any
    ): void {
      expect(name).toBe("b")
      expect(loaded.a).toBe(a)
      expect(loaded.b).toBe(this)
      expect(byName).toBe("a")
      expect(byLib).toBe(a)
    }
  }

  const b = new B()

  load({ a, b })
})

it("calls async loadedBy callback on sync load", async () => {
  expect.assertions(1)

  const a = {
    b: null,
    loadedBy: async (): Promise<void> => {
      await delay(1)
      expect(true).toBeTruthy()
    },
  }
  const b = {
    a: null,
  }

  await load({ a, b })
})

it("calls async loadedBy callback on async load", async () => {
  expect.assertions(1)

  const a = {
    b: null,
    loadedBy: async (): Promise<void> => {
      await delay(1)
      expect(true).toBeTruthy()
    },
  }
  const b = {
    a: null,
  }

  await load({ a: delay(1, a), b: delay(1, b) })
})
