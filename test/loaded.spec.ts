import fn2 from "fn2"
import expect from "./expect"
import load, { instance } from "../src"

function delay(t: number, v?: any): Promise<any> {
  return new Promise((resolve): void => {
    setTimeout(resolve.bind(null, v), t)
  })
}

beforeEach(() => instance.reset())

it("loads synchronous libraries", () => {
  const a = {
    b: null,
  }
  const b = {
    a: null,
  }
  const out = load({ a, b })
  expect(out).toEqual({ a, b, fn2 })
  expect(a.b).toEqual(b)
  expect(b.a).toEqual(a)
})

it("makes fn2 available", () => {
  const a = {
    fn2: null,
  }
  const b = {
    fn2: null,
  }
  load({ a, b })
  expect(a.fn2).toEqual(fn2)
  expect(b.fn2).toEqual(fn2)
})

it("loads asynchronous libraries", async () => {
  const a = {
    b: null,
  }
  const b = {
    a: null,
  }
  const out = await load({
    a: delay(1, a),
    b: delay(1, b),
  })
  expect(out).toEqual({ a, b, fn2 })
  expect(a.b).toEqual(b)
  expect(b.a).toEqual(a)
})

it("calls loaded callback with correct args", async () => {
  expect.assertions(4)

  let a: A = null

  class A {
    b = null

    loaded({ name, loaded }): void {
      expect(name).toBe("a")
      expect(loaded).toEqual({ fn2 })
    }
  }

  class B {
    a = null

    loaded({ name, loaded }): void {
      expect(name).toBe("b")
      expect(loaded).toEqual({ a, fn2 })
    }
  }

  a = new A()
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

    loadedBy({ name, loaded, byName, by }): void {
      expect(name).toBe("a")
      expect(loaded.a).toBe(this)
      expect(loaded.b).toBe(this.b)
      expect(byName).toBe("b")
      expect(by).toBe(this.b)
    }
  }

  const a = new A()

  class B {
    a = null

    loadedBy({ name, loaded, byName, by }): void {
      expect(name).toBe("b")
      expect(loaded.a).toBe(a)
      expect(loaded.b).toBe(this)
      expect(byName).toBe("a")
      expect(by).toBe(a)
    }
  }

  const b = new B()

  load({ a, b })
})

it("calls async loadedBy callback on sync load", async () => {
  expect.assertions(4)

  let b = null

  class A {
    b = null

    async loadedBy(): Promise<void> {
      expect(this.b).not.toBe(null)
      expect(this.b).toBe(b)
    }
  }

  const a = new A()

  class B {
    a = null

    async loadedBy(): Promise<void> {
      expect(this.a).not.toBe(null)
      expect(this.a).toBe(a)
    }
  }

  b = new B()

  await load({ a, b })
})

it("calls async loadedBy callback on async load", async () => {
  expect.assertions(4)

  let b = null

  class A {
    b = null

    async loadedBy(): Promise<void> {
      expect(this.b).not.toBe(null)
      expect(this.b).toBe(b)
    }
  }

  const a = new A()

  class B {
    a = null

    async loadedBy(): Promise<void> {
      expect(this.a).not.toBe(null)
      expect(this.a).toBe(a)
    }
  }

  b = new B()

  await load({ a: delay(1, a), b: delay(1, b) })
})
