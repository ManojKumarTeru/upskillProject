import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Share, Clipboard, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { ChevronLeft, Gift, Copy, Share2, Users, Star, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function ReferralScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    const initReferral = async () => {
       if (!profile || !session?.user) return;

       // 1. Check if user already has a referral code in meta
       let code = profile.meta?.referral_code;

       if (!code) {
          // Generate a new code: FIRSTNAME + 3 random digits
          const namePart = (profile.first_name || 'USER').toUpperCase().substring(0, 4);
          const randomPart = Math.floor(100 + Math.random() * 900);
          code = `${namePart}${randomPart}`;

          // Save it to Supabase meta field
          const updatedMeta = { ...(profile.meta || {}), referral_code: code };
          await supabase
            .from('users')
            .update({ meta: updatedMeta })
            .eq('id', session.user.id);
       }

       setReferralCode(code);
       
       // 2. Mock: Logic for counting how many people used this code
       // In a real app, this would query a 'referrals' table.
       setReferralCount(profile.meta?.referral_count || 0);
       setLoading(false);
    };

    initReferral();
  }, [profile]);

  const handleCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `🎁 Hey! I'm inviting you to join upskillProject. Earn rewards at your favorite local spots. Use my code ${referralCode} to get a head start! 🚀\n\nDownload now: https://upskillproject.app/invite/${referralCode}`,
      });
    } catch (error: any) {
      console.error('Sharing failed:', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <LinearGradient
            colors={['#4f46e5', '#6366f1']}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
             <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Give 50, Get 50</Text>
                <Text style={styles.heroSub}>Invite your friends to the club. When they join using your code, both of you earn 50 bonus points!</Text>
             </View>
             <View style={styles.giftIconBox}>
                <Gift size={80} color="#fff" opacity={0.2} />
             </View>
          </LinearGradient>
        </Animated.View>

        {/* Code Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.codeSection}>
           <Text style={styles.sectionLabel}>YOUR PERSONAL CODE</Text>
           <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{referralCode}</Text>
              <Pressable style={styles.copyBtn} onPress={handleCopy}>
                 {copied ? <CheckCircle2 size={24} color="#10b981" /> : <Copy size={24} color="#6366f1" />}
                 <Text style={[styles.copyLabel, copied && { color: '#10b981' }]}>
                    {copied ? 'Copied!' : 'Copy'}
                 </Text>
              </Pressable>
           </View>
        </Animated.View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
           <View style={styles.statCard}>
              <Users size={24} color="#6366f1" />
              <Text style={styles.statVal}>{referralCount}</Text>
              <Text style={styles.statLabel}>Friends Joined</Text>
           </View>
           <View style={styles.statCard}>
              <Star size={24} color="#f59e0b" />
              <Text style={styles.statVal}>{referralCount * 50}</Text>
              <Text style={styles.statLabel}>Points Earned</Text>
           </View>
        </View>

        {/* How it works */}
        <View style={styles.infoSection}>
           <Text style={styles.sectionTitle}>How it works</Text>
           <View style={styles.step}>
              <View style={styles.stepDot}><Text style={styles.stepNum}>1</Text></View>
              <Text style={styles.stepText}>Share your unique code with your friends via WhatsApp or SMS.</Text>
           </View>
           <View style={styles.step}>
              <View style={styles.stepDot}><Text style={styles.stepNum}>2</Text></View>
              <Text style={styles.stepText}>Your friend joins upskillProject and enters your code.</Text>
           </View>
           <View style={styles.step}>
              <View style={styles.stepDot}><Text style={styles.stepNum}>3</Text></View>
              <Text style={styles.stepText}>Boom! Both you and your friend get 50 bonus points immediately.</Text>
           </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <View style={styles.footer}>
         <Pressable style={styles.shareBtn} onPress={handleShare}>
            <LinearGradient
               colors={['#0f172a', '#1e293b']}
               style={styles.shareGradient}
               start={{ x: 0, y: 0 }}
               end={{ x: 1, y: 0 }}
            >
               <Share2 color="#fff" size={20} />
               <Text style={styles.shareText}>Invite Friends Now</Text>
               <Sparkles color="#fbbf24" size={16} style={{ marginLeft: 8 }} />
            </LinearGradient>
         </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    marginBottom: 40,
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    zIndex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  giftIconBox: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 2,
    marginBottom: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 8,
    paddingLeft: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  codeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 4,
  },
  copyBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  copyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  infoSection: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6366f1',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'transparent',
  },
  shareBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  shareGradient: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 12,
  }
});
