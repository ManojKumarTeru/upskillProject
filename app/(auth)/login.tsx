import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Alert, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Animated, { FadeInDown, FadeInUp, withSpring, useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import { Smartphone, ArrowRight, Lock, UserCircle, MessageSquare } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [timer, setTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  
  // States and Values for Premium Notification
  const [isNotifVisible, setIsNotifVisible] = useState(false);
  const notifY = useSharedValue(-150);
  const scale = useSharedValue(1);
  
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];

  // ANIMATION: Slid-down Notification
  const notifStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: notifY.value }],
    opacity: withTiming(isNotifVisible ? 1 : 0),
  }));

  const showPremiumNotif = () => {
    setIsNotifVisible(true);
    notifY.value = withSequence(
      withSpring(20, { damping: 12 }), // Slide down
      withDelay(5000, withSpring(-150)) // Slide back after 5s
    );
  };

  // Trigger Notification when OTP is generated
  useEffect(() => {
    if (step === 'OTP' && generatedOtp) {
      console.log("🔑 [DEV MODE] Dynamic OTP:", generatedOtp);
      showPremiumNotif();
    }
  }, [step, generatedOtp]);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: scale.value }] };
  });

  const handlePressIn = () => { scale.value = withSpring(0.95); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  useEffect(() => {
    let interval: any;
    if (step === 'OTP' && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const initiateOTP = () => {
    if (phoneNumber.length < 10) {
      Alert.alert("Invalid Number", "Please enter a 10-digit mobile number.");
      return;
    }
    
    setIsLoading(true);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    setTimeout(() => {
      setGeneratedOtp(code);
      setIsLoading(false);
      setStep('OTP');
      setTimer(60);
    }, 1000);
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text.length === 1 && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const syncSessionToDB = async (userId: string) => {
    try {
      const token = Device.isDevice 
        ? (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId || 'dummy' })).data 
        : `sim-token-${userId}`;

      await supabase.from('user_sessions').upsert({
        user_id: userId,
        device_token: token,
        device_type: Platform.OS === 'ios' ? 'ios' : (Platform.OS === 'android' ? 'android' : 'web'),
        last_seen: new Date().toISOString(),
        meta: { modelName: Device.modelName, osVersion: Device.osVersion }
      }, { onConflict: 'device_token' });
    } catch (e) {
      console.warn("📱 Session Sync Warning:", e);
    }
  };

  const verifyOTP = async () => {
    const enteredCode = otp.join('');
    if (enteredCode !== generatedOtp) {
      Alert.alert("Invalid OTP", "The code you entered is incorrect.");
      return;
    }

    setIsLoading(true);
    try {
      const dummyEmail = `${phoneNumber}@upskill.com`;
      const dummyPassword = `Pass#${phoneNumber}`;
      let { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: dummyPassword,
      });

      if (authError || !session) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: dummyEmail,
          password: dummyPassword,
          options: { data: { phone: phoneNumber } }
        });
        
        if (signUpError && signUpError.message.includes('rate limit')) {
           const { data: devAuth } = await supabase.auth.signInWithPassword({
             email: 'founder@upskill.com',
             password: 'SuperSecretPassword123!',
           });
           session = devAuth.session;
        } else if (!signUpError) {
           session = signUpData.session;
        }
      }

      const userId = session?.user?.id;
      if (!userId) throw new Error("Could not establish a database identity.");

      const { data: profile } = await supabase
        .from('users')
        .select('first_name, email')
        .eq('id', userId)
        .maybeSingle();

      if (profile && profile.first_name) {
        await syncSessionToDB(userId);
        router.replace('/(tabs)');
      } else {
        setStep('PROFILE');
      }
    } catch (error: any) {
      Alert.alert("Verify Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileComplete = async () => {
    if (!firstName || !lastName || !email) {
      Alert.alert("Incomplete", "Please provide your full name and email.");
      return;
    }
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("No active session found.");

      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phoneNumber,
        }, { onConflict: 'id' });

      if (error) throw error;
      await syncSessionToDB(user.id);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert("Save Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = () => {
    if (timer > 0) return;
    initiateOTP();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={StyleSheet.absoluteFillObject} />

      {/* 🚀 PREMIUM NOTIFICATION (Slides Down) */}
      <Animated.View style={[styles.notifContainer, notifStyle]}>
        <BlurView intensity={80} tint="dark" style={styles.notifBlur}>
          <View style={styles.notifIcon}><MessageSquare color="#10b981" size={24} /></View>
          <View style={styles.notifTextContainer}>
            <Text style={styles.notifTitle}>New Message • SMS</Text>
            <Text style={styles.notifBody}>
              Your verification code is <Text style={styles.notifCode}>{generatedOtp}</Text>. Do not share it.
            </Text>
          </View>
        </BlurView>
      </Animated.View>

      {step === 'PHONE' && (
        <Animated.View style={styles.content} entering={FadeInDown.duration(800)}>
          <View style={styles.headerIconBox}><Smartphone color="#6366f1" size={48} /></View>
          <Text style={styles.title}>Welcome back.</Text>
          <Text style={styles.subtitle}>Enter your mobile number to instantly access your local network.</Text>
          <View style={styles.inputContainer}>
             <Text style={styles.prefix}>+91</Text>
             <TextInput 
               style={styles.input} placeholder="9876543210" placeholderTextColor="rgba(255,255,255,0.3)"
               keyboardType="phone-pad" maxLength={10} value={phoneNumber} onChangeText={setPhoneNumber} autoFocus
             />
          </View>
          <Pressable style={styles.nextButton} onPress={initiateOTP} disabled={isLoading}>
            <Text style={styles.nextButtonText}>{isLoading ? "Loading..." : "Get OTP Code"}</Text>
            <ArrowRight color="#fff" size={20} style={{ marginLeft: 8 }} />
          </Pressable>
        </Animated.View>
      )}

      {step === 'OTP' && (
        <Animated.View style={styles.content} entering={FadeInDown.duration(800)}>
          <View style={styles.headerIconBox}><Lock color="#10b981" size={40} /></View>
          <Text style={styles.title}>Quick Check.</Text>
          <Text style={styles.subtitle}>We've sent a code to +91 {phoneNumber}</Text>
          
          <View style={styles.otpRow}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx} ref={otpRefs[idx]} style={styles.otpInput}
                keyboardType="number-pad" maxLength={1} value={digit}
                onChangeText={(t) => handleOtpChange(t, idx)}
                autoFocus={idx === 0}
              />
            ))}
          </View>

          <Pressable onPress={resendOtp}>
            <Text style={[styles.resendText, timer > 0 && { color: 'rgba(255,255,255,0.3)' }]}>
              {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
            </Text>
          </Pressable>

          <Pressable style={[styles.nextButton, { marginTop: 40 }]} onPress={verifyOTP} disabled={isLoading}>
            <Text style={styles.nextButtonText}>{isLoading ? "Verifying..." : "Confirm & Unlock"}</Text>
            <ArrowRight color="#fff" size={20} style={{ marginLeft: 8 }} />
          </Pressable>
          <Pressable style={styles.backLink} onPress={() => setStep('PHONE')}><Text style={styles.backLinkText}>Change Number</Text></Pressable>
        </Animated.View>
      )}

      {step === 'PROFILE' && (
        <Animated.View style={styles.content} entering={FadeInUp.duration(800)}>
          <View style={styles.headerIconBox}><UserCircle color="#a855f7" size={56} /></View>
          <Text style={styles.title}>Let's get started.</Text>
          <View style={styles.form}>
             <View style={styles.profileInputContainer}>
                <TextInput 
                  style={styles.profileInput} placeholder="First Name" placeholderTextColor="rgba(255,255,255,0.3)"
                  value={firstName} onChangeText={setFirstName} autoFocus
                />
             </View>
             <View style={styles.profileInputContainer}>
                <TextInput 
                  style={styles.profileInput} placeholder="Last Name" placeholderTextColor="rgba(255,255,255,0.3)"
                  value={lastName} onChangeText={setLastName}
                />
             </View>
             <View style={styles.profileInputContainer}>
                <TextInput 
                  style={styles.profileInput} placeholder="Email Address" placeholderTextColor="rgba(255,255,255,0.3)"
                  value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
                />
             </View>
          </View>
          <Pressable style={[styles.nextButton, { backgroundColor: '#a855f7' }]} onPress={handleProfileComplete} disabled={isLoading}>
            <Text style={styles.nextButtonText}>{isLoading ? "Joining..." : "Finalize & Join"}</Text>
            <ArrowRight color="#fff" size={20} style={{ marginLeft: 8 }} />
          </Pressable>
        </Animated.View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  headerIconBox: { width: 90, height: 90, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, paddingHorizontal: 24, height: 70, marginTop: 40, marginBottom: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  prefix: { color: '#fff', fontSize: 24, fontWeight: '700', marginRight: 16 },
  input: { flex: 1, color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  nextButton: { flexDirection: 'row', width: '100%', backgroundColor: '#6366f1', paddingVertical: 20, borderRadius: 100, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  otpRow: { flexDirection: 'row', gap: 14, marginVertical: 40 },
  otpInput: { width: 66, height: 76, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 34, fontWeight: '800', textAlign: 'center' },
  resendText: { color: '#10b981', fontSize: 15, fontWeight: '600' },
  backLink: { marginTop: 30 },
  backLinkText: { color: '#64748b', fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },
  form: { width: '100%', marginTop: 20, gap: 16, marginBottom: 40 },
  profileInputContainer: { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, paddingHorizontal: 24, height: 64, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' },
  profileInput: { color: '#fff', fontSize: 18, fontWeight: '600' },
  
  // Notification Styles
  notifContainer: { position: 'absolute', top: 40, left: 15, right: 15, zIndex: 9999, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  notifBlur: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  notifIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  notifTextContainer: { flex: 1 },
  notifTitle: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  notifBody: { fontSize: 15, color: '#fff', fontWeight: '500' },
  notifCode: { fontSize: 18, color: '#10b981', fontWeight: '800' }
});
