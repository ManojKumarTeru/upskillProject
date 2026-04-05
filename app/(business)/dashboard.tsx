import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, Alert, ActivityIndicator, TextInput, Dimensions, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, ArrowLeft, Users, QrCode, ArrowUpRight, Award, X, BellRing, RefreshCw, LayoutDashboard, TrendingUp, Calendar, MessageCircle, ChevronRight, Sparkles, TrendingDown, Ticket, Gift, Settings, Bell } from 'lucide-react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Linking from 'expo-linking';
import HapticPressable from '@/components/HapticPressable';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { sendPushNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

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
  const [stats, setStats] = useState({ members: 0, visits: 0, revenue: 0 });
  const [chartData, setChartData] = useState<any>({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
  });
  const [businessData, setBusinessData] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [peakHoursData, setPeakHoursData] = useState<any>({
    labels: ["9am", "12pm", "3pm", "6pm", "9pm"],
    datasets: [{ data: [0, 0, 0, 0, 0] }]
  });
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [retentionRate, setRetentionRate] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [churnCount, setChurnCount] = useState(0);

  const fetchBusinessData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
        setLoading(false);
        return;
      }

      const bizId = staffData.business_id;
      const locationId = staffData.location_id;
      setBusinessData(staffData.business);

      const { count: memberCount } = await supabase
        .from('customer_loyalty')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizId);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: visitCount } = await supabase
        .from('visit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .gte('visit_time', startOfDay.toISOString());

      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const { data: allVisits } = await supabase
        .from('visit_logs')
        .select('amount_spent, visit_time')
        .eq('location_id', locationId)
        .gte('visit_time', last30Days.toISOString());

      const totalRev = (allVisits || []).reduce((sum, v) => sum + Number(v.amount_spent), 0);
      const totalVisits = allVisits?.length || 0;
      
      setStats({
        members: memberCount || 0,
        visits: visitCount || 0,
        revenue: totalRev
      });
      setAvgOrderValue(totalVisits > 0 ? Math.round(totalRev / totalVisits) : 0);

      const last7DaysArr = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });

      const revenueTimeline = last7DaysArr.map(date => {
        const dayVisits = (allVisits || []).filter(v => new Date(v.visit_time).toDateString() === date.toDateString());
        return dayVisits.reduce((sum, v) => sum + Number(v.amount_spent), 0);
      });

      setChartData({
        labels: last7DaysArr.map(d => d.toLocaleDateString('en-US', { weekday: 'short' })),
        datasets: [{ data: revenueTimeline }]
      });

      const { data: activities } = await supabase
        .from('visit_logs')
        .select(`
          id, visit_time, amount_spent, points_earned,
          user:users (first_name, last_name, phone)
        `)
        .eq('location_id', locationId)
        .order('visit_time', { ascending: false })
        .limit(5);

      if (activities) setRecentActivities(activities);

      const { data: bizOffers } = await supabase
        .from('offers')
        .select('*')
        .eq('business_id', bizId)
        .eq('is_active', true);
      
      setOffers(bizOffers || []);
      
      const hourCounts = new Array(24).fill(0);
      (allVisits || []).forEach(v => {
        const hour = new Date(v.visit_time).getHours();
        hourCounts[hour]++;
      });

      const displayHours = [9, 12, 15, 18, 21];
      setPeakHoursData({
        labels: ["9am", "12pm", "3pm", "6pm", "9pm"],
        datasets: [{ data: displayHours.map(h => hourCounts[h] || 0) }]
      });

      const { data: loyaltyStats } = await supabase
        .from('customer_loyalty')
        .select('total_visits, last_visited_at')
        .eq('business_id', bizId);
      
      const totalFans = loyaltyStats?.length || 0;
      const repeatFans = (loyaltyStats || []).filter(f => (f.total_visits || 0) > 1).length;
      setRetentionRate(totalFans > 0 ? Math.round((repeatFans / totalFans) * 100) : 0);

      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const churningFans = (loyaltyStats || []).filter(f => f.last_visited_at && new Date(f.last_visited_at) < fourteenDaysAgo).length;
      setChurnCount(churningFans);

      const { data: vips } = await supabase
        .from('customer_loyalty')
        .select(`
           current_points, total_visits,
           user:users (first_name, last_name, phone, avatar_url)
        `)
        .eq('business_id', bizId)
        .order('current_points', { ascending: false })
        .limit(5);
      
      setTopCustomers(vips || []);

    } catch (error: any) {
      console.error("Dashboard error:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    fetchBusinessData(true);
  }, []);

  useEffect(() => {
    fetchBusinessData();
  }, []);

  const shopQrPayload = JSON.stringify({ shop_id: businessData?.id || "00000000-0000-0000-0000-000000000000" });

  const handleSendOffer = async () => {
    if (!blastTitle || !blastMessage) {
      Alert.alert("Missing Info", "Please provide a title and message.");
      return;
    }
    setIsSending(true);
    try {
      const bizId = businessData?.id;
      const { data: loyaltyFans } = await supabase.from('customer_loyalty').select('user_id').eq('business_id', bizId);
      const userIds = loyaltyFans?.map(f => f.user_id) || [];
      if (userIds.length === 0) {
        Alert.alert("No Customers", "You don't have any connected customers to blast yet.");
        setShowBlastModal(false);
        return;
      }
      const { data: sessions } = await supabase.from('user_sessions').select('device_token').in('user_id', userIds);
      const tokens = sessions?.map(s => s.device_token).filter(t => t?.startsWith('ExponentPushToken')) || [];
      if (tokens.length > 0) {
        for (const token of [...new Set(tokens)]) {
            await sendPushNotification(token, blastTitle, blastMessage);
        }
      }
      await supabase.from('notifications').insert({ business_id: bizId, title: blastTitle, body: blastMessage, status: 'sent' });
      Alert.alert("🚀 Blast Complete!", `Notification sent successfully.`);
      setShowBlastModal(false);
    } catch (e: any) {
      Alert.alert("Blast Failed", e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleRecoverChurn = async () => {
    setIsSending(true);
    try {
      const bizId = businessData?.id;
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const { data: loyaltyFans } = await supabase.from('customer_loyalty').select('user_id, last_visited_at').eq('business_id', bizId);
      const churningUserIds = (loyaltyFans || []).filter(f => f.last_visited_at && new Date(f.last_visited_at) < fourteenDaysAgo).map(f => f.user_id);
      if (churningUserIds.length === 0) {
        Alert.alert("No Churn Risk", "All your customers have visited recently!");
        return;
      }
      const { data: sessions } = await supabase.from('user_sessions').select('device_token').in('user_id', churningUserIds);
      const tokens = sessions?.map(s => s.device_token).filter(t => t?.startsWith('ExponentPushToken')) || [];
      const title = "We Miss You! ❤️";
      const body = `It's been a while since your last visit to ${businessData?.name}. Come in today for a special surprise!`;
      if (tokens.length > 0) {
        for (const token of [...new Set(tokens)]) {
            await sendPushNotification(token, title, body);
        }
      }
      await supabase.from('notifications').insert({ business_id: bizId, user_id: churningUserIds[0], title, body, status: 'sent' });
      Alert.alert("🚀 Recovery Started!", `Recovery message sent.`);
    } catch (e: any) {
      Alert.alert("Recovery Failed", e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleFlashSale = () => {
     setBlastTitle("⚡ 60-MIN FLASH SALE!");
     setBlastMessage("HURRY! Get 50% OFF everything for the next 1 hour only! Only for our loyal app users. 🔥");
     setShowBlastModal(true);
  };

  const handleCreateOffer = async () => {
    if (!newOfferTitle || !newOfferValue) {
      Alert.alert("Missing Info", "Please provide a title and discount.");
      return;
    }
    setIsSending(true);
    try {
      const bizId = businessData?.id;
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('offers').insert({
          business_id: bizId,
          title: newOfferTitle,
          description: newOfferDesc,
          discount_type: 'percentage',
          discount_value: parseFloat(newOfferValue),
          created_by: session?.user.id,
          is_active: true
      });
      Alert.alert("🎉 Success!", "Your new offer is live.");
      setShowCreateOfferModal(false);
      setNewOfferTitle(''); setNewOfferValue(''); setNewOfferDesc('');
      fetchBusinessData();
    } catch (e: any) {
      Alert.alert("Creation Failed", e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Hello ${name}! This is ${businessData?.name}. We have an exclusive offer for you! Check your loyalty app. 🔥`;
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => { supported && Linking.openURL(url); });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <HapticPressable 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} 
          style={styles.backButton}
        >
          <ArrowLeft color="#fff" size={24} />
        </HapticPressable>
        <View style={styles.headerTitleContainer}>
           <Text style={styles.headerTitle}>{businessData?.name || 'Shop CRM'}</Text>
           <View style={styles.liveIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>LIVE</Text>
           </View>
        </View>
        <HapticPressable onPress={() => router.push('/notifications')} style={styles.refreshIconBox}>
           <Bell color="#fff" size={18} />
           {recentActivities.length > 0 && <View style={styles.badgeDot} />}
        </HapticPressable>
        <View style={{ width: 12 }} />
        <HapticPressable onPress={() => router.replace('/(tabs)/profile')} style={styles.refreshIconBox}>
           <Settings color="#fff" size={18} />
        </HapticPressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>
            
            <HapticPressable 
              style={styles.mainScanButton}
              onPress={() => router.push('/(business)/scan-customer')}
            >
              <LinearGradient colors={['#4f46e5', '#6366f1']} style={styles.mainScanGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <QrCode color="#fff" size={32} />
                <View style={styles.mainScanTexts}>
                  <Text style={styles.mainScanTitle}>Scan Customer App</Text>
                  <Text style={styles.mainScanSubtitle}>Record a new sale & award loyalty points instantly.</Text>
                </View>
                <ArrowUpRight color="rgba(255,255,255,0.6)" size={24} />
              </LinearGradient>
            </HapticPressable>

            <View style={styles.glassHeader}>
               <View style={styles.glassStat}>
                  <Text style={styles.glassStatLabel}>NET REVENUE</Text>
                  <Text style={styles.glassStatValue}>₹{(stats.revenue / 1000).toFixed(1)}k</Text>
               </View>
               <View style={styles.glassDivider} />
               <View style={styles.glassStat}>
                  <Text style={styles.glassStatLabel}>AVG. ORDER</Text>
                  <Text style={styles.glassStatValue}>₹{avgOrderValue}</Text>
               </View>
               <View style={styles.glassDivider} />
               <View style={styles.glassStat}>
                  <Text style={styles.glassStatLabel}>RETENTION</Text>
                  <Text style={styles.glassStatValue}>{retentionRate}%</Text>
               </View>
            </View>

            {churnCount > 0 && (
              <HapticPressable style={styles.churnAlertCard} onPress={handleRecoverChurn}>
                 <LinearGradient colors={['#fef2f2', '#fff1f2']} style={styles.churnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <View style={styles.churnIconBox}><Users color="#ef4444" size={20} /></View>
                    <View style={styles.churnInfo}>
                       <Text style={styles.churnTitle}>{churnCount} Customers are at Risk ⚠️</Text>
                       <Text style={styles.churnDesc}>Recover them now!</Text>
                    </View>
                    {isSending ? <ActivityIndicator size="small" color="#ef4444" /> : <ChevronRight color="#ef4444" size={20} />}
                 </LinearGradient>
              </HapticPressable>
            )}

            <HapticPressable style={styles.flashSaleButton} onPress={handleFlashSale}>
               <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.flashGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <TrendingUp color="#000" size={24} />
                  <View style={styles.flashTexts}>
                     <Text style={styles.flashTitle}>Start 60-Min Flash Sale</Text>
                     <Text style={styles.flashSubtitle}>Drive immediate traffic during slow hours.</Text>
                  </View>
                  <Sparkles color="#000" size={20} />
               </LinearGradient>
            </HapticPressable>

            {/* Charts */}
            <View style={styles.chartContainer}>
               <View style={styles.chartHeader}><Calendar color="#6366f1" size={18} /><Text style={styles.chartTitle}>Peak Hours</Text></View>
               <BarChart data={peakHoursData} width={width - 56} height={180} yAxisLabel="" yAxisSuffix="" chartConfig={chartConfig} style={chartStyle} showValuesOnTopOfBars />
            </View>

            <View style={styles.chartContainer}>
               <View style={styles.chartHeader}><TrendingUp color="#10b981" size={18} /><Text style={styles.chartTitle}>Revenue Trends</Text></View>
               <LineChart data={chartData} width={width - 56} height={180} yAxisLabel="₹" chartConfig={chartConfig} style={chartStyle} bezier />
            </View>

            <HapticPressable style={styles.qrActionCard} onPress={() => setShowQRModal(true)}>
              <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.qrGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.qrActionContent}>
                  <QrCode color="#fff" size={32} />
                  <View style={styles.qrActionTexts}>
                    <Text style={styles.qrActionTitle}>Show My QR Code</Text>
                    <Text style={styles.qrActionSubtitle}>Let customers scan this to join instantly.</Text>
                  </View>
                </View>
              </LinearGradient>
            </HapticPressable>

            <HapticPressable style={styles.blastButton} onPress={() => setShowBlastModal(true)}>
              <LinearGradient colors={['#ec4899', '#db2777']} style={styles.blastGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <BellRing color="#ffffff" size={28} />
                <View style={styles.blastTexts}>
                  <Text style={styles.blastTitle}>Blast Offer to Customers</Text>
                  <Text style={styles.blastSubtitle}>Reach all {stats.members} connected customers.</Text>
                </View>
              </LinearGradient>
            </HapticPressable>

            {/* Active Offers */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Offers ({offers.length})</Text>
              <HapticPressable onPress={() => setShowCreateOfferModal(true)}><Text style={styles.addOfferText}>+ New Offer</Text></HapticPressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offersScroll}>
               {offers.length === 0 ? (
                 <HapticPressable style={styles.emptyOffersCard} onPress={() => setShowCreateOfferModal(true)}>
                    <View style={styles.emptyOffersIcon}><Gift color="#6366f1" size={28} /></View>
                    <View style={styles.emptyOffersTexts}><Text style={styles.emptyOffersTitle}>Launch a Campaign</Text></View>
                    <View style={styles.emptyOffersBtn}><Text style={styles.emptyOffersBtnText}>Create</Text></View>
                 </HapticPressable>
               ) : (
                 offers.map((offer) => (
                   <View key={offer.id} style={styles.offerCard}>
                      <View style={styles.offerCardHeader}><Ticket color="#6366f1" size={16} /><Text style={styles.offerTag}>{offer.discount_value}% OFF</Text></View>
                      <Text style={styles.offerTitle} numberOfLines={2}>{offer.title}</Text>
                      <View style={styles.offerDashedLine} />
                      <HapticPressable style={styles.offerBlastBtn} onPress={() => { setBlastTitle(offer.title); setBlastMessage(offer.description); setShowBlastModal(true); }}>
                         <Text style={styles.offerBlastBtnText}>Blast to All</Text>
                      </HapticPressable>
                   </View>
                 ))
               )}
            </ScrollView>

            {/* VIPs */}
            <Text style={styles.sectionTitle}>Customer VIPs</Text>
            <View style={styles.leaderboardBox}>
               {topCustomers.map((vip, i) => (
                 <View key={i} style={styles.vipRow}>
                    <View style={styles.vipRank}><Text style={styles.rankText}>{i + 1}</Text></View>
                    <View style={styles.activityInfo}>
                       <Text style={styles.activityTitle}>{vip.user?.first_name} {vip.user?.last_name?.charAt(0)}.</Text>
                       <Text style={styles.activityDesc}>{vip.current_points} pts • {vip.total_visits} visits</Text>
                    </View>
                    <HapticPressable style={styles.thankYouBtn} onPress={() => handleWhatsApp(vip.user?.phone, vip.user?.first_name)}><Text style={styles.thankYouText}>Thank</Text></HapticPressable>
                 </View>
               ))}
            </View>
          </ScrollView>

          {/* Modals */}
          <Modal visible={showQRModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Your Shop QR</Text>
                  <HapticPressable onPress={() => setShowQRModal(false)} style={styles.modalCloseButton}><X color="#64748b" size={24} /></HapticPressable>
                </View>
                <View style={styles.qrWrapper}><QRCode value={shopQrPayload} size={200} /></View>
              </View>
            </View>
          </Modal>

          <Modal visible={showBlastModal} animationType="fade" transparent>
             <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                   <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Blast Offer</Text>
                      <HapticPressable onPress={() => setShowBlastModal(false)} style={styles.modalCloseButton}><X color="#64748b" size={24} /></HapticPressable>
                   </View>
                   <TextInput style={styles.blastInput} placeholder="Title" value={blastTitle} onChangeText={setBlastTitle} />
                   <TextInput style={[styles.blastInput, { height: 100, marginTop: 12 }]} placeholder="Message" value={blastMessage} onChangeText={setBlastMessage} multiline />
                   <HapticPressable style={[styles.blastConfirmButton, { marginTop: 24 }]} onPress={handleSendOffer}><LinearGradient colors={['#ec4899', '#db2777']} style={styles.blastConfirmGradient}><Text style={styles.blastConfirmText}>Send Blast</Text></LinearGradient></HapticPressable>
                </View>
             </View>
          </Modal>

          <Modal visible={showCreateOfferModal} animationType="slide" transparent>
             <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                   <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>New Offer</Text>
                      <HapticPressable onPress={() => setShowCreateOfferModal(false)} style={styles.modalCloseButton}><X color="#64748b" size={24} /></HapticPressable>
                   </View>
                   <TextInput style={styles.blastInput} placeholder="Offer Title" value={newOfferTitle} onChangeText={setNewOfferTitle} />
                   <TextInput style={[styles.blastInput, { marginTop: 12 }]} placeholder="Discount %" value={newOfferValue} onChangeText={setNewOfferValue} keyboardType="numeric" />
                   <HapticPressable style={[styles.blastConfirmButton, { marginTop: 24 }]} onPress={handleCreateOffer}><LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.blastConfirmGradient}><Text style={styles.blastConfirmText}>Save Offer</Text></LinearGradient></HapticPressable>
                </View>
             </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const chartConfig = {
  backgroundColor: "#ffffff",
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#6366f1" }
};
const chartStyle = { marginVertical: 8, borderRadius: 16 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 24, backgroundColor: '#0f172a' },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 },
  liveText: { color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  refreshIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  badgeDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#0f172a' },
  scrollContent: { padding: 20 },
  mainScanButton: { marginBottom: 24, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  mainScanGradient: { borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center' },
  mainScanTexts: { flex: 1, marginLeft: 16 },
  mainScanTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  mainScanSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  glassHeader: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  glassStat: { flex: 1, alignItems: 'center' },
  glassStatLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  glassStatValue: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  glassDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  churnAlertCard: { marginBottom: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#fee2e2' },
  churnGradient: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  churnIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  churnInfo: { flex: 1, marginLeft: 12 },
  churnTitle: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  churnDesc: { fontSize: 12, color: '#991b1b', marginTop: 2 },
  flashSaleButton: { marginBottom: 24, borderRadius: 24, shadowColor: '#fbbf24', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  flashGradient: { padding: 20, flexDirection: 'row', alignItems: 'center', borderRadius: 24 },
  flashTexts: { flex: 1, marginLeft: 16 },
  flashTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  flashSubtitle: { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 2, fontWeight: '600' },
  chartContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginLeft: 10 },
  qrActionCard: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, marginBottom: 40 },
  qrGradient: { borderRadius: 24, padding: 24 },
  qrActionContent: { flexDirection: 'row', alignItems: 'center' },
  qrActionTexts: { flex: 1, marginLeft: 16 },
  qrActionTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  qrActionSubtitle: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  blastButton: { shadowColor: '#db2777', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8, marginBottom: 40 },
  blastGradient: { borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center' },
  blastTexts: { flex: 1, marginLeft: 16 },
  blastTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  blastSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addOfferText: { color: '#6366f1', fontWeight: '700', fontSize: 14 },
  offersScroll: { marginBottom: 32, marginHorizontal: -20, paddingHorizontal: 20 },
  emptyOffersCard: { backgroundColor: '#eef2ff', width: width - 40, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e7ff', borderStyle: 'dashed' },
  emptyOffersIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  emptyOffersTexts: { flex: 1, marginLeft: 16 },
  emptyOffersTitle: { fontSize: 16, fontWeight: '800', color: '#1e1b4b' },
  emptyOffersBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyOffersBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  offerCard: { backgroundColor: '#ffffff', width: 200, padding: 20, borderRadius: 28, marginRight: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  offerCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  offerTag: { backgroundColor: '#fef3c7', color: '#d97706', fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  offerTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 16, height: 44, lineHeight: 22 },
  offerDashedLine: { height: 1, width: '100%', borderWidth: 1, borderColor: '#f1f5f9', borderStyle: 'dashed', marginBottom: 16 },
  offerBlastBtn: { backgroundColor: '#6366f1', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  offerBlastBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  leaderboardBox: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: '#f1f5f9' },
  vipRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  vipRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankText: { fontSize: 12, fontWeight: '800', color: '#6366f1' },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  activityDesc: { fontSize: 13, color: '#64748b' },
  thankYouBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  thankYouText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 20, marginBottom: 12 },
  activityIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  activityRight: { alignItems: 'flex-end' },
  activityTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  waButton: { marginTop: 8, padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  modalCloseButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  qrWrapper: { alignSelf: 'center', padding: 24, backgroundColor: '#ffffff', borderRadius: 24, marginBottom: 40 },
  blastInput: { backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 16, height: 56, fontSize: 16, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  blastConfirmButton: { shadowColor: '#db2777', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  blastConfirmGradient: { height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  blastConfirmText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
