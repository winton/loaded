import logger from "@fn2/logger"
import tinyId from "@fn2/tiny-id"

import expect from "./expect"
import loaded from "../src"

function delay(t: number, v?: any): Promise<any> {
  return new Promise((resolve): void => {
    setTimeout(resolve.bind(null, v), t)
  })
}

beforeEach(() => {
  loaded.reset()
  loaded.load({ logger, tinyId })
})

it("loads synchronous libraries", () => {
  const a = {
    b: null,
  }
  const b = {
    c: null,
  }
  const c = {}
  const out = loaded.load({ a, b, c })
  expect(out).toEqual(
    expect.objectContaining({ a, b, c, fn2: loaded.fn2 })
  )
  expect(a.b).toEqual(b)
  expect(b.c).toEqual(c)
})

it("loads synchronous libraries in separate calls", () => {
  const a = {
    b: null,
  }
  const b = {
    c: null,
  }
  const c = {}
  loaded.load({ a, b })
  const out = loaded.load({ c })
  expect(out).toEqual(
    expect.objectContaining({ a, b, c, fn2: loaded.fn2 })
  )
  expect(a.b).toEqual(b)
  expect(b.c).toEqual(c)
})

it("makes fn2 available", () => {
  const a = {
    fn2: null,
  }
  const b = {
    fn2: null,
  }
  loaded.load({ a, b })
  expect(a.fn2).toEqual(loaded.fn2)
  expect(b.fn2).toEqual(loaded.fn2)
})

it("loads asynchronous libraries", async () => {
  const a = {
    b: null,
  }
  const b = {
    c: null,
  }
  const c = {}
  const out = await loaded.load({
    a: delay(1, a),
    b: delay(1, b),
    c: delay(1, c),
  })
  expect(out).toEqual(
    expect.objectContaining({ a, b, c, fn2: loaded.fn2 })
  )
  expect(a.b).toEqual(b)
  expect(b.c).toEqual(c)
})

it("loads asynchronous libraries (with wait)", async () => {
  const a = {
    b: null,
  }
  const b = {
    c: null,
  }
  const c = {}
  loaded.load({
    a: delay(1, a),
    b: delay(1, b),
    c: delay(1, c),
  })
  const out = await loaded.wait("a", "b", "c")
  expect(out).toEqual(
    expect.objectContaining({ a, b, c, fn2: loaded.fn2 })
  )
  expect(a.b).toEqual(b)
  expect(b.c).toEqual(c)
})

it("calls loaded callback with correct args", async () => {
  expect.assertions(6)

  let a: A = null
  let b: B = null
  let c: C = null

  class A {
    b = null

    loaded({ name, loaded }): void {
      expect(name).toBe("a")
      expect(loaded).toEqual(
        expect.objectContaining({ b, c, fn2: loaded.fn2 })
      )
    }
  }

  class B {
    c = null

    loaded({ name, loaded }): void {
      expect(name).toBe("b")
      expect(loaded).toEqual(
        expect.objectContaining({ c, fn2: loaded.fn2 })
      )
    }
  }

  class C {
    loaded({ name, loaded }): void {
      expect(name).toBe("c")
      expect(loaded).toEqual(
        expect.objectContaining({ fn2: loaded.fn2 })
      )
    }
  }

  a = new A()
  b = new B()
  c = new C()

  loaded.load({ a, b, c })
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
    c: null,
  }

  const c = {}

  await loaded.load({ a, b, c })
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
    c: null,
  }

  const c = {}

  await loaded.load({
    a: delay(1, a),
    b: delay(1, b),
    c: delay(1, c),
  })
})

it("calls loadedBy callback with correct args", async () => {
  expect.assertions(8)

  let a: A = null
  let b: B = null
  let c: C = null

  class A {
    b = null

    loadedBy(): void {
      expect(1).toBe(0)
    }
  }

  class B {
    c = null

    loadedBy({ name, loaded, byName, by }): void {
      expect(name).toBe("b")
      expect(loaded).toEqual(
        expect.objectContaining({ b, c, fn2: loaded.fn2 })
      )
      expect(byName).toBe("a")
      expect(by).toBe(a)
    }
  }

  class C {
    loadedBy({ name, loaded, byName, by }): void {
      expect(name).toBe("c")
      expect(loaded).toEqual(
        expect.objectContaining({ c, fn2: loaded.fn2 })
      )
      expect(byName).toBe("b")
      expect(by).toBe(b)
    }
  }

  a = new A()
  b = new B()
  c = new C()

  loaded.load({ a, b, c })
})

it("calls async loadedBy callback on sync load", async () => {
  expect.assertions(2)

  let a = null
  let b = null
  let c = null

  class A {
    b = null

    async loadedBy(): Promise<void> {
      expect(1).toBe(0)
    }
  }

  class B {
    c = null

    async loadedBy(): Promise<void> {
      expect(this.c).not.toBe(null)
      expect(this.c).toBe(c)
    }
  }

  class C {}

  a = new A()
  b = new B()
  c = new C()

  await loaded.load({ a, b, c })
})

it("calls async loadedBy callback on async load", async () => {
  expect.assertions(2)

  let a = null
  let b = null
  let c = null

  class A {
    b = null

    async loadedBy(): Promise<void> {
      expect(1).toBe(0)
    }
  }

  class B {
    c = null

    async loadedBy(): Promise<void> {
      expect(this.c).not.toBe(null)
      expect(this.c).toBe(c)
    }
  }

  class C {}

  a = new A()
  b = new B()
  c = new C()

  await loaded.load({
    a: delay(1, a),
    b: delay(1, b),
    c: delay(1, c),
  })
})

it("calls reset callback", () => {
  expect.assertions(3)

  const a = {
    b: null,
    reset: (): void => {
      expect(true).toBeTruthy()
    },
  }

  const b = {
    c: null,
    reset: (): void => {
      expect(true).toBeTruthy()
    },
  }

  const c = {
    reset: (): void => {
      expect(true).toBeTruthy()
    },
  }

  loaded.load({ a, b, c })
  loaded.reset()
})
