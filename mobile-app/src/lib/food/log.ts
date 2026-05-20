const DEBUG = __DEV__

export function foodLog(event: string, barcode: string, detail?: string): void {
  if (!DEBUG) return
  const ts = new Date().toISOString().slice(11, 23)
  const parts = [`[food:${event}]`, barcode]
  if (detail) parts.push(detail)
  console.log(`${ts} ${parts.join(' ')}`)
}
