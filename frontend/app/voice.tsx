import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
}

export default function VoiceScreen() {
  const router = useRouter();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      text: "Hello! I'm NAVI-VICA. Type a command or tap a quick button below.",
    },
  ]);
  const [lastResponse, setLastResponse] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Configure audio on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: true,
          staysActiveInBackground: false,
        });
      } catch (e) {
        console.log('Audio setup error:', e);
      }
    };
    setupAudio();
    
    // Welcome message
    setTimeout(() => {
      speak("Hello! I'm NAVI-VICA, your personal navigator. How can I help you today?");
    }, 1000);
    
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = async (text: string) => {
    try {
      // Ensure audio mode is set before speaking
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });
      
      await Speech.stop();
      setIsSpeaking(true);
      
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onStart: () => console.log('Speech started'),
        onDone: () => {
          console.log('Speech done');
          setIsSpeaking(false);
        },
        onStopped: () => setIsSpeaking(false),
        onError: (error) => {
          console.log('Speech error:', error);
          setIsSpeaking(false);
        },
      });
    } catch (error) {
      console.error('Speak error:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) {
      speak('Please enter a command.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: text.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    Keyboard.dismiss();
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/process-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          context: 'voice_assistant',
        }),
      });

      if (!response.ok) throw new Error('Failed');

      const result = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: result.response_text,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastResponse(result.response_text);

      // SPEAK the response
      speak(result.response_text);

      // Handle navigation
      if (result.action) {
        setTimeout(() => {
          switch (result.action) {
            case 'open_camera':
              router.push('/camera');
              break;
            case 'open_meds':
              router.push('/meds');
              break;
            case 'open_settings':
              router.push('/settings');
              break;
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = "Sorry, I couldn't process that. Please try again.";
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), type: 'assistant', text: errorMsg }]);
      speak(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakLastResponse = () => {
    if (lastResponse) {
      speak(lastResponse);
    } else {
      speak('No previous response.');
    }
  };

  const quickCommands = [
    { text: 'What can you see?', icon: 'eye' },
    { text: 'Help me navigate', icon: 'navigate' },
    { text: 'Check medications', icon: 'medical' },
    { text: 'What time is it?', icon: 'time' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Speaking Indicator */}
        {isSpeaking && (
          <View style={styles.speakingBanner}>
            <Ionicons name="volume-high" size={24} color="#fff" />
            <Text style={styles.speakingText}>SPEAKING...</Text>
            <TouchableOpacity onPress={stopSpeaking} style={styles.stopBtn}>
              <Ionicons name="stop" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.type === 'user' ? styles.userBubble : styles.assistantBubble]}
            >
              {msg.type === 'assistant' && (
                <View style={styles.assistantHeader}>
                  <Ionicons name="eye" size={16} color="#00D9FF" />
                  <Text style={styles.assistantName}>NAVI-VICA</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, msg.type === 'user' && { color: '#000' }]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {isProcessing && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="small" color="#00D9FF" />
              <Text style={styles.processingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Play Last Response */}
        {lastResponse && (
          <TouchableOpacity style={styles.playLastBtn} onPress={speakLastResponse}>
            <Ionicons name="play-circle" size={28} color="#fff" />
            <Text style={styles.playLastText}>TAP TO HEAR LAST RESPONSE</Text>
          </TouchableOpacity>
        )}

        {/* Quick Commands */}
        <Text style={styles.quickLabel}>QUICK COMMANDS:</Text>
        <View style={styles.quickGrid}>
          {quickCommands.map((cmd, i) => (
            <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => processCommand(cmd.text)}>
              <Ionicons name={cmd.icon as any} size={28} color="#00D9FF" />
              <Text style={styles.quickBtnText}>{cmd.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Text Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your command..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => processCommand(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => processCommand(inputText)}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  flex: { flex: 1 },
  speakingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9FF',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  speakingText: { color: '#fff', marginLeft: 10, flex: 1, fontWeight: 'bold', fontSize: 16 },
  stopBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 20 },
  messagesArea: { flex: 1 },
  messagesContent: { padding: 16 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12 },
  userBubble: { backgroundColor: '#00D9FF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#1a1a2e', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  assistantName: { color: '#00D9FF', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  bubbleText: { color: '#fff', fontSize: 16, lineHeight: 22 },
  processingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 12, borderRadius: 16, alignSelf: 'flex-start' },
  processingText: { color: '#888', marginLeft: 8 },
  playLastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9FF',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  playLastText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 10 },
  quickLabel: { color: '#00D9FF', fontSize: 13, fontWeight: 'bold', marginLeft: 16, marginBottom: 8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 8 },
  quickBtn: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    margin: '1%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00D9FF33',
  },
  quickBtnText: { color: '#fff', fontSize: 13, marginTop: 8, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', padding: 16, paddingTop: 8 },
  textInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#00D9FF33',
  },
  sendBtn: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#00D9FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#333' },
});
