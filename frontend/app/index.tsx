import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Stats {
  detected: number;
  alerts: number;
  scans: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ detected: 0, alerts: 0, scans: 0 });
  const [greeting, setGreeting] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Load stats from backend
    loadStats();

    // Welcome message
    setTimeout(() => {
      Speech.speak('Welcome to NAVI-VICA, your personal navigation assistant. How can I help you today?', {
        rate: 0.9,
        pitch: 1.0,
      });
    }, 1000);
  }, []);

  const loadStats = async () => {
    try {
      // Load scan history count from backend
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (response.ok) {
        // Backend is healthy
        setIsLoading(false);
      }
    } catch (error) {
      console.log('Stats loading:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      icon: 'walk-outline',
      title: 'Mobility',
      subtitle: 'Resting spots & paths',
      color: '#4CAF50',
      route: '/camera?profile=mobility',
    },
    {
      icon: 'eye-outline',
      title: 'Vision',
      subtitle: 'Obstacles & hazards',
      color: '#2196F3',
      route: '/camera?profile=vision',
    },
    {
      icon: 'bulb-outline',
      title: 'Cognitive',
      subtitle: 'Room orientation',
      color: '#9C27B0',
      route: '/camera?profile=cognitive',
    },
    {
      icon: 'heart-outline',
      title: 'Health',
      subtitle: 'Medication & bottles',
      color: '#F44336',
      route: '/camera?profile=health',
    },
  ];

  const handleQuickAction = (route: string) => {
    router.push(route as any);
  };

  const speakHelp = () => {
    Speech.speak(
      'You can use the camera tab to scan your surroundings. Use the voice tab to give me voice commands. The meds tab helps you manage medication reminders. Settings lets you customize my voice and notifications.',
      { rate: 0.9, pitch: 1.0 }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="eye" size={48} color="#00D9FF" />
            <Text style={styles.logoText}>NAVI-VICA</Text>
          </View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subtitle}>Your Voice Navigator</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.detected}</Text>
            <Text style={styles.statLabel}>Detected</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.alerts}</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.scans}</Text>
            <Text style={styles.statLabel}>Scans</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Analysis Modes</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickActionCard, { borderLeftColor: action.color }]}
              onPress={() => handleQuickAction(action.route)}
              activeOpacity={0.7}
            >
              <Ionicons name={action.icon as any} size={32} color={action.color} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Actions */}
        <Text style={styles.sectionTitle}>Main Features</Text>
        <View style={styles.mainActionsRow}>
          <TouchableOpacity
            style={[styles.mainActionButton, { backgroundColor: '#1E3A5F' }]}
            onPress={() => router.push('/camera')}
          >
            <Ionicons name="camera" size={36} color="#00D9FF" />
            <Text style={styles.mainActionText}>Scan Scene</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainActionButton, { backgroundColor: '#3D1E5F' }]}
            onPress={() => router.push('/voice')}
          >
            <Ionicons name="mic" size={36} color="#D900FF" />
            <Text style={styles.mainActionText}>Voice Command</Text>
          </TouchableOpacity>
        </View>

        {/* Help Button */}
        <TouchableOpacity style={styles.helpButton} onPress={speakHelp}>
          <Ionicons name="help-circle" size={24} color="#00D9FF" />
          <Text style={styles.helpButtonText}>Tap to hear how I can help you</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>NAVI-VICA v2.0.0</Text>
          <Text style={styles.versionSubtext}>AI Vision + YOLOv9 Object Detection</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00D9FF',
    marginLeft: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00D9FF',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  quickActionsGrid: {
    marginBottom: 24,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  quickActionText: {
    flex: 1,
    marginLeft: 16,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  mainActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  mainActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    marginHorizontal: 6,
  },
  mainActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00D9FF33',
    marginBottom: 24,
  },
  helpButtonText: {
    color: '#00D9FF',
    fontSize: 14,
    marginLeft: 8,
  },
  versionInfo: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#666',
  },
  versionSubtext: {
    fontSize: 10,
    color: '#444',
    marginTop: 2,
  },
});
