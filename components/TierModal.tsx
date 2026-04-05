import React from 'react';
import { StyleSheet, View, Text, Pressable, Modal, Share, Dimensions, Image } from 'react-native';
import { Award, Share2, X, Sparkles, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface TierModalProps {
  isVisible: boolean;
  onClose: () => void;
  userName: string;
  tierLabel: string;
  points: number;
}

export default function TierModal({ isVisible, onClose, userName, tierLabel, points }: TierModalProps) {
  
  const isGold = tierLabel.includes('GOLD');
  const colors = isGold ? ['#f59e0b', '#d97706'] : ['#64748b', '#475569'];
  const accent = isGold ? '#fbbf24' : '#94a3b8';

  const handleShare = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await Share.share({
        message: `🏆 BOOM! I just reached ${tierLabel} Status on upskillProject! I've already earned ${points} rewards. Join the club and start earning too! 🚀`,
        url: 'https://upskillproject.app/download', // Placeholder marketing link
      });
    } catch (error: any) {
      console.error('Sharing failed:', error.message);
    }
  };

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          entering={SlideInUp.springify()} 
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={['#0f172a', '#1e1b4b']}
            style={styles.card}
          >
             {/* Sparkles / Confetti placeholder effect */}
            <View style={styles.sparkleContainer}>
               <Sparkles color={accent} size={40} style={{ position: 'absolute', top: 20, left: 40 }} />
               <Sparkles color={accent} size={24} style={{ position: 'absolute', bottom: 40, right: 30 }} />
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
               <X color="rgba(255,255,255,0.4)" size={24} />
            </Pressable>

            <View style={styles.content}>
               <View style={[styles.iconGlow, { shadowColor: accent }]}>
                  <Trophy color={accent} size={100} strokeWidth={1} />
               </View>

               <Text style={styles.congratsText}>CONGRATULATIONS!</Text>
               <Text style={styles.userName}>{userName}</Text>
               
               <View style={[styles.tierBadge, { backgroundColor: colors[0] }]}>
                  <Award color="#fff" size={16} fill="#fff" />
                  <Text style={styles.tierName}>{tierLabel}</Text>
               </View>

               <Text style={styles.description}>
                  You've unlocked a whole new world of exclusive rewards and premium treatment. You are now in the top 5% of our community!
               </Text>

               <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                     <Text style={styles.statVal}>{points}</Text>
                     <Text style={styles.statLabel}>Total Points</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.statItem}>
                     <Text style={styles.statVal}>VIP</Text>
                     <Text style={styles.statLabel}>Access</Text>
                  </View>
               </View>

               <Pressable style={[styles.shareBtn, { backgroundColor: accent }]} onPress={handleShare}>
                  <Share2 color="#000" size={20} />
                  <Text style={styles.shareBtnText}>Brag on WhatsApp</Text>
               </Pressable>

               <Pressable onPress={onClose} style={styles.laterBtn}>
                  <Text style={styles.laterText}>Maybe Later</Text>
               </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    borderRadius: 32,
    padding: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sparkleContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  content: {
    alignItems: 'center',
  },
  iconGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  congratsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  userName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    marginBottom: 24,
  },
  tierName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 1,
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 32,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shareBtn: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
  },
  laterBtn: {
    marginTop: 20,
  },
  laterText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '600',
  }
});
