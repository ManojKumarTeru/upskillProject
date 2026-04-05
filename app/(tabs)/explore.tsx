import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Dimensions, Image, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Search, MapPin, Star, ChevronRight, LayoutGrid, Clock, Filter, Award } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, SlideInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ExploreScreen() {
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          setUserLoc(location);
          fetchNearbyShops();
        } else {
          fetchNearbyShops(); // Fetch anyway even if no GPS
        }
      } catch (e) {
        fetchNearbyShops();
      }
    })();
  }, []);

  const fetchNearbyShops = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          business:businesses (*)
        `);

      if (error) throw error;
      setShops(data || []);
    } catch (err: any) {
      console.error('Error fetching shops:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Finding best rewards nearby...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Search */}
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.header}>
         <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Discover Centers</Text>
            <Pressable style={styles.filterBtn}>
               <Filter color="#fff" size={20} />
            </Pressable>
         </View>
         <View style={styles.searchBar}>
            <Search color="#94a3b8" size={18} />
            <Text style={styles.searchText}>Search shops, salons, cafes...</Text>
         </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Shops Near You</Text>

        {shops.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No shops found in this area yet.</Text>
          </View>
        ) : (
          shops.map((shop, i) => (
            <Animated.View 
              key={shop.id} 
              entering={FadeInDown.delay(i * 100).duration(600)}
            >
              <Pressable 
                style={styles.shopCard}
                onPress={() => router.push({
                   pathname: '/shop/[id]',
                   params: { id: shop.business_id, directExploration: 'true' }
                })}
              >
                <Image 
                  source={{ uri: shop.business?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop.business?.name || 'Shop')}&background=random` }}
                  style={styles.shopImage}
                />
                
                <View style={styles.cardOverlay}>
                  <View style={styles.tierBadge}>
                     <Award color="#f59e0b" size={10} fill="#f59e0b" />
                     <Text style={styles.tierText}>PARTNER SHOP</Text>
                  </View>
                </View>

                <View style={styles.shopInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.shopName}>{shop.business?.name}</Text>
                    <View style={styles.ratingBox}>
                       <Star size={12} fill="#f59e0b" color="#f59e0b" />
                       <Text style={styles.ratingValue}>4.8</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.shopCategory}>{shop.business?.category} • {shop.name}</Text>
                  
                  <View style={styles.footerRow}>
                    <View style={styles.distanceBadge}>
                       <MapPin color="#64748b" size={12} />
                       <Text style={styles.distanceText}>1.2 km away</Text>
                    </View>
                    <Pressable 
                      style={styles.viewBtn}
                      onPress={() => router.push({
                        pathname: '/shop/[id]',
                        params: { id: shop.business_id, directExploration: 'true' }
                      })}
                    >
                      <Text style={styles.viewBtnText}>View Offers</Text>
                      <ChevronRight color="#6366f1" size={16} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}

        {/* Spacer for bottom tabs */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchText: {
    marginLeft: 12,
    color: '#94a3b8',
    fontSize: 15,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  shopCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  shopImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  cardOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  shopInfo: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
    marginLeft: 4,
  },
  shopCategory: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
    marginRight: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
  }
});
