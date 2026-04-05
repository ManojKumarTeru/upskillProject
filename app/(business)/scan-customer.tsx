import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Award, Calculator, ArrowLeft, CheckCircle, Tag, Gift } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import HapticPressable from '@/components/HapticPressable';

// What mode the scanner is showing after a scan
type ScanMode = 'idle' | 'bill' | 'redeem';

export default function ScanCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<any>(null);

  // BILL mode state
  const [scanMode, setScanMode] = useState<ScanMode>('idle');
  const [scannedCustomer, setScannedCustomer] = useState<any>(null);
  const [billAmount, setBillAmount] = useState('');

  // REDEEM mode state
  const [redeemPayload, setRedeemPayload] = useState<any>(null);
  const [redeemOffer, setRedeemOffer] = useState<any>(null);
  const [redeemLoyalty, setRedeemLoyalty] = useState<any>(null);

  useEffect(() => {
    fetchBusinessContext();
  }, []);

  const fetchBusinessContext = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('business_staff')
      .select('business_id, location_id')
      .eq('user_id', user.id)
      .single();
    if (data) setBusinessInfo(data);
  };

  const resetScanner = () => {
    setScanMode('idle');
    setScanned(false);
    setScannedCustomer(null);
    setBillAmount('');
    setRedeemPayload(null);
    setRedeemOffer(null);
    setRedeemLoyalty(null);
  };

  // ─── MAIN SCAN HANDLER ────────────────────────────────────────
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      const payload = JSON.parse(data);

      // ── CASE 1: Customer Digital ID (Bill Recording) ──
      if (payload.type === 'customer' && payload.user_id) {
        const { data: customer, error } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', payload.user_id)
          .single();
        if (error || !customer) throw new Error('Customer not found.');
        setScannedCustomer(customer);
        setScanMode('bill');

      // ── CASE 2: Redemption QR ──
      } else if (payload.type === 'redeem' && payload.offer_id && payload.user_id) {
        // Validate the QR isn't too old (10 min window)
        const ageMs = Date.now() - (payload.ts || 0);
        if (ageMs > 10 * 60 * 1000) {
          throw new Error('This redemption code has expired. Ask the customer to regenerate it.');
        }

        // Fetch customer, offer and their loyalty profile in parallel
        const [customerRes, offerRes, loyaltyRes] = await Promise.all([
          supabase.from('users').select('id, first_name, last_name').eq('id', payload.user_id).single(),
          supabase.from('offers').select('*').eq('id', payload.offer_id).single(),
          supabase.from('customer_loyalty').select('*')
            .eq('id', payload.loyalty_id)
            .single(),
        ]);

        if (customerRes.error || !customerRes.data) throw new Error('Customer not found.');
        if (offerRes.error || !offerRes.data) throw new Error('Offer not found.');
        if (loyaltyRes.error || !loyaltyRes.data) throw new Error('Customer loyalty profile not found.');

        const loyalty = loyaltyRes.data;
        const offer   = offerRes.data;

        if (loyalty.current_points < offer.discount_value) {
          throw new Error(
            `Insufficient points! Customer has ${loyalty.current_points} pts but needs ${offer.discount_value} pts.`
          );
        }

        setScannedCustomer(customerRes.data);
        setRedeemOffer(offer);
        setRedeemLoyalty(loyalty);
        setRedeemPayload(payload);
        setScanMode('redeem');

      } else {
        throw new Error('Unknown QR Code type. Please scan a valid Customer ID or Redemption code.');
      }
    } catch (err: any) {
      Alert.alert('Scan Error', err.message, [{ text: 'Try Again', onPress: resetScanner }]);
    } finally {
      setLoading(false);
    }
  };

  // ─── PROCESS BILL TRANSACTION ────────────────────────────────
  const processTransaction = async () => {
    if (!billAmount || isNaN(parseFloat(billAmount))) {
      Alert.alert('Invalid Amount', 'Please enter a valid bill amount.');
      return;
    }
    setLoading(true);
    try {
      const amount = parseFloat(billAmount);
      const points = Math.floor(amount / 100);
      if (!businessInfo || !scannedCustomer) throw new Error('Missing transaction context.');

      await supabase.from('visit_logs').insert({
        location_id: businessInfo.location_id,
        user_id: scannedCustomer.id,
        amount_spent: amount,
        points_earned: points,
        visit_time: new Date().toISOString(),
      });

      // Use RPC-style update: increment fields rather than overwrite
      await supabase.rpc('increment_loyalty', {
        p_business_id: businessInfo.business_id,
        p_user_id: scannedCustomer.id,
        p_location_id: businessInfo.location_id,
        p_amount: amount,
        p_points: points,
      }).then(({ error }) => {
        // Fallback: upsert if RPC doesn't exist yet
        if (error) {
          return supabase.from('customer_loyalty').upsert({
            business_id: businessInfo.business_id,
            user_id: scannedCustomer.id,
            joined_at_location_id: businessInfo.location_id,
            total_visits: 1,
            total_spent: amount,
            current_points: points,
            last_visited_at: new Date().toISOString(),
          }, { onConflict: 'business_id, user_id' });
        }
      });

      Alert.alert(
        '🎉 Bill Recorded!',
        `₹${amount} recorded.\n${points} points awarded to ${scannedCustomer.first_name}.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Transaction Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── CONFIRM REDEMPTION ───────────────────────────────────────
  const confirmRedemption = async () => {
    setLoading(true);
    try {
      if (!redeemLoyalty || !redeemOffer || !redeemPayload) throw new Error('Missing redemption context.');

      const newPoints = redeemLoyalty.current_points - redeemOffer.discount_value;

      // 1. Deduct points from loyalty
      const { error: deductError } = await supabase
        .from('customer_loyalty')
        .update({ current_points: newPoints })
        .eq('id', redeemLoyalty.id);
      if (deductError) throw deductError;

      // 2. Log it in notifications (audit trail)
      await supabase.from('notifications').insert({
        business_id: redeemOffer.business_id,
        user_id: redeemPayload.user_id,
        offer_id: redeemOffer.id,
        title: `Offer Redeemed: ${redeemOffer.title}`,
        body: `Customer redeemed ${redeemOffer.discount_value} pts. Remaining: ${newPoints} pts.`,
        status: 'sent',
      });

      Alert.alert(
        '✅ Redemption Confirmed!',
        `${redeemOffer.discount_value} points deducted from ${scannedCustomer.first_name}.\nRemaining balance: ${newPoints} pts.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Redemption Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── PERMISSION SCREENS ───────────────────────────────────────
  if (!permission) return <View style={styles.container}><ActivityIndicator size="large" color="#6366f1" /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Text style={[styles.message, { marginBottom: 20, fontSize: 16 }]}>Camera access is needed to scan customers.</Text>
        <Pressable onPress={requestPermission} style={styles.confirmBtn}>
          <Text style={styles.confirmBtnText}>Grant Camera Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <HapticPressable onPress={() => router.back()} style={styles.closeBtn}>
          <ArrowLeft color="#fff" size={24} />
        </HapticPressable>
        <Text style={styles.headerTitle}>
          {scanMode === 'idle'  ? 'Staff Scanner' :
           scanMode === 'bill'  ? 'Record Bill' :
                                  'Confirm Redemption'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── IDLE: Camera View ── */}
      {scanMode === 'idle' && (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>Scan Customer ID or Redemption QR</Text>
            </View>
          </CameraView>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          )}
        </View>
      )}

      {/* ── BILL MODE ── */}
      {scanMode === 'bill' && scannedCustomer && (
        <View style={styles.txContainer}>
          <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.customerCard}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{scannedCustomer.first_name?.[0]}{scannedCustomer.last_name?.[0]}</Text>
            </View>
            <Text style={styles.customerName}>{scannedCustomer.first_name} {scannedCustomer.last_name}</Text>
            <Text style={styles.customerSubtitle}>Enter the bill amount to award points</Text>
          </LinearGradient>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ENTER BILL AMOUNT (₹)</Text>
              <View style={styles.amountInputRow}>
                <Calculator color="#6366f1" size={24} style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  placeholder="2000"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={billAmount}
                  onChangeText={setBillAmount}
                  autoFocus
                />
              </View>
            </View>
            <View style={styles.previewBadge}>
              <Award color="#f59e0b" size={20} />
              <Text style={styles.previewText}>
                Will award {Math.floor(parseFloat(billAmount || '0') / 100)} Points
              </Text>
            </View>
            <View style={styles.actionRow}>
              <HapticPressable style={styles.cancelBtn} onPress={resetScanner}>
                <Text style={styles.cancelBtnText}>Discard</Text>
              </HapticPressable>
              <HapticPressable style={[styles.confirmBtn, loading && { opacity: 0.7 }]} onPress={processTransaction} disabled={loading}>
                <Text style={styles.confirmBtnText}>{loading ? 'Processing...' : 'Confirm Bill'}</Text>
              </HapticPressable>
            </View>
          </View>
        </View>
      )}

      {/* ── REDEEM MODE ── */}
      {scanMode === 'redeem' && scannedCustomer && redeemOffer && (
        <ScrollView style={styles.txContainer} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Emerald header for redemption */}
          <LinearGradient colors={['#064e3b', '#065f46']} style={styles.customerCard}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.3)' }]}>
              <Gift color="#10b981" size={40} />
            </View>
            <Text style={styles.customerName}>{scannedCustomer.first_name} {scannedCustomer.last_name}</Text>
            <Text style={styles.customerSubtitle}>Wants to redeem an offer</Text>
          </LinearGradient>

          <View style={styles.form}>
            {/* Offer Info Card */}
            <View style={styles.redeemOfferCard}>
              <View style={styles.redeemOfferRow}>
                <Tag color="#6366f1" size={20} />
                <Text style={styles.redeemOfferTitle}>{redeemOffer.title}</Text>
              </View>
              {redeemOffer.description ? (
                <Text style={styles.redeemOfferDesc}>{redeemOffer.description}</Text>
              ) : null}
            </View>

            {/* Points Summary */}
            <View style={styles.pointsSummaryCard}>
              <View style={styles.pointsSummaryRow}>
                <Text style={styles.pointsSummaryLabel}>Customer has</Text>
                <Text style={styles.pointsSummaryValue}>{redeemLoyalty?.current_points ?? 0} pts</Text>
              </View>
              <View style={styles.pointsSummaryRow}>
                <Text style={styles.pointsSummaryLabel}>Points required</Text>
                <Text style={[styles.pointsSummaryValue, { color: '#ef4444' }]}>−{redeemOffer.discount_value} pts</Text>
              </View>
              <View style={[styles.pointsSummaryRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, marginTop: 4 }]}>
                <Text style={[styles.pointsSummaryLabel, { fontWeight: '700', color: '#0f172a' }]}>Remaining after</Text>
                <Text style={[styles.pointsSummaryValue, { color: '#10b981', fontSize: 20 }]}>
                  {(redeemLoyalty?.current_points ?? 0) - redeemOffer.discount_value} pts
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <HapticPressable style={styles.cancelBtn} onPress={resetScanner}>
                <Text style={styles.cancelBtnText}>Reject</Text>
              </HapticPressable>
              <HapticPressable
                style={[styles.confirmBtn, { backgroundColor: '#10b981' }, loading && { opacity: 0.7 }]}
                onPress={confirmRedemption}
                disabled={loading}
              >
                <CheckCircle color="#fff" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>{loading ? 'Confirming...' : 'Confirm & Deduct'}</Text>
              </HapticPressable>
            </View>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraWrapper: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    width: 250, height: 250, borderWidth: 2,
    borderColor: '#6366f1', borderRadius: 24,
    backgroundColor: 'rgba(99,102,241,0.05)',
  },
  scanText: { color: '#fff', marginTop: 30, fontSize: 15, fontWeight: '600', opacity: 0.85, textAlign: 'center', paddingHorizontal: 40 },
  txContainer: { flex: 1, backgroundColor: '#f8fafc', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  customerCard: { padding: 36, alignItems: 'center', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '700' },
  customerName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  customerSubtitle: { color: '#94a3b8', fontSize: 13 },
  form: { padding: 24, flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 12, letterSpacing: 1 },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 20, height: 72,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  input: { flex: 1, fontSize: 32, fontWeight: '800', color: '#0f172a' },
  previewBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fef3c7', padding: 16,
    borderRadius: 16, marginBottom: 36,
  },
  previewText: { marginLeft: 10, color: '#d97706', fontWeight: '700', fontSize: 15 },
  // Redeem-specific
  redeemOfferCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  redeemOfferRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  redeemOfferTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginLeft: 10 },
  redeemOfferDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  pointsSummaryCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginBottom: 36, borderWidth: 1, borderColor: '#e2e8f0',
  },
  pointsSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pointsSummaryLabel: { fontSize: 14, color: '#64748b' },
  pointsSummaryValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  // Shared
  actionRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, height: 64, borderRadius: 32,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#64748b', fontWeight: '700', fontSize: 16 },
  confirmBtn: {
    flex: 2, height: 64, borderRadius: 32,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  message: { textAlign: 'center', color: '#fff' },
});
