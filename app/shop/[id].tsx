import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Platform, Image, ActivityIndicator, Modal, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Award, Clock, Tag, X, CheckCircle, Star } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function ShopDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    id: businessId,
    loyaltyId,
    bizName,
    bizCategory,
    bizLogo,
    points: pointsParam,
    visits: visitsParam,
  } = useLocalSearchParams<{
    id: string; loyaltyId: string;
    bizName: string; bizCategory: string; bizLogo: string;
    points: string; visits: string;
  }>();

  // ── Instant state from params (zero wait) ──────────────────────
  const [points, setPoints] = useState(parseInt(pointsParam || '0', 10));
  const [visits] = useState(parseInt(visitsParam || '0', 10));

  // ── Background-loaded state ────────────────────────────────────
  const [offers, setOffers] = useState<any[]>([]);
  const [visitLogs, setVisitLogs] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // ── Redemption modal ───────────────────────────────────────────
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  // Fetch ONLY what we don't already have: offers + visit history
  useEffect(() => {
    const load = async () => {
      if (!businessId || !user) return;
      try {
        // Run both queries in parallel — not sequential
        const [offersRes, locationRes] = await Promise.all([
          supabase.from('offers').select('*').eq('business_id', businessId).eq('is_active', true),
          supabase.from('locations').select('id').eq('business_id', businessId),
        ]);

        setOffers(offersRes.data || []);

        // If we have locations, grab visit history for this user
        if (locationRes.data && locationRes.data.length > 0 && user) {
          const locationIds = locationRes.data.map((l: any) => l.id);
          const { data: logs } = await supabase
            .from('visit_logs')
            .select('id, visit_time, amount_spent, points_earned')
            .eq('user_id', user.id)
            .in('location_id', locationIds)
            .order('visit_time', { ascending: false })
            .limit(5);
          setVisitLogs(logs || []);
        }
      } catch (err: any) {
        console.error('Shop detail bg fetch:', err.message);
      } finally {
        setDetailsLoading(false);
      }
    };
    load();
  }, [businessId, user]);

  const openRedeemModal = (offer: any) => {
    if (points < offer.discount_value) {
      Alert.alert(
        'Not Enough Points',
        `You need ${offer.discount_value} pts for this offer.\nYou have ${points} pts.`
      );
      return;
    }
    setSelectedOffer(offer);
    setShowRedeemModal(true);
  };

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const redeemQrPayload = selectedOffer
    ? JSON.stringify({
        type: 'redeem',
        user_id: user?.id,
        offer_id: selectedOffer.id,
        business_id: businessId,
        loyalty_id: loyaltyId,
        points_required: selectedOffer.discount_value,
        ts: Date.now(),
      })
    : '';

  const logoUri = bizLogo && bizLogo !== 'undefined' && bizLogo !== 'null'
    ? bizLogo
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(bizName || 'Shop')}&background=6366f1&color=fff&size=128`;

  const getTierInfo = (pts: number) => {
    if (pts >= 2000) return { label: 'GOLD MEMBER', color: '#f59e0b', bg: 'rgba(254, 243, 199, 0.2)' };
    if (pts >= 500) return { label: 'SILVER MEMBER', color: '#cbd5e1', bg: 'rgba(241, 245, 249, 0.2)' };
    return { label: 'BRONZE MEMBER', color: '#d97706', bg: 'rgba(255, 237, 213, 0.2)' };
  };

  const tier = getTierInfo(points);

  return (
    <View style={styles.container}>
      {/* ── Dark header — renders instantly ── */}
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{bizName || 'Shop'}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Points Hero Card — renders INSTANTLY from params ── */}
        <Animated.View entering={FadeIn.duration(300)}>
          <LinearGradient
            colors={['#4f46e5', '#6366f1', '#818cf8']}
            style={styles.pointsCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={styles.pointsCardRow}>
              <View style={{ flex: 1 }}>
                <View style={[styles.tierHeroBadge, { backgroundColor: tier.bg }]}>
                  <Award color={tier.color} size={12} fill={tier.color} />
                  <Text style={[styles.tierHeroText, { color: tier.color }]}>{tier.label}</Text>
                </View>
                <Text style={styles.pointsLabel}>YOUR CURRENT POINTS</Text>
                <Text style={styles.pointsValue}>{points}</Text>
                <Text style={styles.pointsWorth}>
                  Worth ₹{Math.floor(points / 10)} • {visits} Visits
                </Text>
              </View>
              <View style={styles.pointsIconBox}>
                <Award color="#fff" size={40} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Business Card — renders INSTANTLY from params ── */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.bizInfoCard}>
          <Image source={{ uri: logoUri }} style={styles.bizLogo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bizName}>{bizName}</Text>
            <Text style={styles.bizCategory}>{bizCategory || 'Local Business'}</Text>
          </View>
        </Animated.View>

        {/* ── Offers section — shows skeleton then real data ── */}
        <Text style={styles.sectionTitle}>🎁 Available Offers</Text>

        {detailsLoading ? (
          // Skeleton cards while loading in background
          [0, 1].map((i) => (
            <View key={i} style={[styles.offerCard, styles.skeleton]}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
            </View>
          ))
        ) : offers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active offers right now.</Text>
            <Text style={styles.emptySubtext}>Check back soon for discounts!</Text>
          </View>
        ) : (
          offers.map((offer, i) => {
            const canRedeem = points >= offer.discount_value;
            return (
              <Animated.View key={offer.id} entering={FadeInDown.delay(i * 60).duration(400)}>
                <View style={styles.offerCard}>
                  <View style={styles.offerLeft}>
                    <View style={[styles.offerTag, !canRedeem && styles.offerTagLocked]}>
                      <Tag color={canRedeem ? '#d97706' : '#94a3b8'} size={13} />
                      <Text style={[styles.offerTagText, !canRedeem && { color: '#94a3b8' }]}>
                        {offer.discount_value}% OFF
                      </Text>
                    </View>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                    {offer.description ? <Text style={styles.offerDesc}>{offer.description}</Text> : null}
                    <View style={styles.offerPointsRow}>
                      <Star color="#f59e0b" size={12} />
                      <Text style={styles.offerPointsText}>
                        Need {offer.discount_value} pts • You have {points}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={[styles.redeemBtn, !canRedeem && styles.redeemBtnLocked]}
                    onPress={() => openRedeemModal(offer)}
                  >
                    <Text style={[styles.redeemBtnText, !canRedeem && { color: '#94a3b8' }]}>
                      {canRedeem ? 'Redeem' : 'Locked'}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            );
          })
        )}

        {/* ── Visit History ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🕒 Visit History</Text>

        {detailsLoading ? (
          [0, 1, 2].map((i) => (
            <View key={i} style={[styles.visitCard, styles.skeleton, { marginBottom: 10 }]}>
              <View style={[styles.skeletonLine, { width: '40%' }]} />
            </View>
          ))
        ) : visitLogs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No visits recorded yet.</Text>
          </View>
        ) : (
          visitLogs.map((visit, i) => (
            <Animated.View key={visit.id} entering={FadeInDown.delay(i * 50).duration(400)}>
              <View style={styles.visitCard}>
                <View style={styles.visitIconBox}>
                  <Clock color="#6366f1" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitDate}>{formatDate(visit.visit_time)}</Text>
                  <Text style={styles.visitAmount}>₹{visit.amount_spent} spent</Text>
                </View>
                <View style={styles.visitPointsBadge}>
                  <Text style={styles.visitPointsText}>+{visit.points_earned} pts</Text>
                </View>
              </View>
            </Animated.View>
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Redemption Modal ── */}
      <Modal visible={showRedeemModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem Offer</Text>
              <Pressable onPress={() => setShowRedeemModal(false)} style={styles.modalCloseBtn}>
                <X color="#64748b" size={24} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Show this QR code to the shop owner's scanner to claim your discount.
            </Text>
            <View style={styles.redeemOfferInfo}>
              <CheckCircle color="#10b981" size={20} />
              <Text style={styles.redeemOfferTitle}>{selectedOffer?.title}</Text>
            </View>
            <View style={styles.qrWrapper}>
              {redeemQrPayload ? (
                <QRCode value={redeemQrPayload} size={220} color="#0f172a" backgroundColor="transparent" />
              ) : null}
            </View>
            <Text style={styles.qrWarning}>⚠️ This code is valid for one-time use only. Do not share it.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },

  // ── Hero card ──
  pointsCard: {
    borderRadius: 24, padding: 24, marginBottom: 20,
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  pointsCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pointsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  pointsValue: { fontSize: 52, fontWeight: '800', color: '#fff', lineHeight: 56 },
  pointsWorth: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6 },
  pointsIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  tierHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  tierHeroText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 1,
  },

  // ── Business card ──
  bizInfoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    marginBottom: 28,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  bizLogo: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#f1f5f9', marginRight: 16 },
  bizName: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  bizCategory: { fontSize: 13, color: '#64748b' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 14 },

  // ── Skeleton ──
  skeleton: { backgroundColor: '#f1f5f9' },
  skeletonLine: {
    height: 14, backgroundColor: '#e2e8f0',
    borderRadius: 7, width: '80%',
  },

  emptyCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 30,
    alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9',
    borderStyle: 'dashed', marginBottom: 16,
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  // ── Offer cards ──
  offerCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    minHeight: 80,
  },
  offerLeft: { flex: 1, marginRight: 12 },
  offerTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fef3c7', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 8,
  },
  offerTagLocked: { backgroundColor: '#f1f5f9' },
  offerTagText: { color: '#d97706', fontWeight: '800', fontSize: 11, marginLeft: 4 },
  offerTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  offerDesc: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  offerPointsRow: { flexDirection: 'row', alignItems: 'center' },
  offerPointsText: { fontSize: 12, color: '#64748b', marginLeft: 4 },
  redeemBtn: {
    backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 16, alignItems: 'center',
  },
  redeemBtnLocked: { backgroundColor: '#f1f5f9' },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Visit history ──
  visitCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    minHeight: 60,
  },
  visitIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#eff6ff', alignItems: 'center',
    justifyContent: 'center', marginRight: 14,
  },
  visitDate: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  visitAmount: { fontSize: 12, color: '#64748b' },
  visitPointsBadge: {
    backgroundColor: '#f0fdf4', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 10,
  },
  visitPointsText: { color: '#16a34a', fontWeight: '700', fontSize: 12 },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  modalCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center',
  },
  modalSubtitle: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 24 },
  redeemOfferInfo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4', padding: 14,
    borderRadius: 16, marginBottom: 28,
  },
  redeemOfferTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginLeft: 10 },
  qrWrapper: {
    alignSelf: 'center', padding: 24, backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10, marginBottom: 24,
  },
  qrWarning: { textAlign: 'center', color: '#94a3b8', fontSize: 12, lineHeight: 18 },
});
