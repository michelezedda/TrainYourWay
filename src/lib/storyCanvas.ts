import type { OFFProduct } from './openFoodFacts'
import type { ScoredProduct } from './healthScore'

const W = 1080
const H = 1920
const FONT = "'Helvetica Neue', Arial, sans-serif"

function createCtx(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  return [canvas, ctx]
}

function drawBg(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H)
  bg.addColorStop(0, '#080818')
  bg.addColorStop(0.5, '#0a0a1a')
  bg.addColorStop(1, '#050510')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow1 = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, 500)
  glow1.addColorStop(0, 'rgba(168,85,247,0.2)')
  glow1.addColorStop(1, 'rgba(168,85,247,0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  const glow2 = ctx.createRadialGradient(W * 0.2, H * 0.85, 0, W * 0.2, H * 0.85, 400)
  glow2.addColorStop(0, 'rgba(34,211,238,0.14)')
  glow2.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)
}

function drawHeader(ctx: CanvasRenderingContext2D, subtitle: string) {
  const grad = ctx.createLinearGradient(W / 2 - 140, 0, W / 2 + 140, 0)
  grad.addColorStop(0, '#A855F7')
  grad.addColorStop(1, '#ec4899')

  ctx.save()
  ctx.font = `900 80px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = grad
  ctx.fillText('UPLYFT', W / 2, 80)

  ctx.font = `400 42px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText(subtitle, W / 2, 185)
  ctx.restore()
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawGradeCircle(
  ctx: CanvasRenderingContext2D,
  grade: string,
  color: string,
  bg: string,
  cx: number,
  cy: number,
) {
  const r = 200
  const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.8)
  glow.addColorStop(0, color + '28')
  glow.addColorStop(1, color + '00')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 10
  ctx.stroke()

  ctx.save()
  ctx.font = `900 260px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(grade, cx, cy + 12)
  ctx.restore()
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function divider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(80, y)
  ctx.lineTo(W - 80, y)
  ctx.stroke()
  ctx.restore()
}

function footer(ctx: CanvasRenderingContext2D, text: string) {
  const y = H - 240
  divider(ctx, y)
  ctx.save()
  ctx.font = `400 44px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(text, W / 2, y + 65)
  ctx.restore()
}

// ── Product story ─────────────────────────────────────────────────────────────

export async function generateProductStory(
  product: OFFProduct,
  scored: ScoredProduct,
): Promise<File> {
  const [canvas, ctx] = createCtx()

  drawBg(ctx)
  drawHeader(ctx, 'Food Scanner')

  const gradeY = 640
  drawGradeCircle(ctx, scored.grade, scored.gradeColor, scored.gradeBg, W / 2, gradeY)

  ctx.save()
  ctx.textAlign = 'center'

  ctx.font = `700 84px ${FONT}`
  ctx.fillStyle = scored.gradeColor
  ctx.textBaseline = 'top'
  ctx.fillText(scored.gradeLabel, W / 2, gradeY + 240)

  ctx.font = `400 44px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText('health grade', W / 2, gradeY + 344)

  const productName = product.product_name || 'Unknown Product'
  const brand = product.brands?.split(',')[0]?.trim() || ''

  ctx.font = `700 64px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(truncate(ctx, productName, W - 140), W / 2, gradeY + 460)

  if (brand) {
    ctx.font = `400 46px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText(truncate(ctx, brand, W - 180), W / 2, gradeY + 550)
  }
  ctx.restore()

  // Verdict chips
  const chipColors = {
    positive: { bg: 'rgba(34,197,94,0.2)',  border: 'rgba(34,197,94,0.5)',  text: '#86efac' },
    negative: { bg: 'rgba(239,68,68,0.2)',  border: 'rgba(239,68,68,0.5)',  text: '#fca5a5' },
    warning:  { bg: 'rgba(234,179,8,0.2)',  border: 'rgba(234,179,8,0.5)',  text: '#fde68a' },
  }
  const top4 = scored.verdicts.slice(0, 4)
  ctx.font = `500 38px ${FONT}`
  const PAD = 42
  const GAP = 22
  const CHIP_H = 78
  const totalW = top4.reduce((s, v) => s + ctx.measureText(v.text).width + PAD * 2, 0) + GAP * (top4.length - 1)
  let chipX = Math.max(60, (W - Math.min(totalW, W - 120)) / 2)
  const chipY = gradeY + 670

  for (const v of top4) {
    const textW = ctx.measureText(v.text).width
    const chipW = textW + PAD * 2
    if (chipX + chipW > W - 60) break
    const c = chipColors[v.type]
    rrect(ctx, chipX, chipY, chipW, CHIP_H, CHIP_H / 2)
    ctx.fillStyle = c.bg
    ctx.fill()
    ctx.strokeStyle = c.border
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.save()
    ctx.fillStyle = c.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(v.text, chipX + chipW / 2, chipY + CHIP_H / 2)
    ctx.restore()
    chipX += chipW + GAP
  }

  footer(ctx, 'Scan your food on UPLYFT')

  return canvasToFile(canvas, 'uplyft-scan.png')
}

// ── Streak story ──────────────────────────────────────────────────────────────

export async function generateStreakStory(
  mealStreak: number,
  workoutStreak: number,
  mealDates: string[],
  workoutDates: string[],
  today: string,
): Promise<File> {
  const [canvas, ctx] = createCtx()

  drawBg(ctx)
  drawHeader(ctx, 'Daily Streaks')

  ctx.save()
  ctx.font = `900 108px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('MY STREAKS', W / 2, 320)
  ctx.restore()

  // Streak cards
  const CARD_W = 460
  const CARD_H = 520
  const GAP = 40
  const leftX = (W - CARD_W * 2 - GAP) / 2
  const rightX = leftX + CARD_W + GAP
  const cardY = 520

  function streakCard(x: number, label: string, value: number, gradStart: string, gradEnd: string, stroke: string) {
    rrect(ctx, x, cardY, CARD_W, CARD_H, 52)
    const g = ctx.createLinearGradient(x, cardY, x + CARD_W, cardY + CARD_H)
    g.addColorStop(0, gradStart)
    g.addColorStop(1, gradEnd)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = `500 42px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textBaseline = 'top'
    ctx.fillText(label, x + CARD_W / 2, cardY + 68)

    ctx.font = `900 190px ${FONT}`
    ctx.fillStyle = stroke
    ctx.fillText(String(value), x + CARD_W / 2, cardY + 130)

    ctx.font = `400 42px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('days', x + CARD_W / 2, cardY + 390)
    ctx.restore()
  }

  streakCard(leftX, 'Meal Streak', mealStreak, 'rgba(168,85,247,0.22)', 'rgba(236,72,153,0.16)', '#A855F7')
  streakCard(rightX, 'Workout Streak', workoutStreak, 'rgba(34,211,238,0.18)', 'rgba(52,211,153,0.12)', '#22D3EE')

  // 7-day activity dots
  const mealSet = new Set(mealDates)
  const wkSet = new Set(workoutDates)

  function shiftBack(s: string, n: number): string {
    const d = new Date(s + 'T12:00:00')
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const last7 = Array.from({ length: 7 }, (_, i) => shiftBack(today, 6 - i))
  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const DOT_R = 32
  const DOT_SPACING = 112
  const dotsTotal = last7.length * DOT_SPACING
  const dotsStartX = (W - dotsTotal) / 2 + DOT_SPACING / 2
  const dotsY = cardY + CARD_H + 100

  ctx.save()
  ctx.font = `500 34px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('Last 7 days', W / 2, dotsY - 60)
  ctx.restore()

  last7.forEach((dateStr, i) => {
    const cx = dotsStartX + i * DOT_SPACING
    const letter = DAY_LETTERS[new Date(dateStr + 'T12:00:00').getDay()]

    ctx.beginPath()
    ctx.arc(cx, dotsY + DOT_R, DOT_R, 0, Math.PI * 2)
    ctx.fillStyle = mealSet.has(dateStr) ? 'rgba(168,85,247,0.85)' : 'rgba(255,255,255,0.08)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, dotsY + DOT_R * 3 + 20, DOT_R, 0, Math.PI * 2)
    ctx.fillStyle = wkSet.has(dateStr) ? 'rgba(34,211,238,0.85)' : 'rgba(255,255,255,0.08)'
    ctx.fill()

    ctx.save()
    ctx.font = `500 30px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(letter, cx, dotsY + DOT_R * 4 + 36)
    ctx.restore()
  })

  // Legend
  const legendY = dotsY + DOT_R * 5 + 80
  ctx.beginPath()
  ctx.arc(W / 2 - 210, legendY + 18, 18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(168,85,247,0.85)'
  ctx.fill()
  ctx.save()
  ctx.font = `400 38px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Meal', W / 2 - 181, legendY + 18)
  ctx.restore()

  ctx.beginPath()
  ctx.arc(W / 2 + 60, legendY + 18, 18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(34,211,238,0.85)'
  ctx.fill()
  ctx.save()
  ctx.font = `400 38px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Workout', W / 2 + 89, legendY + 18)
  ctx.restore()

  // Motivational
  const quoteY = legendY + 90
  ctx.save()
  ctx.font = `700 56px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('Stay consistent.', W / 2, quoteY)
  ctx.fillText('Every day counts.', W / 2, quoteY + 80)
  ctx.restore()

  footer(ctx, 'Track your streaks on UPLYFT')

  return canvasToFile(canvas, 'uplyft-streak.png')
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Canvas export failed')); return }
      resolve(new File([blob], filename, { type: 'image/png' }))
    }, 'image/png')
  })
}

export async function shareOrDownload(file: File, title: string): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title })
  } else {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}
