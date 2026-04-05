import HapticPressable from '@/components/HapticPressable';
import TierModal from '@/components/TierModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Award, Bell, ChevronRight, Clock, Compass, Gift, MapPin, Sparkles } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolate,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const HEADER_EXPANDED_HEIGHT = 140;
const HEADER_COLLAPSED_HEIGHT = Platform.OS === 'ios' ? 100 : 90;

export default function WalletScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [featuredOffers, setFeaturedOffers] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showTierModal, setShowTierModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const userName = profile?.first_name || 'User';

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [0, 1], Extrapolate.CLAMP);
    const height = interpolate(scrollY.value, [0, 80], [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT], Extrapolate.CLAMP);
    return {
      height,
      backgroundColor: `rgba(248, 250, 252, ${opacity * 0.98})`,
      borderBottomWidth: scrollY.value > 60 ? 1 : 0,
      borderBottomColor: '#e2e8f0',
    };
  });

  const nameTranslateStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, 80], [1, 0.85], Extrapolate.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 80], [0, Platform.OS === 'ios' ? -12 : -8], Extrapolate.CLAMP);
    const translateX = interpolate(scrollY.value, [0, 80], [0, -10], Extrapolate.CLAMP);
    return { transform: [{ scale }, { translateY }, { translateX }] };
  });

  const greetingOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 30], [1, 0], Extrapolate.CLAMP);
    return { opacity };
  });

  const fetchLoyaltyData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const [loyaltyRes, activityRes, notifRes] = await Promise.all([
          supabase.from('customer_loyalty').select('id, business_id, current_points, total_visits, business:businesses (*)').eq('user_id', session.user.id),
          supabase.from('visit_logs').select('id, visit_time, amount_spent, points_earned, location:locations (business:businesses (name))').eq('user_id', session.user.id).order('visit_time', { ascending: false }).limit(5),
          supabase.from('notifications').select('id', { count: 'exact' }).eq('user_id', session.user.id).eq('status', 'sent')
        ]);
        setLoyaltyData(loyaltyRes.data || []);
        setRecentActivity(activityRes.data || []);
        setUnreadCount(notifRes.count || 0);
        const sum = loyaltyRes.data?.reduce((acc, curr) => acc + (curr.current_points || 0), 0) || 0;
        setTotalPoints(sum);
        if (loyaltyRes.data && loyaltyRes.data.length > 0) {
          const bizIds = loyaltyRes.data.map(l => l.business_id);
          const { data: offers } = await supabase.from('offers').select('*, business:businesses (name, logo_url)').in('business_id', bizIds).eq('is_active', true).limit(10);
          setFeaturedOffers(offers || []);
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = React.useCallback(() => { fetchLoyaltyData(true); }, []);

  const getTierInfo = (pts: number) => {
    if (pts >= 2000) return { label: 'GOLD MEMBER', color: '#b45309', bg: '#fef3c7', next: 5000, nextLabel: 'Platinum' };
    if (pts >= 500) return { label: 'SILVER MEMBER', color: '#334155', bg: '#f1f5f9', next: 2000, nextLabel: 'Gold' };
    return { label: 'BRONZE MEMBER', color: '#92400e', bg: '#ffedd5', next: 500, nextLabel: 'Silver' };
  };

  const globalTier = getTierInfo(totalPoints);
  const progress = Math.min((totalPoints / globalTier.next) * 100, 100);

  useEffect(() => { fetchLoyaltyData(); }, []);

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  return (
    <View style={styles.container}>
      <TierModal isVisible={showTierModal} onClose={() => setShowTierModal(false)} userName={userName} tierLabel={globalTier.label} points={totalPoints} />

      <Animated.View style={[styles.liquidHeader, headerStyle]}>
        <View style={styles.headerContent}>
          <View>
            <Animated.Text style={[styles.greeting, greetingOpacityStyle]}>Good Morning,</Animated.Text>
            <Animated.Text style={[styles.name, nameTranslateStyle]}>{userName}</Animated.Text>
          </View>
          <View style={styles.headerIcons}>
            <HapticPressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
              <Bell size={22} color="#6366f1" />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </HapticPressable>
            <HapticPressable onPress={() => router.push('/referral')} style={styles.iconBtn}>
              <Gift size={22} color="#6366f1" />
            </HapticPressable>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler} scrollEventThrottle={16} showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        <View style={{ height: 10 }} />

        {/* BALANCE CARD - PREMIUM GRADIENT WIDGET */}
        <Animated.View entering={FadeInDown.delay(100).duration(800)}>
          <View style={styles.glassCard}>
            <LinearGradient
              colors={['#1e1b4b', '#312e81', '#0f172a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.cardHeader}>
               <View>
                 <Text style={styles.walletLabel}>TOTAL BALANCE</Text>
                 <Text style={styles.walletBalance}>{totalPoints.toLocaleString()}</Text>
               </View>
               <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                 <Award color={globalTier.color} size={14} fill={globalTier.color} style={{ marginRight: 6 }} />
                 <Text style={[styles.badgeText, { color: '#fff' }]}>{globalTier.label}</Text>
               </View>
            </View>

            <View style={styles.progressContainer}>
               <View style={styles.progressHeader}>
                 <Text style={styles.progressLabel}>Next Level: {globalTier.nextLabel}</Text>
                 <Text style={styles.progressValue}>{totalPoints} / {globalTier.next}</Text>
               </View>
               <View style={styles.progressBarBg}>
                 <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
               </View>
            </View>

            <View style={styles.cardFooter}>
               <View>
                 <Text style={styles.walletInfo}>≈ ₹{Math.floor(totalPoints / 10)}</Text>
                 <Text style={styles.walletSubInfo}>Redeemable Value</Text>
               </View>
               <HapticPressable style={styles.idButton} onPress={() => router.push('/(tabs)/profile')}>
                 <Text style={styles.idButtonText}>View ID</Text>
               </HapticPressable>
            </View>
          </View>
        </Animated.View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickActions}>
          {[
            { icon: Compass, label: 'Explore', color: '#3b82f6', route: '/(tabs)/explore' },
            { icon: Sparkles, label: 'Earn', color: '#8b5cf6', route: '/(tabs)/scan' },
            { icon: MapPin, label: 'Nearby', color: '#ec4899', route: '/(tabs)/explore' },
            { icon: Gift, label: 'Rewards', color: '#f97316', route: '/(tabs)' }
          ].map((action, i) => (
            <HapticPressable key={i} style={styles.actionItem} onPress={() => router.push(action.route as any)}>
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}10` }]}>
                <action.icon color={action.color} size={24} />
              </View>
              <Text style={styles.actionText}>{action.label}</Text>
            </HapticPressable>
          ))}
        </View>

        {/* OFFERS SECTION */}
        {featuredOffers.length > 0 && (
          <View style={styles.sectionHeaderBlock}>
            <Text style={styles.sectionTitle}>Elite Offers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
              {featuredOffers.map((offer) => (
                <HapticPressable key={offer.id} style={styles.featuredCard} onPress={() => router.push({ pathname: '/shop/[id]', params: { id: offer.business_id } })}>
                   <View style={styles.featuredInner}>
                      <Image source={{ uri: offer.business?.logo_url }} style={styles.featuredLogo} />
                      <Text style={styles.featuredOfferTitle} numberOfLines={1}>{offer.title}</Text>
                      <View style={[styles.tag, { backgroundColor: '#6366f1' }]}><Text style={styles.tagText}>{offer.discount_value}% OFF</Text></View>
                   </View>
                </HapticPressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CONNECTED CHANNELS */}
        <Text style={styles.sectionTitle}>Connected Channels</Text>
        {loyaltyData.map((item, index) => (
          <Animated.View key={item.id} entering={FadeInDown.delay(200 + (index * 100)).duration(800)}>
            <HapticPressable style={styles.shopCard} onPress={() => router.push({ pathname: '/shop/[id]', params: { id: item.business?.id } })}>
              <Image source={{ uri: item.business?.logo_url }} style={styles.shopImage} />
              <View style={styles.shopDetails}>
                <Text style={styles.shopName}>{item.business?.name}</Text>
                <View style={styles.pointsRow}>
                   <View style={[styles.miniBadge, { backgroundColor: getTierInfo(item.current_points).bg }]}>
                     <Text style={[styles.miniBadgeText, { color: getTierInfo(item.current_points).color }]}>{item.current_points} pts</Text>
                   </View>
                   <Text style={styles.shopCategory}>{item.business?.category}</Text>
                </View>
              </View>
              <ChevronRight color="#94a3b8" size={20} />
            </HapticPressable>
          </Animated.View>
        ))}

        {/* RECENT ACTIVITY */}
        {recentActivity.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityBizName}>{(activity.location as any)?.business?.name}</Text>
                  <Text style={styles.activityDate}>{new Date(activity.visit_time).toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                   <Text style={[styles.activityPoints, { color: activity.points_earned > 0 ? '#10b981' : '#ef4444' }]}>
                     {activity.points_earned > 0 ? `+${activity.points_earned}` : activity.points_earned} pts
                   </Text>
                   <Text style={styles.activityAmount}>₹{activity.amount_spent}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingTop: HEADER_EXPANDED_HEIGHT, paddingHorizontal: 20 },
  liquidHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden', paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: '100%' },
  greeting: { fontSize: 13, color: '#64748b', fontWeight: '600', letterSpacing: 0.5 },
  name: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  headerIcons: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  badgeDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
  glassCard: { width: '100%', borderRadius: 32, padding: 24, overflow: 'hidden', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  walletLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 2 },
  walletBalance: { fontSize: 42, fontWeight: '900', color: '#ffffff', marginTop: 4, letterSpacing: -1 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  progressContainer: { marginBottom: 28 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  progressValue: { fontSize: 12, color: '#ffffff', fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3 },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#818cf8' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  walletInfo: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  walletSubInfo: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginTop: 2 },
  idButton: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  idButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 36 },
  actionItem: { alignItems: 'center', gap: 10 },
  actionIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  actionText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  sectionHeaderBlock: { marginBottom: 32 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 20, letterSpacing: -0.5 },
  featuredScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  featuredCard: { width: 220, height: 160, marginRight: 16, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  featuredInner: { flex: 1, padding: 20, justifyContent: 'space-between' },
  featuredLogo: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f8fafc' },
  featuredOfferTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  shopCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 26, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  shopImage: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#f8fafc' },
  shopDetails: { flex: 1, marginLeft: 16 },
  shopName: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { fontSize: 11, fontWeight: '800' },
  shopCategory: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  activitySection: { marginTop: 32 },
  activityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  activityInfo: { gap: 4 },
  activityBizName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  activityDate: { fontSize: 12, color: '#64748b' },
  activityPoints: { fontSize: 16, fontWeight: '900' },
  activityAmount: { fontSize: 12, color: '#64748b' },
});
