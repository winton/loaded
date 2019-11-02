import expect from "./expect"
import load from "../src"

function delay(t: number, v?: any): Promise<any> {
  return new Promise((resolve): void => {
    setTimeout(resolve.bind(null, v), t)
  })
}

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

it("calls async callback on sync load", async () => {
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

it("calls async callback on async load", async () => {
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
