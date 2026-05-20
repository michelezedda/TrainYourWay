import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { db } from '@/lib/db'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'

const { width: W } = Dimensions.get('window')

type AuthStep = 'email' | 'code'

export default function AuthScreen() {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const sendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await db.auth.sendMagicCode({ email: email.trim().toLowerCase() })
      setStep('code')
    } catch (e) {
      setError('Failed to send verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    if (!code.trim() || code.length < 4) {
      setError('Please enter the 6-digit code from your email.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await db.auth.signInWithMagicCode({ email: email.trim().toLowerCase(), code: code.trim() })
    } catch (e) {
      setError('Invalid or expired code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Background gradient tint */}
      <LinearGradient
        colors={['#0f0a2e', Colors.bg]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Ambient orbs */}
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />

      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.titleRow}>
                {step === 'email' ? (
                  <>
                    <Text style={styles.title}>Sign in to </Text>
                    <GradientText style={styles.titleGrad}>UPLYFT</GradientText>
                  </>
                ) : (
                  <Text style={styles.title}>Check your email</Text>
                )}
              </View>
              <Text style={styles.subtitle}>
                {step === 'email'
                  ? 'Enter your email to receive a magic sign-in code.'
                  : `We sent a 6-digit code to ${email}`}
              </Text>
            </View>

            <View style={styles.form}>
              {step === 'email' ? (
                <>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Email address</Text>
                    <TextInput
                      style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                      value={email}
                      onChangeText={text => { setEmail(text); setError(null) }}
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.textDim}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      returnKeyType="send"
                      onSubmitEditing={sendCode}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      underlineColorAndroid="transparent"
                      selectionColor="#A855F7"
                    />
                  </View>

                  {error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    onPress={sendCode}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={styles.primaryBtnWrap}
                  >
                    <LinearGradient
                      colors={['#A855F7', '#22D3EE']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.primaryBtnText}>Continue</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Verification code</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput, focusedField === 'code' && styles.inputFocused]}
                      value={code}
                      onChangeText={text => { setCode(text.replace(/\D/g, '')); setError(null) }}
                      placeholder="000000"
                      placeholderTextColor={Colors.textDim}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={verifyCode}
                      onFocus={() => setFocusedField('code')}
                      onBlur={() => setFocusedField(null)}
                      underlineColorAndroid="transparent"
                      selectionColor="#A855F7"
                    />
                  </View>

                  {error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    onPress={verifyCode}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={styles.primaryBtnWrap}
                  >
                    <LinearGradient
                      colors={['#A855F7', '#22D3EE']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.primaryBtnText}>Verify Code</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => { setStep('email'); setCode(''); setError(null) }}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backBtnText}>Use a different email</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={styles.legal}>
              By continuing you agree to our Terms of Service and Privacy Policy.
              Your data is synced securely across your devices.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  // Ambient orbs
  orb1: {
    position: 'absolute', top: '-15%', left: '-20%',
    width: W * 0.75, height: W * 0.75, borderRadius: W * 0.375,
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 0 },
    shadowRadius: 100, shadowOpacity: 0.25,
  },
  orb2: {
    position: 'absolute', bottom: '-15%', right: '-20%',
    width: W * 0.75, height: W * 0.75, borderRadius: W * 0.375,
    shadowColor: '#22D3EE', shadowOffset: { width: 0, height: 0 },
    shadowRadius: 100, shadowOpacity: 0.18,
  },

  scroll: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.xl },
  header: { gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  title: { ...Typography.h1, fontSize: 28 },
  titleGrad: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, color: Colors.purple },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  form: { gap: Spacing.md },
  inputWrapper: { gap: Spacing.xs },
  inputLabel: { ...Typography.label },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: Colors.purple,
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  codeInput: {
    letterSpacing: 8,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '700',
  },

  // Gradient primary button
  primaryBtnWrap: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24,
    shadowOpacity: 0.45,
    marginTop: Spacing.xs,
  },
  primaryBtn: {
    borderRadius: Radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  backBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  backBtnText: { color: Colors.purpleLight, fontSize: 15, fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },
  legal: { ...Typography.caption, textAlign: 'center', color: Colors.textDim, lineHeight: 16 },
})
