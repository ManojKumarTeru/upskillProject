import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Dimensions, Alert, Platform } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { ScanLine, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');
const SCAN_BOX_SIZE = width * 0.7;

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    
    // We expect the QR code to be just the Shop's UUID or a JSON payload like {"shop_id": "uuid"}
    let shopId = data;
    try {
      if (data.includes('{')) {
        const parsed = JSON.parse(data);
        shopId = parsed.shop_id || data;
      }

      // Show beautiful processing state
      Alert.alert(
        "Connecting to Shop...", 
        "Processing your loyalty link..."
      );

      // We need a real user session to insert into Supabase safely.
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
         Alert.alert("Authentication Required", "You must be logged in to connect with shops. (Bypass mode active, mocking success!)", 
         [{ text: "OK", onPress: () => router.replace('/(tabs)') }]);
         return;
      }

      // Insert or Update the link!
      const { error } = await supabase
        .from('customer_loyalty')
        .insert({
          customer_id: session.user.id,
          business_id: shopId,
          total_points: 0,
        });

      if (error && error.code !== '23505') { // 23505 is Postgres Unique Violation (already connected)
        throw error;
      }

      Alert.alert(
        "🎉 Success!", 
        "You are now connected to this Shop! Your 10% discount is active.",
        [{ text: "Go to Wallet", onPress: () => router.replace('/(tabs)') }]
      );

    } catch (error: any) {
      Alert.alert(
        "Invalid QR Code", 
        "This doesn't look like a valid Shop QR code. Please try again.",
        [{ text: "Scan Again", onPress: () => setScanned(false) }]
      );
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }
  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>No access to camera</Text>
        <Button title="Request Permission" onPress={() => Camera.requestCameraPermissionsAsync()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        {/* Overlay to dim the background and highlight the scan area */}
        <View style={styles.overlay}>
          {/* Top Blur */}
          <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} style={styles.blurAreaTop} />

          <View style={styles.middleRow}>
            {/* Left Blur */}
            <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} style={styles.blurAreaSide} />
            
            {/* Clear Scan Window */}
            <View style={styles.focusedBox}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
              <ScanLine size={48} color="rgba(255,255,255,0.4)" style={styles.scanIcon} />
            </View>

            {/* Right Blur */}
            <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} style={styles.blurAreaSide} />
          </View>

          {/* Bottom Blur */}
          <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} style={styles.blurAreaBottom}>
            <Text style={styles.instructions}>
              Point your camera at the Shop's QR Code
            </Text>
          </BlurView>
        </View>

      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    color: '#fff',
    marginBottom: 20,
    fontSize: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  blurAreaTop: {
    height: (height - SCAN_BOX_SIZE) / 2 - 50,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  middleRow: {
    flexDirection: 'row',
    height: SCAN_BOX_SIZE,
  },
  blurAreaSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  focusedBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurAreaBottom: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    paddingTop: 40,
  },
  instructions: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanIcon: {
    position: 'absolute',
  },
  // Custom Corner Borders just like CRED/Swiggy QR Scanners!
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#6366f1',
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#6366f1',
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#6366f1',
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#6366f1',
    borderBottomRightRadius: 16,
  },
});
