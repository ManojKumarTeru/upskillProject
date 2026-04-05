import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  interpolate 
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface AtmosphericBackgroundProps {
  primaryColor?: string;
  secondaryColor?: string;
  lightMode?: boolean;
}

export default function AtmosphericBackground({ 
  primaryColor = '#6366f1', 
  secondaryColor = '#a855f7',
  lightMode = false
}: AtmosphericBackgroundProps) {
  const blob1 = useSharedValue(0);
  const blob2 = useSharedValue(0);

  useEffect(() => {
    blob1.value = withRepeat(withTiming(1, { duration: 18000 }), -1, true);
    blob2.value = withRepeat(withTiming(1, { duration: 15000 }), -1, true);
  }, []);

  const style1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(blob1.value, [0, 1], [-width * 0.2, width * 0.4]) },
      { translateY: interpolate(blob1.value, [0, 1], [0, height * 0.3]) }
    ],
    opacity: lightMode ? 0.15 : 0.35,
  }));

  const style2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(blob2.value, [0, 1], [width * 0.3, -width * 0.2]) },
      { translateY: interpolate(blob2.value, [0, 1], [height * 0.4, 0]) }
    ],
    opacity: lightMode ? 0.1 : 0.25,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient 
        colors={lightMode ? ['#f8fafc', '#f1f5f9'] : ['#0f172a', '#1e1b4b']} 
        style={StyleSheet.absoluteFill} 
      />
      <Animated.View style={[styles.glowBlob, style1, { backgroundColor: lightMode ? '#cbd5e1' : primaryColor, top: -height * 0.1, left: -width * 0.1 }]} />
      <Animated.View style={[styles.glowBlob, style2, { backgroundColor: lightMode ? '#94a3b8' : secondaryColor, bottom: -height * 0.1, right: -width * 0.1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowBlob: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    // Note: Blur is handled via opacity and linear background for performance on Android
    // Real blur (expo-blur) should be used on overlaying cards
  },
});
