# UPLYFT - Mobile App

React Native (Expo) mobile app for UPLYFT.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (for quick testing), or Xcode (iOS) / Android Studio (Android) for simulators

## Setup

### 1. Install dependencies

```bash
cd mobile-app
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the values:

```env
EXPO_PUBLIC_INSTANT_APP_ID=your_instantdb_app_id
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
EXPO_PUBLIC_OPEN_FOOD_FACTS_USER_AGENT=UPLYFT/1.0
```

- **InstantDB App ID**: Get from [instantdb.com](https://instantdb.com) - same app ID as the web app
- **Groq API Key**: Get from [console.groq.com](https://console.groq.com) - same key as the web app

### 3. Run the app

```bash
# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Open in Expo Go (scan QR code with phone)
npx expo start --tunnel
```

## Project Structure

```
mobile-app/
  src/
    components/       # Shared UI components (GlassCard, LoadingSpinner)
    context/          # React contexts (LocaleContext, MoodContext)
    lib/              # Business logic, API clients, storage helpers
    navigation/       # React Navigation stack and tab definitions
    screens/          # All screens organized by feature
      dashboard/
      training/
      nutrition/
      wellness/
      coach/
      community/
      support/
      settings/
      more/
      onboarding/
    instant.schema.ts # InstantDB schema (mirrors web app schema)
    theme.ts          # Design tokens (colors, spacing, typography, radius)
  App.tsx             # Entry point
  app.json            # Expo config
  babel.config.js     # Babel config with module-resolver for @/ paths
  tsconfig.json       # TypeScript config
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| `@instantdb/react-native` | Real-time database and magic-link auth |
| `groq-sdk` | AI calls via Groq (Llama 4 model) |
| `@react-navigation/native` | Navigation framework |
| `@react-navigation/bottom-tabs` | Bottom tab bar |
| `@react-navigation/native-stack` | Stack navigation |
| `expo-camera` | Barcode scanning (food scanner, machine scanner) |
| `@react-native-async-storage/async-storage` | Persistent local storage (replaces localStorage) |
| `expo-crypto` | UUID generation |
| `react-native-markdown-display` | Markdown rendering in chat |

## Notes

- The mobile app shares the same InstantDB database as the web app - data is synced in real time across platforms.
- The AI file is named `gemini.ts` for consistency with the web app but uses Groq (not Google Gemini).
- All `localStorage` calls from the web app are replaced with `AsyncStorage` via the storage helper in `src/lib/storage.ts`.
- Framer Motion animations are replaced with React Native's `Animated` API.
- Tailwind CSS is replaced with `StyleSheet.create` using the design tokens in `src/theme.ts`.
