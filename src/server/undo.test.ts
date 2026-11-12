import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {}, schema: {} }));

const { makeUndoToken, readUndoToken, UndoRejected, UNDO_WINDOW_MS } = await import("./undo");

const steps = [{ op: "del" as const, table: "txn" as const, ids: ["a"] }];

describe("undo tokens", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("round-trips for the same user inside the window", () => {
    const t = makeUndoToken("u1", steps);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(readUndoToken(t, "u1")).toEqual(steps);
  });

  it("is refused once the window (plus a little slack) has passed", () => {
    const t = makeUndoToken("u1", steps);
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 10_001);
    expect(() => readUndoToken(t, "u1")).toThrow(UndoRejected);
  });

  it("can't be used by another user", () => {
    expect(() => readUndoToken(makeUndoToken("u1", steps), "u2")).toThrow(UndoRejected);
  });

  it("rejects a tampered payload", () => {
    const [, mac] = makeUndoToken("u1", steps).split(".");
    const forged = Buffer.from(JSON.stringify({ u: "u1", e: Date.now() + 1e9, s: [] })).toString("base64url");
    expect(() => readUndoToken(`${forged}.${mac}`, "u1")).toThrow(UndoRejected);
  });
});
