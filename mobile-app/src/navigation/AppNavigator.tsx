import { useRef } from 'react'
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import Svg, { Path, Rect } from 'react-native-svg'
import { Colors, Radius } from '@/theme'
import type {
  AppTabParamList,
  WellnessStackParamList,
  TrainingStackParamList,
  DietStackParamList,
  MeStackParamList,
} from './types'

import DashboardScreen from '@/screens/dashboard/DashboardScreen'
import WorkoutScreen from '@/screens/training/WorkoutScreen'
import ReevaluateScreen from '@/screens/training/ReevaluateScreen'
import ImportScreen from '@/screens/training/ImportScreen'
import DietScreen from '@/screens/nutrition/DietScreen'
import FoodScannerScreen from '@/screens/nutrition/FoodScannerScreen'
import WellnessScreen from '@/screens/wellness/WellnessScreen'
import BreathingScreen from '@/screens/wellness/BreathingScreen'
import FocusScreen from '@/screens/wellness/FocusScreen'
import JournalScreen from '@/screens/wellness/JournalScreen'
import AffirmationsScreen from '@/screens/wellness/AffirmationsScreen'
import SessionScreen from '@/screens/wellness/SessionScreen'
import SettingsScreen from '@/screens/settings/SettingsScreen'
import CommunityScreen from '@/screens/community/CommunityScreen'
import SupportScreen from '@/screens/support/SupportScreen'
import MachineScannerScreen from '@/screens/training/MachineScannerScreen'

const Tab = createBottomTabNavigator<AppTabParamList>()
const WellnessStack = createNativeStackNavigator<WellnessStackParamList>()
const TrainingStack = createNativeStackNavigator<TrainingStackParamList>()
const DietStack = createNativeStackNavigator<DietStackParamList>()
const MeStack = createNativeStackNavigator<MeStackParamList>()

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.bg },
  animation: 'slide_from_right' as const,
}

// Exported so screens can use it for bottom padding
export const TAB_BAR_HEIGHT = 80

function WellnessNavigator() {
  return (
    <WellnessStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <WellnessStack.Screen name="WellnessHome" component={WellnessScreen} />
      <WellnessStack.Screen name="Breathing" component={BreathingScreen} />
      <WellnessStack.Screen name="Focus" component={FocusScreen} />
      <WellnessStack.Screen name="Journal" component={JournalScreen} />
      <WellnessStack.Screen name="Affirmations" component={AffirmationsScreen} />
      <WellnessStack.Screen name="Session" component={SessionScreen} />
    </WellnessStack.Navigator>
  )
}

function TrainingNavigator() {
  return (
    <TrainingStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <TrainingStack.Screen name="WorkoutHome" component={WorkoutScreen} />
      <TrainingStack.Screen name="Reevaluate" component={ReevaluateScreen} />
      <TrainingStack.Screen name="Import" component={ImportScreen} />
    </TrainingStack.Navigator>
  )
}

function DietNavigator() {
  return (
    <DietStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <DietStack.Screen name="DietHome" component={DietScreen} />
      <DietStack.Screen name="FoodScanner" component={FoodScannerScreen} />
    </DietStack.Navigator>
  )
}

function MeNavigator() {
  return (
    <MeStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <MeStack.Screen name="MeHome" component={SettingsScreen} />
      <MeStack.Screen name="Community" component={CommunityScreen} />
      <MeStack.Screen name="Support" component={SupportScreen} />
      <MeStack.Screen name="MachineScanner" component={MachineScannerScreen} />
    </MeStack.Navigator>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

type TabName = keyof AppTabParamList

// Tabs that exist in the navigator for programmatic navigation but have no visible button
const HIDDEN_TABS: TabName[] = ['Wellness']

interface TabConfig {
  name: TabName
  label: string
  Icon: (props: { focused: boolean }) => React.ReactElement
}

// ── Pixel-perfect SVG icons extracted from the web app's react-icons ──────────

function ForkKnifeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 256 256" fill="none">
      <Path d="M208,40V168H152S152,64,208,40Z" fill={color} opacity={0.2} />
      <Path d="M72,88V40a8,8,0,0,1,16,0V88a8,8,0,0,1-16,0ZM216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40ZM200,53.9c-32.17,24.57-38.47,84.42-39.7,106.1H200ZM119.89,38.69a8,8,0,1,0-15.78,2.63L112,88.63a32,32,0,0,1-64,0l7.88-47.31a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z" fill={color} />
    </Svg>
  )
}

function HomeOptionIcon({ color, strokeWidth }: { color: string; strokeWidth: number }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={4} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  )
}

function UserGearIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 256 256" fill={color}>
      <Path d="M139,158.25a66,66,0,1,0-62,0c-22,6.23-41.88,19.16-57.61,37.89a6,6,0,0,0,9.18,7.72C49.1,179.44,77.31,166,108,166s58.9,13.44,79.41,37.86a6,6,0,1,0,9.18-7.72C180.86,177.41,161,164.48,139,158.25ZM54,100a54,54,0,1,1,54,54A54.06,54.06,0,0,1,54,100Zm197.25,44.8-5.92-3.41a22,22,0,0,0,0-10.78l5.92-3.41a6,6,0,0,0-6-10.4l-5.93,3.43a22,22,0,0,0-9.32-5.39V108a6,6,0,0,0-12,0v6.84a22,22,0,0,0-9.32,5.39l-5.93-3.43a6,6,0,0,0-6,10.4l5.92,3.41a22,22,0,0,0,0,10.78l-5.92,3.41a6,6,0,0,0,6,10.4l5.93-3.43a22,22,0,0,0,9.32,5.39V164a6,6,0,0,0,12,0v-6.84a22,22,0,0,0,9.32-5.39l5.93,3.43a6,6,0,0,0,6-10.4ZM224,146a10,10,0,1,1,10-10A10,10,0,0,1,224,146Z" />
    </Svg>
  )
}

const TAB_CONFIGS: TabConfig[] = [
  {
    name: 'Workout',
    label: 'Workout',
    Icon: ({ focused }) => (
      <MaterialCommunityIcons
        name="dumbbell"
        size={22}
        color={focused ? Colors.purpleLight : 'rgba(255,255,255,0.38)'}
      />
    ),
  },
  {
    name: 'Diet',
    label: 'Diet',
    Icon: ({ focused }) => (
      <ForkKnifeIcon color={focused ? Colors.purpleLight : 'rgba(255,255,255,0.38)'} />
    ),
  },
  {
    name: 'Dashboard',
    label: 'Home',
    Icon: ({ focused }) => (
      <HomeOptionIcon
        color={focused ? '#e9d5ff' : 'rgba(255,255,255,0.5)'}
        strokeWidth={focused ? 2.2 : 1.8}
      />
    ),
  },
  {
    name: 'Scanner',
    label: 'Food Scan',
    Icon: ({ focused }) => (
      <Ionicons
        name="barcode-outline"
        size={22}
        color={focused ? Colors.purpleLight : 'rgba(255,255,255,0.38)'}
      />
    ),
  },
  {
    name: 'Me',
    label: 'Settings',
    Icon: ({ focused }) => (
      <UserGearIcon color={focused ? Colors.purpleLight : 'rgba(255,255,255,0.38)'} />
    ),
  },
]

interface AnimatedTabProps {
  config: TabConfig
  focused: boolean
  isHome: boolean
  onPress: () => void
}

function AnimatedTab({ config, focused, isHome, onPress }: AnimatedTabProps) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = () =>
    Animated.timing(scale, { toValue: 0.95, duration: 100, useNativeDriver: true }).start()
  const handlePressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }).start()

  const labelColor = isHome
    ? focused ? '#e9d5ff' : 'rgba(255,255,255,0.45)'
    : focused ? '#d8b4fe' : 'rgba(255,255,255,0.38)'

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={tabStyles.tabOuter}
    >
      <Animated.View style={[tabStyles.tabAnimated, { transform: [{ scale }] }]}>
        {isHome ? (
          <View style={[tabStyles.homeTab, focused && tabStyles.homeTabActive]}>
            {focused && (
              <View style={[StyleSheet.absoluteFillObject, tabStyles.homeGradWrap]}>
                <LinearGradient
                  colors={['rgba(168,85,247,0.25)', 'rgba(34,211,238,0.15)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            )}
            <config.Icon focused={focused} />
            <Text style={[tabStyles.label, { color: labelColor, fontWeight: '600' }]}>
              {config.label}
            </Text>
            <View style={[tabStyles.dot, { opacity: focused ? 1 : 0 }]} />
          </View>
        ) : (
          <View style={[tabStyles.tab, focused && tabStyles.tabActive]}>
            <config.Icon focused={focused} />
            <Text style={[tabStyles.label, { color: labelColor }]}>
              {config.label}
            </Text>
            <View style={[tabStyles.dot, { opacity: focused ? 1 : 0 }]} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0)

  const visibleRoutes = state.routes.filter(r => !HIDDEN_TABS.includes(r.name as TabName))

  return (
    <View style={[tabStyles.container, { paddingBottom: bottomPad }]}>
      <View style={tabStyles.pill}>
        {/* ── Pill material ── */}
        <View style={[StyleSheet.absoluteFillObject, tabStyles.pillTint]} />
        {/* Top specular rim — Apple rim lighting on the glass edge */}
        <View style={tabStyles.pillRim} pointerEvents="none" />
        {visibleRoutes.map(route => {
          const routeIndex = state.routes.indexOf(route)
          const focused = state.index === routeIndex
          const isHome = route.name === 'Dashboard'
          const config = TAB_CONFIGS.find(c => c.name === route.name)
          if (!config) return null

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
          }

          return (
            <AnimatedTab
              key={route.key}
              config={config}
              focused={focused}
              isHome={isHome}
              onPress={onPress}
            />
          )
        })}
      </View>
    </View>
  )
}

const tabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    // No backgroundColor here — absolute BlurView + tint handles it.
    // overflow:hidden is critical: clips BlurView to pill shape.
    overflow: 'hidden',
    borderRadius: Radius.full,
    borderWidth: 1,
    // Slightly brighter border than before (glass edge catches light)
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
    width: '100%',
    maxWidth: 420,
    marginBottom: 8,
    // Multi-layer shadow: ambient (large) + key light (close, sharp)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 20,
  },
  pillTint: {
    backgroundColor: 'rgba(6,6,18,0.92)',
  },
  // Apple rim lighting: thin bright line at the top glass edge
  pillRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    zIndex: 1,
  },
  tabOuter: {
    flex: 1,
  },
  tabAnimated: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.full,
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    // Slightly stronger fill so it reads clearly above the frosted blur layer
    backgroundColor: 'rgba(192,132,252,0.16)',
    borderColor: 'rgba(168,85,247,0.28)',
  },
  homeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  homeTabActive: {
    borderColor: 'rgba(168,85,247,0.35)',
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  homeGradWrap: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c084fc',
    shadowColor: '#c084fc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
})

// ── Root tab navigator ─────────────────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Workout" component={TrainingNavigator} />
      <Tab.Screen name="Diet" component={DietNavigator} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Wellness" component={WellnessNavigator} />
      <Tab.Screen name="Scanner" component={FoodScannerScreen} />
      <Tab.Screen name="Me" component={MeNavigator} />
    </Tab.Navigator>
  )
}
