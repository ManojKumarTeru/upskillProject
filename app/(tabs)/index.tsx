import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, MapPin, ChevronRight, RefreshCw } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function WalletScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);

  const userName = profile?.first_name || 'User';

  const fetchLoyaltyData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Fetch our loyalty connections joined with the business info
        const { data, error } = await supabase
          .from('customer_loyalty')
          .select(`
            id,
            current_points,
            total_visits,
            business:businesses (
              id,
              name,
              category,
              logo_url
            )
          `)
          .eq('user_id', session.user.id);

        if (error) throw error;
        
        setLoyaltyData(data || []);
        
        // Sum up total points for the big card
        const sum = data?.reduce((acc, curr) => acc + (curr.current_points || 0), 0) || 0;
        setTotalPoints(sum);
      }
    } catch (error: any) {
      console.error("Error fetching loyalty data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  if (loading) {
     return (
       <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#6366f1" />
       </View>
     );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good Morning,</Text>
            <Text style={styles.name}>{userName} 👋</Text>
          </View>
          <Pressable onPress={fetchLoyaltyData}>
             <RefreshCw size={20} color="#64748b" />
          </Pressable>
        </View>

        {/* The Golden Wallet Card (CRED/Swiggy Style) */}
        <Animated.View entering={FadeInDown.delay(100).duration(800)}>
          <LinearGradient
            colors={['#4f46e5', '#6366f1', '#818cf8']}
            style={styles.walletCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.walletTopRow}>
              <Text style={styles.walletLabel}>TOTAL LOYALTY POINTS</Text>
              <Sparkles color="#fff" size={20} />
            </View>
            <Text style={styles.walletBalance}>{totalPoints.toLocaleString()}</Text>
            <View style={styles.walletBottomRow}>
              <Text style={styles.walletInfo}>Worth ₹{Math.floor(totalPoints / 10)}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Real Data Linked</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Connected Shops Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Connected Shops ({loyaltyData.length})</Text>
          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        {/* EMPTY STATE */}
        {loyaltyData.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't scanned any shops yet!</Text>
            <Text style={styles.emptySubtext}>Head to a local partner and scan their QR code to start earning.</Text>
          </View>
        )}

        {/* LIVE SHOP CARDS */}
        {loyaltyData.map((item, index) => (
          <Animated.View key={item.id} entering={FadeInDown.delay(200 + (index * 100)).duration(800)}>
            <Pressable style={styles.shopCard}>
              <Image 
                source={{ uri: item.business?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.business?.name || 'Shop')}&background=random` }} 
                style={styles.shopImage} 
              />
              <View style={styles.shopDetails}>
                <Text style={styles.shopName}>{item.business?.name}</Text>
                <Text style={styles.shopCategory}>{item.business?.category} • {item.total_visits} Visits</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{item.current_points} POINTS ACTIVE</Text>
                </View>
              </View>
              <ChevronRight color="#cbd5e1" size={20} />
            </Pressable>
          </Animated.View>
        ))}

        {/* Spacer for bottom tabs */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Add these to your styles object at the bottom of the file
const extraStyles = {
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  }
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // Super clean off-white background
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e2e8f0',
  },
  walletCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  walletBalance: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    marginVertical: 12,
  },
  walletBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  walletInfo: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  shopCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  shopImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  shopDetails: {
    flex: 1,
    marginLeft: 16,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  shopCategory: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  discountBadge: {
    backgroundColor: '#fef3c7', // Amber light
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#d97706',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pointsText: {
    color: '#10b981', // Emerald
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  }
});
