import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Store, MapPin, Tag } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function RegisterBusinessScreen() {
  const router = useRouter();
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegistration = async () => {
    if (!shopName || !category || !address) {
      Alert.alert("Missing Info", "Please fill in all shop details.");
      return;
    }

    setLoading(true);

    try {
      // Real Supabase Insert
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
         Alert.alert("Authentication Required", "You must be signed in to register a business. Please log out and sign in again.");
         setLoading(false);
         return;
      }

      const shopOwnerId = session.user.id;

      // 1. Create the Business
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: shopName,
          category: category,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // 2. Create the Location
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({
          business_id: business.id,
          name: `${shopName} - Main`,
          address: address,
        })
        .select()
        .single();

      if (locationError) throw locationError;

      // 3. Assign the user as the 'owner' in business_staff
      const { error: staffError } = await supabase
        .from('business_staff')
        .insert({
          business_id: business.id,
          user_id: shopOwnerId,
          role: 'owner',
          location_id: location.id,
        });

      if (staffError) throw staffError;

      Alert.alert("🎉 Shop Registered!", "Welcome to the Partner Network. Your business data is now live.", [
        { text: "Go to Dashboard", onPress: () => router.replace('/(business)/dashboard') }
      ]);
      
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#0f172a" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Partner Onboarding</Text>
        <View style={{ width: 40 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.heroSection}>
          <View style={styles.heroIconBox}>
            <Store color="#6366f1" size={48} />
          </View>
          <Text style={styles.heroTitle}>List Your Shop</Text>
          <Text style={styles.heroSubtitle}>Join thousands of local businesses building infinite customer loyalty for zero cost.</Text>
        </View>

        <View style={styles.form}>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Name</Text>
            <View style={styles.inputWrapper}>
              <Store color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="e.g. Third Wave Coffee"
                placeholderTextColor="#cbd5e1"
                value={shopName}
                onChangeText={setShopName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.inputWrapper}>
              <Tag color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="e.g. Cafe, Barber, Grocery"
                placeholderTextColor="#cbd5e1"
                value={category}
                onChangeText={setCategory}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Address</Text>
            <View style={styles.inputWrapper}>
              <MapPin color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="Where are you located?"
                placeholderTextColor="#cbd5e1"
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </View>

        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Pressable 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
          onPress={handleRegistration}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>{loading ? 'Registering...' : 'Register Business'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e0e7ff', // Indigo 100
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    height: '100%',
  },
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    height: 56,
    borderRadius: 28, // Pill shape
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  }
});
