import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { X, Check, Award, Calculator, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function ScanCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedUser, setScannedUser] = useState<any>(null);
  const [billAmount, setBillAmount] = useState('');
  const [businessInfo, setBusinessInfo] = useState<any>(null);

  useEffect(() => {
    fetchBusinessContext();
  }, []);

  const fetchBusinessContext = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('business_staff')
      .select('business_id, location_id')
      .eq('user_id', user.id)
      .single();
    
    if (!error && data) {
      setBusinessInfo(data);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      const payload = JSON.parse(data);
      if (payload.type !== 'customer' || !payload.user_id) {
        throw new Error("Invalid QR Code: Not a Customer Digital ID.");
      }

      // Fetch customer details
      const { data: customer, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', payload.user_id)
        .single();

      if (error || !customer) throw new Error("Customer not found.");
      
      setScannedUser(customer);
    } catch (err: any) {
      Alert.alert("Scan Error", err.message);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const processTransaction = async () => {
    if (!billAmount || isNaN(parseFloat(billAmount))) {
      Alert.alert("Invalid Amount", "Please enter a valid bill amount.");
      return;
    }

    setLoading(true);
    try {
      const amount = parseFloat(billAmount);
      const points = Math.floor(amount / 100); // 1 point per 100 INR
      
      if (!businessInfo || !scannedUser) throw new Error("Missing transaction context.");

      // Atomic Transaction (using RPC or sequential updates)
      // For simplicity in this demo, we'll do sequential updates
      
      // 1. Log the visit
      const { error: visitError } = await supabase
        .from('visit_logs')
        .insert({
          location_id: businessInfo.location_id,
          user_id: scannedUser.id,
          amount_spent: amount,
          points_earned: points,
          visit_time: new Date().toISOString()
        });

      if (visitError) throw visitError;

      // 2. Update/Upsert loyalty profile
      const { error: loyaltyError } = await supabase
        .from('customer_loyalty')
        .upsert({
          business_id: businessInfo.business_id,
          user_id: scannedUser.id,
          joined_at_location_id: businessInfo.location_id,
          total_visits: 1, // Will be incremented by trigger or manual logic
          total_spent: amount,
          current_points: points,
          last_visited_at: new Date().toISOString()
        }, { onConflict: 'business_id, user_id' }); 
      
      // NOTE: In production, use a Database Function (RPC) to handle increments safely (+1 visit, +amount).
      // Here we assume the DB handle upsert or we perform a manual increment if needed.
      
      if (loyaltyError) throw loyaltyError;

      Alert.alert(
        "🎉 Success!", 
        `Transaction of ₹${amount} recorded. ${points} points awarded to ${scannedUser.first_name}.`,
        [{ text: "Done", onPress: () => router.back() }]
      );

    } catch (err: any) {
      Alert.alert("Transaction Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={styles.container}><ActivityIndicator size="large" color="#6366f1" /></View>;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Pressable onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Staff Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      {!scannedUser ? (
        <View style={styles.cameraWrapper}>
          <CameraView 
            style={styles.camera} 
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          >
            <View style={styles.overlay}>
               <View style={styles.scanFrame} />
               <Text style={styles.scanText}>Scan Customer Digital ID</Text>
            </View>
          </CameraView>
        </View>
      ) : (
        <View style={styles.txContainer}>
          <LinearGradient
            colors={['#0f172a', '#1e1b4b']}
            style={styles.customerCard}
          >
             <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{scannedUser.first_name?.[0]}{scannedUser.last_name?.[0]}</Text>
             </View>
             <Text style={styles.customerName}>{scannedUser.first_name} {scannedUser.last_name}</Text>
             <Text style={styles.customerSubtitle}>Verify customer identity before recording</Text>
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

            <View style={styles.pointsPreview}>
               <Award color="#f59e0b" size={20} />
               <Text style={styles.pointsText}>
                  Worthy of {Math.floor(parseFloat(billAmount || '0') / 100)} Points
               </Text>
            </View>

            <View style={styles.actionRow}>
               <Pressable 
                style={styles.cancelBtn} 
                onPress={() => {
                  setScannedUser(null);
                  setScanned(false);
                  setBillAmount('');
                }}
               >
                  <Text style={styles.cancelBtnText}>Discard</Text>
               </Pressable>
               <Pressable 
                style={[styles.confirmBtn, loading && { opacity: 0.7 }]} 
                onPress={processTransaction}
                disabled={loading}
               >
                  <Text style={styles.confirmBtnText}>{loading ? 'Processing...' : 'Confirm Bill'}</Text>
               </Pressable>
            </View>
          </View>
        </View>
      )}

      {loading && !scannedUser && (
        <View style={styles.loadingOverlay}>
           <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  scanText: {
    color: '#fff',
    marginTop: 30,
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  txContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  customerCard: {
    padding: 40,
    alignItems: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  customerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  customerSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
  },
  form: {
    padding: 24,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 12,
    letterSpacing: 1,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 72,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
  },
  pointsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 16,
    marginBottom: 40,
  },
  pointsText: {
    marginLeft: 10,
    color: '#d97706',
    fontWeight: '700',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 16,
  },
  confirmBtn: {
    flex: 2,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#fff',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
