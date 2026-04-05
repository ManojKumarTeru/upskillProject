import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Store, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import HapticPressable from '@/components/HapticPressable';
import AtmosphericBackground from '@/components/AtmosphericBackground';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

function SelectionCard({ 
  role, 
  icon: Icon, 
  title, 
  desc, 
  isSelected, 
  onPress,
  accentColor
}: { 
  role: string, 
  icon: any, 
  title: string, 
  desc: string, 
  isSelected: boolean, 
  onPress: () => void,
  accentColor: string
}) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.02 : 1) }],
    borderColor: isSelected ? accentColor : 'rgba(255,255,255,0.08)',
    borderWidth: isSelected ? 2 : 1,
  }));

  return (
    <HapticPressable 
      onPress={() => {
        onPress();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      style={{ width: '100%' }}
    >
      <Animated.View style={[styles.roleCard, animatedStyle]}>
        <BlurView intensity={isSelected ? 30 : 10} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.iconBox, { backgroundColor: isSelected ? accentColor : 'rgba(255,255,255,0.05)' }]}>
          <Icon color={isSelected ? '#fff' : accentColor} size={28} />
        </View>
        <View style={styles.cardTexts}>
          <Text style={[styles.cardTitle, isSelected && { color: '#fff' }]}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkMark}>
            <CheckCircle2 color="#10b981" size={24} />
          </View>
        )}
      </Animated.View>
    </HapticPressable>
  );
}

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'customer' | 'owner' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedRole) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session found");

      const { error } = await supabase
        .from('users')
        .update({ primary_role: selectedRole })
        .eq('id', session.user.id);

      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (selectedRole === 'owner') {
        const { data: staff } = await supabase
          .from('business_staff')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (staff) {
          router.replace('/(business)/dashboard');
        } else {
          router.replace('/(business)/register');
        }
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error("Role selection error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AtmosphericBackground />
      
      <Animated.View style={styles.content} entering={FadeInDown.duration(800)}>
        <View style={styles.headerBox}>
          <Text style={styles.title}>Final step.</Text>
          <Text style={styles.subtitle}>Tell us how you'll use Artha.</Text>
        </View>

        <View style={styles.cardsContainer}>
          <SelectionCard 
            role="customer" icon={User} title="I'm a Customer" 
            desc="Discover local deals, earn points, and save money."
            isSelected={selectedRole === 'customer'}
            onPress={() => setSelectedRole('customer')}
            accentColor="#6366f1"
          />

          <SelectionCard 
            role="owner" icon={Store} title="I'm a Business Owner" 
            desc="List your shop, reach customers, and grow your sales."
            isSelected={selectedRole === 'owner'}
            onPress={() => setSelectedRole('owner')}
            accentColor="#a855f7"
          />
        </View>

        <View style={styles.footer}>
          <HapticPressable 
            style={[styles.confirmButton, !selectedRole && styles.confirmButtonDisabled]} 
            onPress={handleConfirm}
            disabled={!selectedRole || loading}
          >
            <Text style={styles.confirmButtonText}>
              {loading ? "Initializing..." : "Launch Experience"}
            </Text>
            {!loading && <ArrowRight color="#fff" size={20} style={{ marginLeft: 8 }} />}
          </HapticPressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  headerBox: { marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: -1.5 },
  subtitle: { fontSize: 17, color: '#94a3b8', lineHeight: 26 },
  cardsContainer: { gap: 20 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  cardTexts: { flex: 1 },
  cardTitle: { fontSize: 19, fontWeight: '800', color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  checkMark: { position: 'absolute', top: 15, right: 15 },
  footer: { marginTop: 60 },
  confirmButton: { 
    flexDirection: 'row', 
    backgroundColor: '#6366f1', 
    height: 68, 
    borderRadius: 34, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.5,
  },
  confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
});
