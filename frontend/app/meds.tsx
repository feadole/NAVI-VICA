import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { useAudioPlayer } from 'expo-audio';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Reminder {
  id: string;
  name: string;
  hour: number;
  minute: number;
  repeat_daily: boolean;
  enabled: boolean;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function MedsScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newHour, setNewHour] = useState('');
  const [newMinute, setNewMinute] = useState('');
  const [repeatDaily, setRepeatDaily] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate a beep sound using data URI
  const beepDataUri = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQQAhfXqz6VWGQ5/3fTp4LpyKA1o0N7h4NyoYRQAetvs8e3drI1SHQB97PPx8OzjzJRdEAB+9fHp5+HX0aiTbzUbAHrn2c/Ly8/R0Mq9rZVpRB8Ja8DEzMzNyMPBuK6rnXdPKBJlqLK3tay1u7vBwbipnnBQKBlfn7XCu7Oys7W2urm3sqiZgF0vGVqWrbi4sa6tsLO2uLi1sqaYhWMyH1aUq7SyrqqqrrS3t7WzraSYhWQ3IViVqrOxrKiprrO1trSyr6WYhmU4JFuYqrGura2rsLS2trOxrKSWhGM2I1mWqbGura2rsLS1tLGvrKOVhGI1I1mWqbGtra2rsLO0s7CurKOVhGI1I1mVqbCtramqrrKzsrCurKOVg2E0IliVqLCtramqrrKysK+urKKVg2E0IliUp7Csraqprq+xsK6trKKUgmE0IVeUp7Crq6mprq+wr62sq6KUgmA0IVaUp7CrrKmprq6wr62sq6GUgWA0IVaUp7CrrKmprq6vr62sq6GTgGA0IFaUp7CrrKmprq6vr62sq6GTgGAzIFaUpq+rrKmprq6vr6ysqqGTgGAzIFaUpq+rq6mprq6vr6ysqqCSf18zIFaUpq+rq6mprq6ur6ysqqCSf18zIFWTpq+rq6mprq2ur6yrqqCSf18zIFWTpq+rq6iprq2ur6yrqqCSf18zIFWTpq6rq6iprq2urqyrqqCRf14yH1WTpa6rq6iprq2urqyrqaCRfl4yH1WTpa6qqqiprqyurquqqaCRfl4yH1STpa6qqqiprqyurquqqaCRfl4yH1STpa6qqqioray';

  useEffect(() => {
    loadReminders();
    requestNotificationPermissions();
    
    // Speak welcome
    setTimeout(() => {
      speakText('Medication reminders. Add new reminders or test the alarm.');
    }, 500);
    
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
      }
      Speech.stop();
    };
  }, []);

  const speakText = (text: string, rate: number = 0.9) => {
    Speech.stop();
    Speech.speak(text, {
      rate,
      pitch: 1.0,
      language: 'en-US',
    });
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Notification permission is needed for medication reminders.');
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders`);
      if (response.ok) {
        const data = await response.json();
        setReminders(data);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const scheduleNotification = async (reminder: Reminder) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication Reminder',
          body: `Time to take ${reminder.name}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          hour: reminder.hour,
          minute: reminder.minute,
          repeats: reminder.repeat_daily,
        },
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  const addReminder = async () => {
    if (!newMedName.trim()) {
      speakText('Please enter a medication name');
      Alert.alert('Error', 'Please enter a medication name');
      return;
    }

    const hour = parseInt(newHour) || 0;
    const minute = parseInt(newMinute) || 0;

    if (hour < 0 || hour > 23) {
      speakText('Hour must be between 0 and 23');
      Alert.alert('Error', 'Hour must be between 0 and 23');
      return;
    }

    if (minute < 0 || minute > 59) {
      speakText('Minute must be between 0 and 59');
      Alert.alert('Error', 'Minute must be between 0 and 59');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMedName.trim(),
          hour,
          minute,
          repeat_daily: repeatDaily,
        }),
      });

      if (response.ok) {
        const newReminder = await response.json();
        setReminders((prev) => [...prev, newReminder]);
        await scheduleNotification(newReminder);

        setNewMedName('');
        setNewHour('');
        setNewMinute('');
        setRepeatDaily(true);

        const timeStr = formatTime(hour, minute);
        speakText(`Reminder set for ${newReminder.name} at ${timeStr}`);
      } else {
        throw new Error('Failed to create reminder');
      }
    } catch (error) {
      console.error('Error adding reminder:', error);
      speakText('Failed to create reminder');
      Alert.alert('Error', 'Failed to create reminder');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReminder = async (id: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        speakText(`Reminder for ${name} deleted`);
      }
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const toggleReminder = async (id: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reminders/${id}/toggle`, {
        method: 'PUT',
      });

      if (response.ok) {
        const result = await response.json();
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: result.enabled } : r))
        );
        speakText(`Reminder for ${name} ${result.enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const testAlarm = async () => {
    setIsAlarmPlaying(true);
    
    // Vibrate on mobile
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000], false);
    }
    
    // Speak the alarm message LOUDLY - this is the main alarm sound
    Speech.stop();
    Speech.speak(
      'ATTENTION! MEDICATION REMINDER! It is time to take your medication! Please take your medicine now!',
      {
        rate: 0.8,
        pitch: 1.2,
        language: 'en-US',
      }
    );
    
    // Repeat alarm speech
    let count = 0;
    alarmIntervalRef.current = setInterval(() => {
      if (count < 2) {
        Speech.speak('ATTENTION! Time for your medication!', {
          rate: 0.8,
          pitch: 1.2,
          language: 'en-US',
        });
        count++;
      } else {
        stopAlarm();
      }
    }, 4000);
  };

  const stopAlarm = () => {
    setIsAlarmPlaying(false);
    Speech.stop();
    
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    
    speakText('Alarm stopped.');
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Alarm Playing Banner */}
          {isAlarmPlaying && (
            <View style={styles.alarmBanner}>
              <Ionicons name="notifications" size={24} color="#fff" />
              <Text style={styles.alarmBannerText}>ALARM PLAYING</Text>
              <TouchableOpacity onPress={stopAlarm} style={styles.stopAlarmBtn}>
                <Text style={styles.stopAlarmBtnText}>STOP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add Reminder Form */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="add-circle" size={24} color="#00D9FF" />
              <Text style={styles.sectionTitle}>Add Reminder</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Medication Name (e.g., Aspirin)"
              placeholderTextColor="#666"
              value={newMedName}
              onChangeText={setNewMedName}
            />

            <View style={styles.timeInputRow}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="8"
                  placeholderTextColor="#666"
                  value={newHour}
                  onChangeText={setNewHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <Text style={styles.timeSeparator}>:</Text>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="00"
                  placeholderTextColor="#666"
                  value={newMinute}
                  onChangeText={setNewMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Repeat Daily</Text>
              <Switch
                value={repeatDaily}
                onValueChange={setRepeatDaily}
                trackColor={{ false: '#333', true: '#00D9FF44' }}
                thumbColor={repeatDaily ? '#00D9FF' : '#666'}
              />
            </View>

            <TouchableOpacity
              style={[styles.addButton, isLoading && styles.addButtonDisabled]}
              onPress={addReminder}
              disabled={isLoading}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.addButtonText}>SET REMINDER</Text>
            </TouchableOpacity>
          </View>

          {/* Test Alarm */}
          <View style={styles.testSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="volume-high" size={24} color="#F44336" />
              <Text style={styles.sectionTitle}>Test Alarm Sound</Text>
            </View>
            <Text style={styles.testDescription}>
              Test the alarm. Make sure your phone volume is turned UP!
            </Text>
            <TouchableOpacity
              style={[styles.testButton, isAlarmPlaying && styles.testButtonActive]}
              onPress={isAlarmPlaying ? stopAlarm : testAlarm}
            >
              <Ionicons
                name={isAlarmPlaying ? 'stop-circle' : 'megaphone'}
                size={32}
                color={isAlarmPlaying ? '#fff' : '#F44336'}
              />
              <Text style={[styles.testButtonText, isAlarmPlaying && styles.testButtonTextActive]}>
                {isAlarmPlaying ? 'STOP ALARM' : 'TEST ALARM'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Active Reminders */}
          <View style={styles.remindersSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={24} color="#4CAF50" />
              <Text style={styles.sectionTitle}>
                Reminders ({reminders.length})
              </Text>
            </View>

            {reminders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="medical-outline" size={48} color="#333" />
                <Text style={styles.emptyStateText}>No reminders yet</Text>
              </View>
            ) : (
              reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={[styles.reminderCard, !reminder.enabled && styles.reminderCardDisabled]}
                >
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderName}>{reminder.name}</Text>
                    <View style={styles.reminderTimeRow}>
                      <Ionicons name="time-outline" size={16} color="#888" />
                      <Text style={styles.reminderTime}>
                        {formatTime(reminder.hour, reminder.minute)}
                      </Text>
                      {reminder.repeat_daily && (
                        <View style={styles.repeatBadge}>
                          <Text style={styles.repeatText}>Daily</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.reminderActions}>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => toggleReminder(reminder.id, reminder.name)}
                      trackColor={{ false: '#333', true: '#4CAF5044' }}
                      thumbColor={reminder.enabled ? '#4CAF50' : '#666'}
                    />
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() =>
                        Alert.alert('Delete?', `Delete ${reminder.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(reminder.id, reminder.name) },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={22} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  keyboardAvoid: { flex: 1 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  alarmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  alarmBannerText: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1, marginLeft: 10 },
  stopAlarmBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  stopAlarmBtnText: { color: '#F44336', fontWeight: 'bold' },
  formSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  input: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  timeInputContainer: { alignItems: 'center' },
  timeLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  timeInput: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80,
  },
  timeSeparator: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 12,
    marginTop: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  switchLabel: { color: '#ccc', fontSize: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  addButtonDisabled: { backgroundColor: '#333' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  testSection: {
    backgroundColor: '#2a1a1e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  testDescription: { color: '#F44336', fontSize: 14, marginBottom: 16, fontWeight: '500' },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  testButtonActive: { backgroundColor: '#F44336' },
  testButtonText: { color: '#F44336', fontSize: 20, fontWeight: 'bold', marginLeft: 12 },
  testButtonTextActive: { color: '#fff' },
  remindersSection: { marginTop: 16, marginBottom: 24 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
  },
  emptyStateText: { color: '#666', fontSize: 16, marginTop: 12 },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  reminderCardDisabled: { opacity: 0.5 },
  reminderInfo: { flex: 1 },
  reminderName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reminderTimeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  reminderTime: { color: '#888', fontSize: 14, marginLeft: 6 },
  repeatBadge: {
    backgroundColor: '#00D9FF22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 10,
  },
  repeatText: { color: '#00D9FF', fontSize: 11 },
  reminderActions: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: { padding: 8, marginLeft: 8 },
});
