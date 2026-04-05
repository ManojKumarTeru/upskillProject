import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Store, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

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

      if (selectedRole === 'owner') {
        // If they are an owner but haven't registered a business yet, send to business register
        // For now, let's see if they have a business already
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
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={StyleSheet.absoluteFillObject} />
      
      <Animated.View style={styles.content} entering={FadeInDown.duration(800)}>
        <Text style={styles.title}>One last thing...</Text>
        <Text style={styles.subtitle}>How do you plan to use upskill today?</Text>

        <View style={styles.cardsContainer}>
          {/* CUSTOMER CARD */}
          <Pressable 
            style={[
              styles.roleCard, 
              selectedRole === 'customer' && styles.selectedCard
            ]} 
            onPress={() => setSelectedRole('customer')}
          >
            <View style={[styles.iconBox, selectedRole === 'customer' && styles.selectedIconBox]}>
              <User color={selectedRole === 'customer' ? '#fff' : '#6366f1'} size={32} />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, selectedRole === 'customer' && styles.selectedText]}>I'm a Customer</Text>
              <Text style={[styles.cardDesc, selectedRole === 'customer' && styles.selectedDesc]}>
                Discover local deals, earn points, and save money at your favorite shops.
              </Text>
            </View>
            {selectedRole === 'customer' && (
              <View style={styles.checkMark}>
                <CheckCircle2 color="#10b981" size={24} />
              </View>
            )}
          </Pressable>

          {/* OWNER CARD */}
          <Pressable 
            style={[
              styles.roleCard, 
              selectedRole === 'owner' && styles.selectedCard
            ]} 
            onPress={() => setSelectedRole('owner')}
          >
            <View style={[styles.iconBox, selectedRole === 'owner' && styles.selectedIconBox]}>
              <Store color={selectedRole === 'owner' ? '#fff' : '#a855f7'} size={32} />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, selectedRole === 'owner' && styles.selectedText]}>I'm a Business Owner</Text>
              <Text style={[styles.cardDesc, selectedRole === 'owner' && styles.selectedDesc]}>
                List your shop, reach repeat customers, and grow your sales dashboard.
              </Text>
            </View>
            {selectedRole === 'owner' && (
              <View style={styles.checkMark}>
                <CheckCircle2 color="#10b981" size={24} />
              </View>
            )}
          </Pressable>
        </View>

        <Pressable 
          style={[
            styles.confirmButton, 
            !selectedRole && styles.confirmButtonDisabled
          ]} 
          onPress={handleConfirm}
          disabled={!selectedRole || loading}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? "Saving..." : "Continue to My App"}
          </Text>
          {!loading && <ArrowRight color="#fff" size={20} style={{ marginLeft: 8 }} />}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 48, lineHeight: 24 },
  cardsContainer: { gap: 20, marginBottom: 60 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  selectedCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  selectedIconBox: {
    backgroundColor: '#6366f1',
  },
  cardTexts: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  selectedText: { color: '#fff' },
  cardDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  selectedDesc: { color: 'rgba(255,255,255,0.7)' },
  checkMark: { position: 'absolute', top: 20, right: 20 },
  confirmButton: { 
    flexDirection: 'row', 
    backgroundColor: '#6366f1', 
    height: 64, 
    borderRadius: 32, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
