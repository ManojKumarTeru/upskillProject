import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, Alert, ActivityIndicator, TextInput, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, ArrowLeft, Users, QrCode, ArrowUpRight, Award, X, BellRing, RefreshCw, LayoutDashboard } from 'lucide-react-native';

const { width } = Dimensions.get('window');
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { sendPushNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false);
  const [newOfferTitle, setNewOfferTitle] = useState('');
  const [newOfferValue, setNewOfferValue] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');
  const [blastTitle, setBlastTitle] = useState('Exclusive Offer! 🔥');
  const [blastMessage, setBlastMessage] = useState('Come in today and get 20% OFF your total bill!');
  const [stats, setStats] = useState({ members: 0, visits: 0 });
  const [businessData, setBusinessData] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);

  const fetchBusinessData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Get the business linked to this staff/owner
      const { data: staffData, error: staffError } = await supabase
        .from('business_staff')
        .select(`
          business_id, 
          location_id,
          business:businesses (*),
          location:locations (*)
        `)
        .eq('user_id', session.user.id)
        .single();

      if (staffError || !staffData) {
        console.warn("No business linked to this user");
        setLoading(false);
        return;
      }

      const bizId = staffData.business_id;
      const locationId = staffData.location_id;
      setBusinessData(staffData.business);

      // 2. Fetch Member Count
      const { count: memberCount } = await supabase
        .from('customer_loyalty')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizId);

      // 3. Fetch Visits Today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: visitCount } = await supabase
        .from('visit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .gte('visit_time', startOfDay.toISOString());

      setStats({
        members: memberCount || 0,
        visits: visitCount || 0
      });

      // 4. Fetch Recent Activity (Visits + Points earned)
      const { data: activities, error: activityError } = await supabase
        .from('visit_logs')
        .select(`
          id,
          visit_time,
          amount_spent,
          points_earned,
          user:users (first_name, last_name)
        `)
        .eq('location_id', locationId)
        .order('visit_time', { ascending: false })
        .limit(5);

      if (!activityError) {
        setRecentActivities(activities || []);
      }

      // 5. Fetch Active Offers
      const { data: bizOffers } = await supabase
        .from('offers')
        .select('*')
        .eq('business_id', bizId)
        .eq('is_active', true);
      
      setOffers(bizOffers || []);

    } catch (error: any) {
      console.error("Dashboard error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessData();
  }, []);

  // We serialize this so the customer's scanner can parse it!
  const shopQrPayload = JSON.stringify({ shop_id: businessData?.id || "00000000-0000-0000-0000-000000000000" });

  const handleSendOffer = async () => {
    if (!blastTitle || !blastMessage) {
      Alert.alert("Missing Info", "Please provide a title and message.");
      return;
    }

    setIsSending(true);
    try {
      const bizId = businessData?.id;
      if (!bizId) throw new Error("No business linked.");

      // 1. Fetch all customer user IDs connected to this business
      const { data: loyaltyFans, error: fansError } = await supabase
        .from('customer_loyalty')
        .select('user_id')
        .eq('business_id', bizId);

      if (fansError) throw fansError;
      
      const userIds = loyaltyFans?.map(f => f.user_id) || [];
      if (userIds.length === 0) {
        Alert.alert("No Customers", "You don't have any connected customers to blast yet! Show them your QR code.");
        setShowBlastModal(false);
        return;
      }

      // 2. Fetch tokens for these users from user_sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('user_sessions')
        .select('device_token')
        .in('user_id', userIds);

      if (sessionError) throw sessionError;

      const tokens = sessionData?.map(s => s.device_token).filter(t => t && t.startsWith('ExponentPushToken')) || [];
      
      if (tokens.length === 0) {
        Alert.alert("Simulated Success", `Found ${userIds.length} customers, but none have active push devices (using simulator?). (Bypassing for dev!)`);
        // In production, we'd stop here. For dev, we simulate.
      } else {
        // 3. Send to unique tokens
        const uniqueTokens = [...new Set(tokens)];
        for (const token of uniqueTokens) {
            await sendPushNotification(token, blastTitle, blastMessage);
        }
      }

      // 4. Record the notification in the audit log
      const { error: logError } = await supabase
        .from('notifications')
        .insert({
           business_id: bizId,
           title: blastTitle,
           body: blastMessage,
           status: 'sent'
        });

      Alert.alert("🚀 Blast Complete!", `Notification sent to ${userIds.length} customers successfully.`);
      setShowBlastModal(false);
      
    } catch (e: any) {
      Alert.alert("Blast Failed", e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateOffer = async () => {
    if (!newOfferTitle || !newOfferValue) {
      Alert.alert("Missing Info", "Please provide a title and discount percentage.");
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const bizId = businessData?.id;
      if (!session || !bizId) throw new Error("Authentication error.");

      const { error } = await supabase
        .from('offers')
        .insert({
          business_id: bizId,
          title: newOfferTitle,
          description: newOfferDesc,
          discount_type: 'percentage',
          discount_value: parseFloat(newOfferValue),
          created_by: session.user.id,
          is_active: true
        });

      if (error) throw error;

      Alert.alert("🎉 Success!", "Your new offer is live.");
      setShowCreateOfferModal(false);
      
      // Clean form
      setNewOfferTitle('');
      setNewOfferValue('');
      setNewOfferDesc('');

      // Refresh list
      fetchBusinessData();

    } catch (e: any) {
      Alert.alert("Creation Failed", e.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }} 
          style={styles.backButton}
        >
          <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{businessData?.name || 'Shop CRM'}</Text>
        <Pressable onPress={fetchBusinessData}>
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
            
            <Pressable 
              style={styles.mainScanButton}
              onPress={() => router.push('/(business)/scan-customer')}
            >
              <LinearGradient
                colors={['#4f46e5', '#6366f1']}
                style={styles.mainScanGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <QrCode color="#fff" size={32} />
                <View style={styles.mainScanTexts}>
                  <Text style={styles.mainScanTitle}>Scan Customer App</Text>
                  <Text style={styles.mainScanSubtitle}>Record a new sale & award loyalty points instantly.</Text>
                </View>
                <ArrowUpRight color="rgba(255,255,255,0.6)" size={24} />
              </LinearGradient>
            </Pressable>

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
            <Pressable style={styles.blastButton} onPress={() => setShowBlastModal(true)}>
              <LinearGradient
                colors={['#ec4899', '#db2777']} // Pink Gradient
                style={styles.blastGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <BellRing color="#ffffff" size={28} />
                <View style={styles.blastTexts}>
                  <Text style={styles.blastTitle}>Blast Offer to Customers</Text>
                  <Text style={styles.blastSubtitle}>Reach all {stats.members} connected customers directly on their lockscreen.</Text>
                </View>
              </LinearGradient>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Offers ({offers.length})</Text>
              <Pressable onPress={() => setShowCreateOfferModal(true)}>
                <Text style={styles.addOfferText}>+ New Offer</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offersScroll}>
              {offers.length === 0 ? (
                <View style={[styles.statCard, { width: width - 80, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: 'transparent' }]}>
                  <Text style={{ color: '#64748b', textAlign: 'center' }}>No active offers. Create one to reach customers.</Text>
                </View>
              ) : (
                offers.map((offer) => (
                  <View key={offer.id} style={styles.offerCard}>
                    <Text style={styles.offerTag}>{offer.discount_value}% OFF</Text>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                    <Pressable 
                      style={styles.offerBlastBtn} 
                      onPress={() => {
                        setBlastTitle(offer.title);
                        setBlastMessage(offer.description || `Get ${offer.discount_value}% discount!`);
                        setShowBlastModal(true);
                      }}
                    >
                      <Text style={styles.offerBlastBtnText}>Blast Offer</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>

            <Text style={styles.sectionTitle}>Recent Activity</Text>

            {recentActivities.length === 0 ? (
               <View style={styles.emptyActivity}>
                  <Text style={styles.emptyActivityText}>No recent activity yet today.</Text>
               </View>
            ) : (
              recentActivities.map((activity) => (
                <View key={activity.id} style={styles.activityCard}>
                  <View style={styles.activityIcon}>
                    <Award color="#f59e0b" size={20} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>
                      {(activity.user as any)?.first_name || 'Guest'} {(activity.user as any)?.last_name || ''}
                    </Text>
                    <Text style={styles.activityDesc}>
                      {activity.points_earned > 0 ? `Earned ${activity.points_earned} points` : 'Checked in'}
                    </Text>
                  </View>
                  <Text style={styles.activityTime}>
                    {new Date(activity.visit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))
            )}
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
                  <QRCode value={shopQrPayload} size={220} color="#0f172a" backgroundColor="transparent" />
                </View>
                <Pressable style={styles.downloadButton} onPress={() => Alert.alert('Verification', 'Feature coming soon: Print QR Code!')}>
                  <Text style={styles.downloadButtonText}>Print QR Code</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* DYNAMIC BLAST MODAL */}
          <Modal visible={showBlastModal} animationType="fade" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Blast New Offer</Text>
                  <Pressable onPress={() => setShowBlastModal(false)} style={styles.modalCloseButton}>
                    <X color="#64748b" size={24} />
                  </Pressable>
                </View>
                
                <Text style={styles.modalSubtitle}>Compose a message that will appear as a push notification for all connected customers.</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>OFFER TITLE</Text>
                  <TextInput 
                    style={styles.blastInput}
                    placeholder="e.g. Weekend Flash Sale!"
                    placeholderTextColor="#94a3b8"
                    value={blastTitle}
                    onChangeText={setBlastTitle}
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 20, marginBottom: 40 }]}>
                  <Text style={styles.inputLabel}>MESSAGE BODY</Text>
                  <TextInput 
                    style={[styles.blastInput, { height: 100, paddingTop: 16 }]}
                    placeholder="What's the deal?"
                    placeholderTextColor="#94a3b8"
                    value={blastMessage}
                    onChangeText={setBlastMessage}
                    multiline
                  />
                </View>

                <Pressable 
                  style={[styles.blastConfirmButton, isSending && { opacity: 0.7 }]} 
                  onPress={handleSendOffer}
                  disabled={isSending}
                >
                  <LinearGradient
                    colors={['#ec4899', '#db2777']}
                    style={styles.blastConfirmGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.blastConfirmText}>
                      {isSending ? "Sending Blast..." : `Send Blast to ${stats.members} Users`}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* DYNAMIC CREATE OFFER MODAL */}
          <Modal visible={showCreateOfferModal} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Create New Offer</Text>
                  <Pressable onPress={() => setShowCreateOfferModal(false)} style={styles.modalCloseButton}>
                    <X color="#64748b" size={24} />
                  </Pressable>
                </View>
                
                <Text style={styles.modalSubtitle}>This offer will be stored and can be reused for future blasts.</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>OFFER TITLE</Text>
                  <TextInput 
                    style={styles.blastInput}
                    placeholder="e.g. 20% OFF Everything!"
                    placeholderTextColor="#94a3b8"
                    value={newOfferTitle}
                    onChangeText={setNewOfferTitle}
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 20 }]}>
                  <Text style={styles.inputLabel}>DISCOUNT %</Text>
                  <TextInput 
                    style={styles.blastInput}
                    placeholder="e.g. 20"
                    placeholderTextColor="#94a3b8"
                    value={newOfferValue}
                    onChangeText={setNewOfferValue}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 20, marginBottom: 40 }]}>
                  <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
                  <TextInput 
                    style={[styles.blastInput, { height: 80, paddingTop: 16 }]}
                    placeholder="What's included?..."
                    placeholderTextColor="#94a3b8"
                    value={newOfferDesc}
                    onChangeText={setNewOfferDesc}
                    multiline
                  />
                </View>

                <Pressable 
                  style={[styles.blastConfirmButton, isSending && { opacity: 0.7 }]} 
                  onPress={handleCreateOffer}
                  disabled={isSending}
                >
                  <LinearGradient
                    colors={['#6366f1', '#4f46e5']}
                    style={styles.blastConfirmGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.blastConfirmText}>
                      {isSending ? "Creating..." : "Save & Add to Library"}
                    </Text>
                  </LinearGradient>
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
  emptyActivity: {
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyActivityText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addOfferText: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 14,
  },
  offersScroll: {
    marginBottom: 32,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  offerCard: {
    backgroundColor: '#ffffff',
    width: 200,
    padding: 20,
    borderRadius: 24,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  offerTag: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    height: 40,
  },
  offerBlastBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  offerBlastBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
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
  },
  inputGroup: {},
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 1,
  },
  blastInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  blastConfirmButton: {
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  blastConfirmGradient: {
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blastConfirmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  mainScanButton: {
    marginBottom: 24,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  mainScanGradient: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainScanTexts: {
    flex: 1,
    marginLeft: 16,
  },
  mainScanTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  mainScanSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  }
});
