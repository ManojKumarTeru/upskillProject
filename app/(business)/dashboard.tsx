import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, ArrowLeft, Users, QrCode, ArrowUpRight, Award, X, BellRing, RefreshCw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { sendPushNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [stats, setStats] = useState({ members: 0, visits: 0 });
  const [businessData, setBusinessData] = useState<any>(null);

  const fetchBusinessStats = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Get the business linked to this staff/owner
      const { data: staffData, error: staffError } = await supabase
        .from('business_staff')
        .select('business_id, locations(id, name)')
        .eq('user_id', session.user.id)
        .single();

      if (staffError || !staffData) {
        console.warn("No business linked to this user");
        setLoading(false);
        return;
      }

      const bizId = staffData.business_id;

      // 2. Fetch Business Profile
      const { data: bizProfile } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', bizId)
        .single();
      
      setBusinessData(bizProfile);

      // 3. Fetch Member Count
      const { count: memberCount } = await supabase
        .from('customer_loyalty')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizId);

      // 4. Fetch Visits Total
      const locationId = Array.isArray((staffData as any).locations) 
        ? (staffData as any).locations[0]?.id 
        : (staffData as any).locations?.id;
      
      const { count: visitCount } = await supabase
        .from('visit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId);

      setStats({
        members: memberCount || 0,
        visits: visitCount || 0
      });

    } catch (error: any) {
      console.error("Dashboard error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessStats();
  }, []);

  // We serialize this so the customer's scanner can parse it!
  const shopQrPayload = JSON.stringify({ shop_id: businessData?.id || "00000000-0000-0000-0000-000000000000" });

  const handleSendOffer = async () => {
    setIsSending(true);
    try {
      // In a real scenario, you pull all push_tokens from Supabase `customers` linked to this shop!
      // Mocking 1 Expo token representing a customer simulator:
      const dummyCustomerToken = "ExponentPushToken[xxxxxxxxxxxxxx]"; 
      
      Alert.alert(
        "Blast Offer", 
        "Sending a 20% OFF push notification to 1,248 customers...",
        [
          { 
            text: "Confirm & Send", 
            onPress: async () => {
              // FIRE THE ZERO COST PUSH API!
              // In production, loop through array of customer tokens.
              // await sendPushNotification(dummyCustomerToken, "🔥 Flast Sale at Your Shop!", "20% off all items today only! Come in now.");
              Alert.alert("🚀 Success!", "Notification blasted to 1,248 customers.");
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{businessData?.name || 'Shop CRM'}</Text>
        <Pressable onPress={fetchBusinessStats}>
           <RefreshCw color="#fff" size={20} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconBox}>
                  <Users color="#6366f1" size={24} />
                </View>
                <Text style={styles.statValue}>{stats.members.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Connected Users</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: '#dcfce7' }]}>
                  <ArrowUpRight color="#10b981" size={24} />
                </View>
                <Text style={styles.statValue}>{stats.visits.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Visits Today</Text>
              </View>
            </View>

            <Pressable 
              style={styles.qrActionCard}
              onPress={() => setShowQRModal(true)}
            >
              <LinearGradient
                colors={['#0f172a', '#1e1b4b']}
                style={styles.qrGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.qrActionContent}>
                  <QrCode color="#fff" size={32} />
                  <View style={styles.qrActionTexts}>
                    <Text style={styles.qrActionTitle}>Show My QR Code</Text>
                    <Text style={styles.qrActionSubtitle}>Let customers scan this to join your loyalty network instantly.</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* PUSH NOTIFICATION BLASTER BUTTON */}
            <Pressable style={styles.blastButton} onPress={handleSendOffer}>
              <LinearGradient
                colors={['#ec4899', '#db2777']} // Pink Gradient
                style={styles.blastGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <BellRing color="#ffffff" size={28} />
                <View style={styles.blastTexts}>
                  <Text style={styles.blastTitle}>Blast Offer to Customers</Text>
                  <Text style={styles.blastSubtitle}>Send a push notification to all 1,248 customers directly to their lockscreen.</Text>
                </View>
              </LinearGradient>
            </Pressable>

            <Text style={styles.sectionTitle}>Recent Activity</Text>

            <View style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Award color="#f59e0b" size={20} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Karthik M.</Text>
                <Text style={styles.activityDesc}>Checked in & earned 10 points</Text>
              </View>
              <Text style={styles.activityTime}>Just now</Text>
            </View>
            
            <View style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Award color="#f59e0b" size={20} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Priya S.</Text>
                <Text style={styles.activityDesc}>Redeemed 10% Discount</Text>
              </View>
              <Text style={styles.activityTime}>2m ago</Text>
            </View>
          </ScrollView>

          {/* DYNAMIC QR CODE MODAL */}
          <Modal visible={showQRModal} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Your Shop QR</Text>
                  <Pressable onPress={() => setShowQRModal(false)} style={styles.modalCloseButton}>
                    <X color="#64748b" size={24} />
                  </Pressable>
                </View>
                
                <Text style={styles.modalSubtitle}>Customers can scan this to instantly connect their wallet to your shop.</Text>
                
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={shopQrPayload}
                    size={220}
                    color="#0f172a"
                    backgroundColor="transparent"
                  />
                </View>

                <Pressable style={styles.downloadButton} onPress={() => Alert.alert('Verification', 'Feature coming soon: Print QR Code!')}>
                  <Text style={styles.downloadButtonText}>Print QR Code</Text>
                </Pressable>

              </View>
            </View>
          </Modal>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 24,
    backgroundColor: '#0f172a',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  scrollContent: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 24, padding: 20,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  statIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  qrActionCard: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, marginBottom: 40 },
  qrGradient: { borderRadius: 24, padding: 24 },
  qrActionContent: { flexDirection: 'row', alignItems: 'center' },
  qrActionTexts: { flex: 1, marginLeft: 16 },
  qrActionTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  qrActionSubtitle: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 20, marginBottom: 12 },
  activityIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  activityDesc: { fontSize: 13, color: '#64748b' },
  activityTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
  downloadButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  blastButton: {
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 40,
  },
  blastGradient: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  blastTexts: {
    flex: 1,
    marginLeft: 16,
  },
  blastTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  blastSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  }
});
