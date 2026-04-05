import AtmosphericBackground from '@/components/AtmosphericBackground';
import HapticPressable from '@/components/HapticPressable';
import { supabase } from '@/lib/supabase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BellRing, ChevronRight, LogOut, QrCode, TrendingUp, Users, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const { width, height } = Dimensions.get('window');

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false);
  const [newOfferTitle, setNewOfferTitle] = useState('');
  const [newOfferValue, setNewOfferValue] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');
  const [blastTitle, setBlastTitle] = useState('Exclusive Offer! 🔥');
  const [blastMessage, setBlastMessage] = useState('Come in today and get 20% OFF your total bill!');
  const [stats, setStats] = useState({ members: 0, visits: 0, revenue: 0 });
  const [businessData, setBusinessData] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBusinessData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: staffData } = await supabase.from('business_staff').select('business_id, location_id, business:businesses (*), location:locations (*)').eq('user_id', session.user.id).single();
      if (!staffData) return;
      setBusinessData(staffData.business);
      const bizId = staffData.business_id;
      const locationId = staffData.location_id;

      const [memberCount, visitCount, activityRes, offersRes] = await Promise.all([
        supabase.from('customer_loyalty').select('*', { count: 'exact', head: true }).eq('business_id', bizId),
        supabase.from('visit_logs').select('*', { count: 'exact', head: true }).eq('location_id', locationId).gte('visit_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('visit_logs').select('*, user:users(*)').eq('location_id', locationId).order('visit_time', { ascending: false }).limit(5),
        supabase.from('offers').select('*').eq('business_id', bizId).eq('is_active', true)
      ]);

      setStats({ members: memberCount.count || 0, visits: visitCount.count || 0, revenue: 0 });
      setRecentActivities(activityRes.data || []);
      setOffers(offersRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchBusinessData(); }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  return (
    <View style={styles.container}>
      <AtmosphericBackground lightMode={true} />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Command Center</Text>
          <Text style={styles.bizName}>{businessData?.name || 'My Business'}</Text>
        </View>
        <HapticPressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#64748b" />
        </HapticPressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchBusinessData(true)} tintColor="#6366f1" />}
      >
        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <TrendingUp size={20} color="#10b981" />
            <Text style={styles.statValue}>{stats.visits}</Text>
            <Text style={styles.statLabel}>Today's Visits</Text>
          </View>
          <View style={styles.statCard}>
            <Users size={20} color="#6366f1" />
            <Text style={styles.statValue}>{stats.members}</Text>
            <Text style={styles.statLabel}>Total Members</Text>
          </View>
        </View>

        {/* PRIMARY ACTIONS */}
        <View style={styles.actionRow}>
          <HapticPressable style={styles.mainAction} onPress={() => setShowQRModal(true)}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={StyleSheet.absoluteFill} />
            <QrCode size={32} color="#fff" />
            <Text style={styles.actionTitle}>Order QR</Text>
            <Text style={styles.actionSub}>Show to Customer</Text>
          </HapticPressable>
          <HapticPressable style={styles.mainAction} onPress={() => router.push('/(tabs)/scan')}>
            <LinearGradient colors={['#a855f7', '#9333ea']} style={StyleSheet.absoluteFill} />
            <QrCode size={32} color="#fff" />
            <Text style={styles.actionTitle}>Scan Pay</Text>
            <Text style={styles.actionSub}>Log Customer Visit</Text>
          </HapticPressable>
        </View>

        {/* BROADCAST CARD */}
        <HapticPressable style={styles.blastCard} onPress={() => setShowBlastModal(true)}>
          <View style={styles.blastContent}>
            <View style={styles.blastIcon}>
              <BellRing size={24} color="#f59e0b" />
            </View>
            <View style={styles.blastTexts}>
              <Text style={styles.blastTitle}>Broadcast Blast</Text>
              <Text style={styles.blastSub}>Notify all {stats.members} members instantly</Text>
            </View>
            <ChevronRight size={20} color="#94a3b8" />
          </View>
        </HapticPressable>

        {/* RECENT ACTIVITY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Insights</Text>
            <HapticPressable><Text style={styles.seeAll}>History</Text></HapticPressable>
          </View>
          {recentActivities.map((act, i) => (
            <View key={act.id} style={styles.activityRow}>
              <Image source={{ uri: `https://ui-avatars.com/api/?name=${act.user?.first_name}&background=random` }} style={styles.userAvatar} />
              <View style={styles.actInfo}>
                <Text style={styles.actUser}>{act.user?.first_name} {act.user?.last_name}</Text>
                <Text style={styles.actTime}>{new Date(act.visit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.actAmount}>₹{act.amount_spent}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* QR MODAL */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.qrContainer}>
            <Text style={styles.modalTitle}>Order Points</Text>
            <View style={styles.qrBox}>
              <QRCode value={JSON.stringify({ type: 'order', bizId: businessData?.id })} size={200} />
            </View>
            <Text style={styles.qrSub}>Customers scan this to earn</Text>
            <HapticPressable style={styles.closeModal} onPress={() => setShowQRModal(false)}>
              <X color="#0f172a" size={24} />
            </HapticPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 70 : 40, paddingHorizontal: 24, paddingBottom: 20 },
  greeting: { fontSize: 13, color: '#64748b', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  bizName: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginTop: 4 },
  logoutBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, padding: 20, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginTop: 12 },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  mainAction: { flex: 1, height: 160, borderRadius: 24, padding: 20, overflow: 'hidden', justifyContent: 'space-between' },
  actionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 12 },
  actionSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  blastCard: { width: '100%', height: 90, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 32 },
  blastContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  blastIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(245, 158, 11, 0.05)', alignItems: 'center', justifyContent: 'center' },
  blastTexts: { flex: 1, marginLeft: 16 },
  blastTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  blastSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  seeAll: { fontSize: 14, color: '#6366f1', fontWeight: '700' },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  userAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f8fafc' },
  actInfo: { flex: 1, marginLeft: 16 },
  actUser: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  actTime: { fontSize: 12, color: '#64748b', marginTop: 2 },
  actAmount: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrContainer: { width: 320, padding: 32, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 24 },
  qrBox: { padding: 20, backgroundColor: '#fff', borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  qrSub: { fontSize: 14, color: '#64748b', marginBottom: 32 },
  closeModal: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
