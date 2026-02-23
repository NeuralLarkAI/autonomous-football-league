import vm from "node:vm";

const SANDBOX_TIMEOUT_MS = 50;

function isValidOutput(output: unknown): boolean {
  if (output === null || typeof output !== "object") return false;
  const value = output as Record<string, unknown>;
  if ("ok" in value && typeof value.ok !== "boolean") return false;
  if ("action" in value && typeof value.action !== "string") return false;
  if ("payload" in value && (value.payload === null || typeof value.payload !== "object")) return false;
  return true;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSource(input: string): string {
  let src = input;
  src = src.replace(/export\s+async\s+function\s+decide/g, "async function decide");
  src = src.replace(/export\s+function\s+decide/g, "function decide");
  src = src.replace(/export\s+const\s+decide\s*=\s*/g, "const decide = ");
  src = src.replace(/export\s+default\s+function\s+decide/g, "function decide");
  src += "\n;globalThis.__aflDecide = (typeof decide === 'function' ? decide : (module?.exports?.decide ?? exports?.decide));\n";
  return src;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Sandbox execution timed out")), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export async function runSandboxDecide(input: {
  sourceCode: string;
  payload: unknown;
  seed?: number;
}): Promise<{ ok: boolean; output: unknown; durationMs: number; error?: string }> {
  const started = Date.now();
  const deterministicRandom = mulberry32(input.seed ?? 42);
  const sandbox = {
    module: { exports: {} as Record<string, unknown> },
    exports: {} as Record<string, unknown>,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    Date,
    Math: {
      ...Math,
      random: deterministicRandom,
    },
    JSON,
    setTimeout: undefined,
    setInterval: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    WebSocket: undefined,
    process: undefined,
    require: undefined,
  };
  vm.createContext(sandbox);

  try {
    const script = new vm.Script(normalizeSource(input.sourceCode), { filename: "submission.js" });
    script.runInContext(sandbox, { timeout: SANDBOX_TIMEOUT_MS });

    const decide = (sandbox as { __aflDecide?: unknown }).__aflDecide;
    if (typeof decide !== "function") {
      return { ok: false, output: null, durationMs: Date.now() - started, error: "Missing decide(input) export" };
    }

    const output = await withTimeout(Promise.resolve((decide as (arg: unknown) => unknown)(input.payload)), SANDBOX_TIMEOUT_MS);
    if (!isValidOutput(output)) {
      return {
        ok: false,
        output,
        durationMs: Date.now() - started,
        error: "Output validation failed: expected an object result",
      };
    }
    return { ok: true, output, durationMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      output: null,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
