// Журнал для диагностики: последние ошибки и предупреждения страницы.
// Показывается в записке «3D-комната погасла», чтобы причину можно было прислать скриншотом.

export const diagLog: string[] = [];
const t0 = performance.now();

const NOISE = /THREE\.Clock|PCFSoftShadowMap|\/api\/health|Failed to fetch/;

export function diag(line: string) {
  if (NOISE.test(line)) return;
  const s = `${((performance.now() - t0) / 1000).toFixed(1)}с ${line}`.slice(0, 300);
  if (diagLog[diagLog.length - 1] === s) return;
  diagLog.push(s);
  if (diagLog.length > 40) diagLog.shift();
}

const str = (a: unknown[]) =>
  a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(" ");

for (const k of ["error", "warn"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => {
    diag(`${k === "error" ? "✖" : "⚠"} ${str(a)}`);
    orig(...a);
  };
}
window.addEventListener("error", (e) => diag(`✖ ${e.message} @${e.filename?.slice(-30)}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => diag(`✖ promise: ${str([e.reason])}`));
