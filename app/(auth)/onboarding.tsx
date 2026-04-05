import AtmosphericBackground from '@/components/AtmosphericBackground';
import HapticPressable from '@/components/HapticPressable';
import { useAuth } from '@/providers/AuthProvider';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Award, ChevronRight, Compass, Sparkles, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Earn Everywhere',
    desc: 'Scan the QR code at your favorite local shops to instantly earn loyalty points.',
    icon: Wallet,
    accent: '#6366f1',
  },
  {
    id: '2',
    title: 'Discover Nearby',
    desc: 'Find hidden gems and new trending spots with our interactive discovery engine.',
    icon: Compass,
    accent: '#3b82f6',
  },
  {
    id: '3',
    title: 'Elite Status',
    desc: 'Level up from Bronze to Gold and unlock exclusive VIP perks and massive discounts.',
    icon: Award,
    accent: '#d97706',
  }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [currentIdx, setCurrentIdx] = useState(0);

  const slide = SLIDES[currentIdx];
  const Icon = slide.icon;

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentIdx < SLIDES.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      await completeOnboarding();
    }
  };

  const handleSkip = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding();
  };

  return (
    <View style={styles.container}>
      <AtmosphericBackground
        primaryColor={slide.accent}
        secondaryColor={currentIdx === 2 ? '#f59e0b' : '#a855f7'}
      />

      <View style={styles.content}>
        {/* Skip button (only if not on last slide) */}
        {currentIdx < SLIDES.length - 1 && (
          <HapticPressable style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </HapticPressable>
        )}

        <View style={styles.slideWrapper}>
          {/* Animated Icon Container */}
          <View style={styles.iconContainer}>
            <Animated.View
              key={`icon-${currentIdx}`}
              entering={FadeIn.duration(800)}
              exiting={FadeOut.duration(400)}
              style={styles.iconWrapper}
            >
              <Icon size={100} color="#fff" strokeWidth={1.5} />
            </Animated.View>
          </View>

          {/* Glassmorphic Slide Information */}
          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <Animated.View
              key={`text-${currentIdx}`}
              entering={SlideInRight.springify()}
              exiting={SlideOutLeft.duration(300)}
              style={styles.textContainer}
            >
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.desc}>{slide.desc}</Text>
            </Animated.View>
          </BlurView>
        </View>

        {/* Interaction Footer */}
        <View style={styles.footer}>
          {/* Navigation Dots */}
          <View style={styles.pagination}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { width: i === currentIdx ? 24 : 8, backgroundColor: i === currentIdx ? '#fff' : 'rgba(255,255,255,0.2)' }
                ]}
              />
            ))}
          </View>

          {/* High-Performance Action Button */}
          <HapticPressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {currentIdx === SLIDES.length - 1 ? 'Start Now' : 'Continue'}
            </Text>
            <View style={styles.nextBtnIcon}>
              {currentIdx === SLIDES.length - 1 ? <Sparkles size={20} color="#000" /> : <ChevronRight size={20} color="#000" />}
            </View>
          </HapticPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 30 },
  skipBtn: { alignSelf: 'flex-end', padding: 12 },
  skipText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600' },
  slideWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconContainer: { marginBottom: 40, alignItems: 'center', justifyContent: 'center' },
  iconWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCard: {
    width: '100%',
    padding: 32,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  textContainer: { alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 16, letterSpacing: -1 },
  desc: { fontSize: 18, lineHeight: 28, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  footer: { paddingBottom: Platform.OS === 'ios' ? 60 : 40 },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 40 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: {
    backgroundColor: '#fff',
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  nextBtnText: { fontSize: 18, fontWeight: '800', color: '#000', marginLeft: 24, flex: 1, textAlign: 'center' },
  nextBtnIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
