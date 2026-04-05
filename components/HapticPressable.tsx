import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface HapticPressableProps extends PressableProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number; // Default 0.98
}

export default function HapticPressable({ 
  children, 
  style, 
  scaleTo = 0.97, 
  onPressIn,
  onPressOut,
  ...props 
}: HapticPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    // 1. Physical Haptic 'Click'
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // 2. Visual Scale Down
    scale.value = withSpring(scaleTo, {
        damping: 10,
        stiffness: 300,
    });

    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    // 3. Visual Bounce Back
    scale.value = withSpring(1, {
        damping: 10,
        stiffness: 300,
    });

    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
