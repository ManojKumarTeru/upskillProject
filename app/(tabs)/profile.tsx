import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Alert } from 'react-native';
import { Settings, LogOut, Store, ChevronRight, HelpCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Even if our generic AuthProvider is bypassed, we can manually force a routing push.
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert("Error logging out", e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://i.pravatar.cc/150?u=founder' }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>Founder</Text>
          <Text style={styles.email}>founder@upskill.com</Text>
        </View>
      </View>

      {/* Business Owner Banner */}
      <Pressable 
        style={styles.businessCard}
        onPress={() => router.push('/(business)/register')}
      >
        <Store color="#ffffff" size={32} />
        <View style={styles.businessTexts}>
          <Text style={styles.businessTitle}>Are you a business owner?</Text>
          <Text style={styles.businessSubtitle}>Register your shop in 30 seconds to start building customer loyalty for free.</Text>
        </View>
        <ChevronRight color="rgba(255,255,255,0.7)" size={24} />
      </Pressable>

      <Text style={styles.sectionTitle}>Settings</Text>

      <View style={styles.menuGroup}>
        <Pressable style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Settings color="#64748b" size={20} />
          </View>
          <Text style={styles.menuText}>Account Preferences</Text>
          <ChevronRight color="#cbd5e1" size={20} />
        </Pressable>

        <Pressable style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <View style={styles.menuIconContainer}>
            <HelpCircle color="#64748b" size={20} />
          </View>
          <Text style={styles.menuText}>Help & Support</Text>
          <ChevronRight color="#cbd5e1" size={20} />
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <LogOut color="#ef4444" size={20} style={{ marginRight: 12 }} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  email: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  businessCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  businessTexts: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  businessTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  businessSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  menuGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 40,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 20,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  }
});
