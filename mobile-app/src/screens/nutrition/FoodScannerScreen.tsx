import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Image, TextInput, Share, KeyboardAvoidingView, Platform,
} from 'react-native'
import ViewShot from 'react-native-view-shot'
import { useNavigation } from '@react-navigation/native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { fetchProduct, type OFFProduct, type ScanHistoryEntry } from '@/lib/openFoodFacts'
import { scoreProduct, novaColor, type ScoredProduct } from '@/lib/healthScore'
import { loadNutritionProfile } from '@/lib/nutrition'
import { storageGetAsync, storageSetAsync } from '@/lib/storage'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'
import GradientText from '@/components/GradientText'

const HISTORY_KEY = 'tyw_scan_history'
const MAX_HISTORY = 20

const GRADE_EXPLANATION: Record<string, string> = {
  A: 'Excellent nutritional quality.',
  B: 'Good quality with minor concerns.',
  C: 'Average quality - fine in moderation.',
  D: 'Poor quality. Limit how often you eat this.',
  E: 'Very low quality. Consider an alternative.',
}

const NS_COLORS: Record<string, string> = {
  A: '#1e8a3c', B: '#83b830', C: '#f5c92e', D: '#e87d1e', E: '#e53a29',
}

const NOVA_EXPLANATION: Record<number, string> = {
  1: 'Unprocessed or minimally processed. Best choice.',
  2: 'Processed culinary ingredients. Used in cooking.',
  3: 'Processed foods. OK in moderation.',
  4: 'Ultra-processed. Limit these.',
}

type PageState = 'intro' | 'scanning' | 'loading' | 'result' | 'not-found' | 'error'
type ResultTab = 'health' | 'nutrition' | 'details'

async function getScanHistory(): Promise<ScanHistoryEntry[]> {
  try {
    const raw = await storageGetAsync(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as ScanHistoryEntry[]) : []
  } catch { return [] }
}

async function addToScanHistory(entry: ScanHistoryEntry): Promise<void> {
  const history = await getScanHistory()
  const filtered = history.filter(h => h.barcode !== entry.barcode)
  filtered.unshift(entry)
  await storageSetAsync(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)))
}

function MacroRow({ label, value, color }: { label: string; value: number | null; unit: string; color: string }) {
  if (value === null) return null
  return (
    <View style={macroStyles.row}>
      <Text style={macroStyles.label}>{label}</Text>
      <Text style={[macroStyles.value, { color }]}>{value.toFixed(1)}g</Text>
    </View>
  )
}

const macroStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  label: { ...Typography.body, color: Colors.textSecondary },
  value: { ...Typography.body, fontWeight: '700' },
})

export default function FoodScannerScreen() {
  const navigation = useNavigation()
  const userId = getUserId()

  const [permission, requestPermission] = useCameraPermissions()
  const [pageState, setPageState] = useState<PageState>('intro')
  const [barcode, setBarcode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [product, setProduct] = useState<OFFProduct | null>(null)
  const [scored, setScored] = useState<ScoredProduct | null>(null)
  const [history, setHistory] = useState<ScanHistoryEntry[]>([])
  const [resultTab, setResultTab] = useState<ResultTab>('health')
  const [errMsg, setErrMsg] = useState('')
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof loadNutritionProfile>>>(null)
  const scannedRef = useRef(false)
  const viewShotRef = useRef<ViewShot>(null)
  const [sharing, setSharing] = useState(false)

  const handleShareStory = async () => {
    if (!viewShotRef.current) return
    setSharing(true)
    try {
      const uri = await (viewShotRef.current as unknown as { capture: () => Promise<string> }).capture()
      await Share.share({ url: uri, message: 'Scanned with UPLYFT' })
    } catch {
      // user cancelled or share unavailable
    } finally {
      setSharing(false)
    }
  }

  useEffect(() => {
    loadNutritionProfile().then(setProfile)
    getScanHistory().then(setHistory)
  }, [])

  const handleBarcode = async (code: string) => {
    if (scannedRef.current) return
    scannedRef.current = true
    setBarcode(code)
    setPageState('loading')
    try {
      const data = await fetchProduct(code)
      if (!data) { setPageState('not-found'); return }
      const score = scoreProduct(data, profile)
      setProduct(data)
      setScored(score)
      setResultTab('health')
      setPageState('result')
      const entry: ScanHistoryEntry = {
        barcode: code, name: data.product_name || '', brand: data.brands || '',
        grade: score.grade, gradeColor: score.gradeColor, scannedAt: Date.now(),
      }
      await addToScanHistory(entry)
      setHistory(await getScanHistory())
    } catch {
      setErrMsg('Failed to fetch product data. Check your connection.')
      setPageState('error')
    }
  }

  const startScanning = async () => {
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) {
        setErrMsg('Camera permission is required to scan barcodes.')
        setPageState('error')
        return
      }
    }
    scannedRef.current = false
    setPageState('scanning')
  }

  const reset = () => {
    scannedRef.current = false
    setProduct(null)
    setScored(null)
    setBarcode('')
    setErrMsg('')
    setPageState('intro')
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.purple} />
          <Text style={styles.loadingText}>Looking up product...</Text>
          <Text style={styles.loadingSubtext}>Checking Open Food Facts database</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (pageState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <GradientText containerStyle={{ flex: 1 }} style={styles.headerTitle}>Food Scanner</GradientText>
        </View>
        <View style={styles.center}>
          <Text style={{ fontSize: 48, lineHeight: 60, marginBottom: 16 }}>📷</Text>
          <Text style={styles.emptyTitle}>Unavailable</Text>
          <Text style={styles.emptyBody}>{errMsg}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (pageState === 'not-found') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <GradientText containerStyle={{ flex: 1 }} style={styles.headerTitle}>Food Scanner</GradientText>
        </View>
        <View style={styles.center}>
          <Text style={{ fontSize: 48, lineHeight: 60, marginBottom: 16 }}>🔍</Text>
          <Text style={styles.emptyTitle}>Product not found</Text>
          <Text style={styles.emptyBody}>This barcode is not in the Open Food Facts database yet.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={startScanning}>
            <Text style={styles.primaryBtnText}>Try another product</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={reset}>
            <Text style={styles.ghostBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Scanning ───────────────────────────────────────────────────────────────

  if (pageState === 'scanning') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Cancel</Text>
          </TouchableOpacity>
          <GradientText containerStyle={{ flex: 1 }} style={styles.headerTitle}>Scanning</GradientText>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={({ data }) => void handleBarcode(data)}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
            </View>
          </View>
          <View style={styles.scanFooter}>
            <Text style={styles.scanHint}>Point camera at any product barcode</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Or enter barcode manually..."
                placeholderTextColor={Colors.textDim}
                keyboardType="numeric"
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
              <TouchableOpacity
                style={[styles.manualBtn, !manualCode.trim() && styles.manualBtnDisabled]}
                onPress={() => manualCode.trim() && void handleBarcode(manualCode.trim())}
                disabled={!manualCode.trim()}
              >
                <Text style={styles.manualBtnText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────────

  if (pageState === 'result' && product && scored) {
    const n = product.nutriments ?? {}
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <GradientText containerStyle={{ flex: 1 }} style={styles.headerTitle}>Result</GradientText>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Captured card for story sharing */}
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.storyCapture}>
            {/* Product header */}
            <View style={styles.productHeader}>
              {product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <View style={styles.productImagePlaceholder}><Text style={{ fontSize: 32, lineHeight: 42 }}>🛒</Text></View>
              )}
              <View style={styles.productInfo}>
                {product.brands && (
                  <Text style={styles.brand}>{product.brands.split(',')[0].trim()}</Text>
                )}
                <Text style={styles.productName}>{product.product_name || 'Unknown product'}</Text>
              </View>
            </View>

            {/* Grade hero */}
            <View style={[styles.gradeHero, { backgroundColor: scored.gradeBg, borderColor: scored.gradeColor + '55' }]}>
              <Text style={[styles.gradeLetter, { color: scored.gradeColor }]}>{scored.grade}</Text>
              <View style={styles.gradeInfo}>
                <Text style={styles.gradeLabel}>{scored.gradeLabel}</Text>
                <Text style={styles.gradeExpl}>{GRADE_EXPLANATION[scored.grade]}</Text>
                {product.nova_group ? (
                  <View style={styles.novaRow}>
                    {[1, 2, 3, 4].map(i => (
                      <View key={i} style={[styles.novaDot, { backgroundColor: i <= product.nova_group! ? novaColor(product.nova_group!) : 'rgba(255,255,255,0.15)' }]} />
                    ))}
                    <Text style={styles.novaLabel}>NOVA {product.nova_group}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </ViewShot>

          {/* Share button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareStory} disabled={sharing}>
            {sharing
              ? <ActivityIndicator size="small" color={Colors.purpleLight} />
              : <Text style={styles.shareBtnText}>Share as Story</Text>
            }
          </TouchableOpacity>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['health', 'nutrition', 'details'] as ResultTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, resultTab === tab && styles.tabActive]}
                onPress={() => setResultTab(tab)}
              >
                <Text style={[styles.tabText, resultTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Health tab */}
          {resultTab === 'health' && (
            <>
              <GlassCard style={{ gap: Spacing.sm }}>
                <Text style={styles.sectionLabel}>Nutri-Score</Text>
                <View style={styles.nutriScoreRow}>
                  {['A', 'B', 'C', 'D', 'E'].map(g => (
                    <View key={g} style={[styles.nutriBar, {
                      backgroundColor: NS_COLORS[g],
                      opacity: g === scored.grade ? 1 : 0.35,
                      height: g === scored.grade ? 56 : 36,
                    }]}>
                      <Text style={[styles.nutriBarText, { fontSize: g === scored.grade ? 22 : 14 }]}>{g}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
              {product.nova_group ? (
                <GlassCard>
                  <Text style={styles.sectionLabel}>NOVA Group {product.nova_group}</Text>
                  <Text style={styles.novaExpl}>{NOVA_EXPLANATION[product.nova_group]}</Text>
                </GlassCard>
              ) : null}
              {scored.verdicts.length > 0 && (
                <GlassCard>
                  <Text style={styles.sectionLabel}>Key Highlights</Text>
                  <View style={styles.verdictWrap}>
                    {scored.verdicts.map((v, i) => {
                      const bgMap = { positive: 'rgba(34,197,94,0.12)', negative: 'rgba(239,68,68,0.12)', warning: 'rgba(234,179,8,0.12)' }
                      const colorMap = { positive: '#86efac', negative: '#fca5a5', warning: '#fde68a' }
                      return (
                        <View key={i} style={[styles.verdictChip, { backgroundColor: bgMap[v.type] }]}>
                          <Text style={[styles.verdictText, { color: colorMap[v.type] }]}>{v.text}</Text>
                        </View>
                      )
                    })}
                  </View>
                </GlassCard>
              )}
            </>
          )}

          {/* Nutrition tab */}
          {resultTab === 'nutrition' && (
            <GlassCard>
              <Text style={styles.sectionLabel}>Per 100g</Text>
              {n['energy-kcal_100g'] != null && (
                <View style={macroStyles.row}>
                  <Text style={macroStyles.label}>Calories</Text>
                  <Text style={[macroStyles.value, { color: Colors.purple }]}>{Math.round(n['energy-kcal_100g']!)} kcal</Text>
                </View>
              )}
              <MacroRow label="Protein" value={n.proteins_100g ?? null} unit="g" color="#22D3EE" />
              <MacroRow label="Carbs" value={n.carbohydrates_100g ?? null} unit="g" color={Colors.purple} />
              <MacroRow label="Sugars" value={n.sugars_100g ?? null} unit="g" color="#ef4444" />
              <MacroRow label="Fat" value={n.fat_100g ?? null} unit="g" color="#f97316" />
              <MacroRow label="Sat. Fat" value={n['saturated-fat_100g'] ?? null} unit="g" color="#ef4444" />
              <MacroRow label="Fiber" value={n.fiber_100g ?? null} unit="g" color="#22c55e" />
            </GlassCard>
          )}

          {/* Details tab */}
          {resultTab === 'details' && (
            <>
              {scored.allergenWarnings.length > 0 && (
                <GlassCard style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                  <Text style={[styles.sectionLabel, { color: '#ef4444' }]}>Allergen Alert</Text>
                  <View style={styles.verdictWrap}>
                    {scored.allergenWarnings.map((w, i) => (
                      <View key={i} style={[styles.verdictChip, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                        <Text style={[styles.verdictText, { color: '#fca5a5' }]}>{w}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              )}
              {product.ingredients_text ? (
                <GlassCard>
                  <Text style={styles.sectionLabel}>Ingredients</Text>
                  <Text style={styles.ingredients}>{product.ingredients_text}</Text>
                </GlassCard>
              ) : null}
              <GlassCard>
                <Text style={styles.sectionLabel}>Community Rating</Text>
                <GymRatingWidget barcode={barcode} userId={userId} />
              </GlassCard>
              {(scored.grade === 'A' || scored.grade === 'B') && (
                <AddToFindsButton product={product} scored={scored} barcode={barcode} userId={userId} />
              )}
            </>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={startScanning}>
            <Text style={styles.primaryBtnText}>Scan another</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Intro ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <GradientText containerStyle={{ flex: 1 }} style={styles.headerTitle}>Food Scanner</GradientText>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.heroCard}>
          <Text style={styles.heroTag}>Powered by Open Food Facts</Text>
          <GradientText style={styles.heroTitle}>Know what's inside your food</GradientText>
          <Text style={styles.heroDesc}>
            Scan a barcode for a health report covering nutrition, additives, allergens, and whether it fits your goals.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={startScanning}>
            <Text style={styles.primaryBtnText}>Start Scanning</Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.featureGrid}>
          {[
            { icon: '🏆', label: 'Score A-E', desc: 'Science-backed grade' },
            { icon: '📊', label: 'Macros', desc: 'Per 100g breakdown' },
            { icon: '🚨', label: 'Allergens', desc: 'Personal restriction flags' },
            { icon: '🎯', label: 'Goal Match', desc: 'Fits your nutrition goals' },
          ].map(f => (
            <GlassCard key={f.label} style={styles.featureCard}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</Text>
              <Text style={styles.featureName}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </GlassCard>
          ))}
        </View>

        {history.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent Scans</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              <View style={styles.historyRow}>
                {history.map(h => (
                  <TouchableOpacity key={h.barcode} style={styles.historyItem} onPress={() => void handleBarcode(h.barcode)}>
                    <View style={[styles.gradeChip, { backgroundColor: h.gradeColor }]}>
                      <Text style={styles.gradeChipText}>{h.grade}</Text>
                    </View>
                    <Text style={styles.historyName} numberOfLines={1}>{h.name || 'Unknown'}</Text>
                    <Text style={styles.historyBrand} numberOfLines={1}>{h.brand || h.barcode}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function GymRatingWidget({ barcode, userId }: { barcode: string; userId: string }) {
  const { data } = db.useQuery({ gymRatings: { $: { where: { barcode } } } })
  const ratings = (data?.gymRatings ?? []) as Array<{ id: string; userId: string; rating: number }>
  const myRating = ratings.find(r => r.userId === userId)
  const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null

  const handleRate = async (stars: number) => {
    if (myRating) {
      await db.transact(db.tx.gymRatings[myRating.id].update({ rating: stars }))
    } else {
      await db.transact(db.tx.gymRatings[id()].update({ barcode, userId, rating: stars, createdAt: Date.now() }))
    }
  }

  return (
    <View>
      <View style={styles.ratingHeader}>
        <Text style={styles.ratingLabel}>Community Rating</Text>
        {avg !== null && <Text style={styles.ratingAvg}>{avg.toFixed(1)} avg - {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}</Text>}
      </View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => void handleRate(star)} style={styles.starBtn}>
            <Text style={{ fontSize: 28, color: myRating && star <= myRating.rating ? '#facc15' : 'rgba(255,255,255,0.2)' }}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function AddToFindsButton({ product, scored, barcode, userId }: { product: OFFProduct; scored: ScoredProduct; barcode: string; userId: string }) {
  const { data } = db.useQuery({ communityFinds: { $: { where: { barcode, sharedBy: userId } } } })
  const alreadyShared = ((data?.communityFinds ?? []) as unknown[]).length > 0

  const handleAdd = async () => {
    await db.transact(db.tx.communityFinds[id()].update({
      barcode, productName: product.product_name || '', brand: product.brands?.split(',')[0]?.trim() || '',
      grade: scored.grade, gradeColor: scored.gradeColor, imageUrl: product.image_url || '',
      sharedBy: userId, sharedAt: Date.now(),
    }))
  }

  if (alreadyShared) {
    return <Text style={styles.alreadyShared}>Added to Healthy Finds</Text>
  }

  return (
    <TouchableOpacity style={styles.findsBtn} onPress={() => void handleAdd()}>
      <Text style={styles.findsBtnText}>+ Add to Healthy Finds</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTitle: { ...Typography.h3, flex: 1 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  loadingText: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
  loadingSubtext: { ...Typography.bodySmall, color: Colors.textMuted },
  emptyTitle: { ...Typography.h3, textAlign: 'center' },
  emptyBody: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  heroCard: { gap: Spacing.sm },
  heroTag: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: Colors.purpleLight, textTransform: 'uppercase' },
  heroTitle: { ...Typography.h3, fontSize: 22 },
  heroDesc: { ...Typography.body, color: Colors.textMuted, lineHeight: 22 },
  primaryBtn: { backgroundColor: Colors.purple, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  featureCard: { width: '47%', gap: 4 },
  featureName: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  featureDesc: { ...Typography.caption, color: Colors.textMuted },
  sectionLabel: { ...Typography.label, marginBottom: 8 },
  historyRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: 4 },
  historyItem: { alignItems: 'center', gap: 4, width: 100, padding: Spacing.sm, backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder },
  gradeChip: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gradeChipText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  historyName: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  historyBrand: { fontSize: 10, color: Colors.textDim, textAlign: 'center' },
  scannerContainer: { flex: 1 },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 240, height: 160, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.purple },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanFooter: { padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.bg },
  scanHint: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },
  manualRow: { flexDirection: 'row', gap: Spacing.sm },
  manualInput: { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, color: Colors.textPrimary, fontSize: 15, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  manualBtn: { backgroundColor: Colors.purple, borderRadius: Radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  manualBtnDisabled: { opacity: 0.4 },
  manualBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  productHeader: { flexDirection: 'row', gap: Spacing.md, marginBottom: 4 },
  productImage: { width: 80, height: 80, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  productImagePlaceholder: { width: 80, height: 80, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  brand: { fontSize: 11, color: Colors.textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  productName: { ...Typography.h3, fontSize: 18, lineHeight: 24 },
  gradeHero: { borderRadius: Radius.xl, padding: Spacing.md, flexDirection: 'row', gap: Spacing.md, alignItems: 'center', borderWidth: 1.5, marginBottom: 4 },
  gradeLetter: { fontSize: 56, fontWeight: '900', lineHeight: 64 },
  gradeInfo: { flex: 1, gap: 4 },
  gradeLabel: { ...Typography.h3, fontSize: 20 },
  gradeExpl: { ...Typography.bodySmall, color: Colors.textMuted },
  novaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  novaDot: { width: 8, height: 8, borderRadius: 4 },
  novaLabel: { ...Typography.caption, color: Colors.textMuted },
  novaExpl: { ...Typography.body, color: Colors.textMuted, lineHeight: 22 },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, padding: 4, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.purpleDim },
  tabText: { ...Typography.body, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.purpleLight },
  nutriScoreRow: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  nutriBar: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  nutriBarText: { color: '#fff', fontWeight: '900' },
  verdictWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  verdictChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  verdictText: { fontSize: 12, fontWeight: '600' },
  ingredients: { ...Typography.bodySmall, color: Colors.textMuted, lineHeight: 20 },
  ratingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  ratingLabel: { ...Typography.label },
  ratingAvg: { ...Typography.caption, color: Colors.textMuted },
  starsRow: { flexDirection: 'row', gap: 4 },
  starBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  findsBtn: { backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', paddingVertical: 16, alignItems: 'center' },
  findsBtnText: { color: '#86efac', fontWeight: '700', fontSize: 15 },
  alreadyShared: { textAlign: 'center', ...Typography.bodySmall, color: Colors.textDim, paddingVertical: 12 },
  storyCapture: { backgroundColor: Colors.bg },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.purpleBorder, backgroundColor: Colors.purpleDim },
  shareBtnText: { color: Colors.purpleLight, fontWeight: '700', fontSize: 14 },
})

