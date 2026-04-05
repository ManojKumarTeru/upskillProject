import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Image, Platform, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { ChevronLeft, Gift, Inbox, Bell } from 'lucide-react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import HapticPressable from '@/components/HapticPressable';

export default function NotificationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // --- SKELETON COMPONENT ---
  const NotificationSkeleton = () => {
    const opacity = useSharedValue(0.3);
    
    useEffect(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    return (
      <View style={styles.notifCard}>
         <Animated.View style={[styles.notifLogo, { backgroundColor: '#e2e8f0' }, animatedStyle]} />
         <View style={styles.notifContent}>
            <Animated.View style={[styles.skeletonLine, { width: '40%', height: 10, marginBottom: 8 }, animatedStyle]} />
            <Animated.View style={[styles.skeletonLine, { width: '80%', height: 14, marginBottom: 6 }, animatedStyle]} />
            <Animated.View style={[styles.skeletonLine, { width: '90%', height: 12 }, animatedStyle]} />
         </View>
      </View>
    );
  };

  const fetchNotifications = async (isSilent = false) => {
    if (!session?.user) return;
    if (!isSilent) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          business:businesses (
            name,
            logo_url
          )
        `)
        .eq('user_id', session.user.id)
        .order('sent_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
      
      // Cache the results for instant mount next time
      await AsyncStorage.setItem(`notifs_${session.user.id}`, JSON.stringify(data || []));
      
      if (isSilent) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Mark unread as read
      const unreadIds = data?.filter(n => n.status === 'sent').map(n => n.id) || [];
      if (unreadIds.length > 0) {
          await supabase
            .from('notifications')
            .update({ status: 'read' })
            .in('id', unreadIds);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
  }, [session?.user]);

  useEffect(() => {
    const loadInitialData = async () => {
       if (!session?.user) return;
       
       // 1. Try to load from Cache (Instant!)
       const cache = await AsyncStorage.getItem(`notifs_${session.user.id}`);
       if (cache) {
          setNotifications(JSON.parse(cache));
          setLoading(false);
          // Refresh silently in background
          fetchNotifications(true);
       } else {
          // No cache, fetch with skeleton
          fetchNotifications();
       }
    };
    
    loadInitialData();
  }, [session?.user]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <HapticPressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={24} />
        </HapticPressable>
        <Text style={styles.headerTitle}>Inbox</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {loading ? (
             // SKELETON STATE
             <View>
                {[1, 2, 3, 4, 5, 6].map(i => <NotificationSkeleton key={i} />)}
             </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
                <Inbox size={48} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>New offers and updates from your shops will appear here.</Text>
          </View>
        ) : (
          notifications.map((notif, i) => (
            <Animated.View 
              key={notif.id} 
              entering={FadeInDown.delay(i * 50).duration(400)}
            >
              <HapticPressable 
                style={[styles.notifCard, notif.status === 'sent' && styles.unreadCard]}
                onPress={() => {
                   if (notif.business_id) {
                      router.push({
                        pathname: '/shop/[id]',
                        params: { id: notif.business_id }
                      });
                   }
                }}
              >
                <Image 
                  source={{ uri: notif.business?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.business?.name || 'Shop')}&background=random` }}
                  style={styles.notifLogo}
                />
                
                <View style={styles.notifContent}>
                  <View style={styles.notifHeader}>
                    <Text style={styles.bizName}>{notif.business?.name}</Text>
                    <Text style={styles.notifTime}>
                      {new Date(notif.sent_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                  
                  {notif.offer_id && (
                    <View style={styles.offerBadge}>
                       <Gift size={12} color="#6366f1" />
                       <Text style={styles.offerBadgeText}>Voucher Attached</Text>
                    </View>
                  )}
                </View>

                {notif.status === 'sent' && (
                  <View style={styles.unreadDot} />
                )}
              </HapticPressable>
            </Animated.View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 20,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#f5f3ff',
    borderColor: 'rgba(99, 102, 241, 0.1)',
  },
  notifLogo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  notifContent: {
    flex: 1,
    marginLeft: 16,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bizName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifTime: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  notifBody: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366f1',
    marginLeft: 6,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
    position: 'absolute',
    top: 16,
    right: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  skeletonLine: {
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
  }
});
