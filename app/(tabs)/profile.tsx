import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Alert, Modal, Platform } from 'react-native';
import { Settings, LogOut, Store, ChevronRight, HelpCircle, User as UserIcon, LayoutDashboard, QrCode, X, Award, Share2, Star } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import QRCode from 'react-native-qrcode-svg';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [showQRModal, setShowQRModal] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      const fetchGlobalStats = async () => {
        if (!user) return;
        const { data } = await supabase
          .from('customer_loyalty')
          .select('current_points')
          .eq('user_id', user.id);
        
        const sum = (data || []).reduce((acc, curr) => acc + (curr.current_points || 0), 0);
        setTotalPoints(sum);
      };
      fetchGlobalStats();
    }, [user])
  );

  const getTierInfo = (pts: number) => {
    if (pts >= 2000) return { label: 'GOLD MEMBER', color: '#f59e0b', bg: '#fef3c7' };
    if (pts >= 500) return { label: 'SILVER MEMBER', color: '#64748b', bg: '#f1f5f9' };
    return { label: 'BRONZE MEMBER', color: '#92400e', bg: '#ffedd5' };
  };

  const tier = getTierInfo(totalPoints);

  const handleShareStatus = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `🏆 I've reached ${tier.label} on upskillProject! I've already earned ${totalPoints} cumulative loyalty points across my favorite shops. Join me and start earning! 🚀`,
      });
    } catch (err: any) {
      console.error('Sharing failed:', err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert("Error logging out", e.message);
    }
  };

  const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Guest User';
  const email = profile?.email || 'No email attached';
  const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      
      {/* Header Profile Info */}
      <View style={styles.header}>
        <Image 
          source={{ uri: avatarUrl }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{name}</Text>
          <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
            <Award color={tier.color} size={12} fill={tier.color} />
            <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
            <Pressable onPress={handleShareStatus} style={{ marginLeft: 8, padding: 2 }}>
               <Share2 color={tier.color} size={14} />
            </Pressable>
          </View>
          <Text style={styles.email}>{email}</Text>
        </View>
        <Pressable 
          style={styles.qrButton}
          onPress={() => setShowQRModal(true)}
        >
          <QrCode color="#6366f1" size={28} />
        </Pressable>
      </View>

      {/* Role-Specific Action Card */}
      {profile?.primary_role === 'owner' ? (
        <Pressable 
          style={[styles.businessCard, { backgroundColor: '#6366f1' }]}
          onPress={() => router.push('/(business)/dashboard')}
        >
          <LayoutDashboard color="#ffffff" size={32} />
          <View style={styles.businessTexts}>
            <Text style={styles.businessTitle}>Business Dashboard</Text>
            <Text style={[styles.businessSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              Manage your shop, blast offers, and track your customer growth.
            </Text>
          </View>
          <ChevronRight color="rgba(255,255,255,0.7)" size={24} />
        </Pressable>
      ) : (
        /* If they are a customer, we don't show the annoying "Are you a business owner?" banner anymore. 
           We move it to a subtle menu item below if needed. */
        null
      )}

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

      {profile?.primary_role === 'customer' && (
        <>
          <Text style={styles.sectionTitle}>For Partners</Text>
          <View style={styles.menuGroup}>
            <Pressable style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/(business)/register')}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#e0e7ff' }]}>
                <Store color="#6366f1" size={20} />
              </View>
              <Text style={styles.menuText}>List Your Business</Text>
              <ChevronRight color="#cbd5e1" size={20} />
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Rewards & Growth</Text>
      <View style={styles.menuGroup}>
        <Pressable style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/referral')}>
          <View style={[styles.menuIconContainer, { backgroundColor: '#fef3c7' }]}>
            <Star color="#f59e0b" size={20} fill="#f59e0b" />
          </View>
          <Text style={styles.menuText}>Invite Friends & Earn Points</Text>
          <View style={styles.newBadge}>
             <Text style={styles.newBadgeText}>NEW</Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <LogOut color="#ef4444" size={20} style={{ marginRight: 12 }} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      {/* CUSTOMER DIGITAL ID MODAL */}
      <Modal visible={showQRModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Digital ID</Text>
              <Pressable onPress={() => setShowQRModal(false)} style={styles.modalCloseButton}>
                <X color="#64748b" size={24} />
              </Pressable>
            </View>
            
            <Text style={styles.modalSubtitle}>Show this QR code to the shop owner to award points or redeem offers.</Text>
            
            <View style={styles.qrWrapper}>
              <QRCode
                value={JSON.stringify({ user_id: user?.id, type: 'customer' })}
                size={220}
                color="#0f172a"
                backgroundColor="transparent"
              />
            </View>

            <View style={styles.idInfoCard}>
               <Text style={styles.idInfoLabel}>USER ID</Text>
               <Text style={styles.idInfoText}>{user?.id}</Text>
            </View>

          </View>
        </View>
      </Modal>
      
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
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  qrButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  newBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 10,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 40,
  },
  qrWrapper: {
    alignSelf: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 40,
  },
  idInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  idInfoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  idInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  }
});
