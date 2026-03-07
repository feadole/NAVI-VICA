import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
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
      text: "Hello! I'm NAVI-VICA. Type your command below or tap a quick command button.",
      timestamp: new Date(),
    },
  ]);
  const [lastResponse, setLastResponse] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Welcome speech after mount
    setTimeout(() => {
      speakText("Hello! I'm NAVI-VICA, your personal navigator. How can I help you today?");
    }, 1000);
  }, []);

  const speakText = async (text: string) => {
    try {
      // Stop any ongoing speech
      await Speech.stop();
      
      setIsSpeaking(true);
      
      Speech.speak(text, {
        rate: 0.9,
        pitch: 1.0,
        language: 'en-US',
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: (error) => {
          console.log('Speech error:', error);
          setIsSpeaking(false);
        },
      });
    } catch (error) {
      console.error('Speech error:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = async () => {
    try {
      await Speech.stop();
      setIsSpeaking(false);
    } catch (error) {
      console.error('Stop speech error:', error);
    }
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) {
      speakText('Please enter a command.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    Keyboard.dismiss();
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/process-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          context: 'voice_assistant',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process command');
      }

      const result = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: result.response_text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastResponse(result.response_text);

      // Speak the response
      await speakText(result.response_text);

      // Handle navigation actions
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
      console.error('Error processing command:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: "I'm sorry, I couldn't process that. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      speakText("I'm sorry, I couldn't process that. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakLastResponse = () => {
    if (lastResponse) {
      speakText(lastResponse);
    } else {
      speakText('No previous response to play.');
    }
  };

  const quickCommands = [
    { text: 'What can you see?', icon: 'eye' },
    { text: 'Help me navigate', icon: 'navigate' },
    { text: 'Check my medications', icon: 'medical' },
    { text: 'What time is it?', icon: 'time' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Speaking Indicator */}
        {isSpeaking && (
          <View style={styles.statusBanner}>
            <Ionicons name="volume-high" size={20} color="#00D9FF" />
            <Text style={styles.statusText}>Speaking...</Text>
            <TouchableOpacity onPress={stopSpeaking} style={styles.stopBtn}>
              <Text style={styles.stopBtnText}>STOP</Text>
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
                  <Ionicons name="eye" size={14} color="#00D9FF" />
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

        {/* Last Response Player */}
        {lastResponse && (
          <TouchableOpacity style={styles.responsePlayer} onPress={speakLastResponse}>
            <Ionicons name="play-circle" size={28} color="#00D9FF" />
            <Text style={styles.responsePlayerText} numberOfLines={1}>{lastResponse}</Text>
            <Text style={styles.tapToPlay}>TAP TO PLAY</Text>
          </TouchableOpacity>
        )}

        {/* Quick Commands */}
        <Text style={styles.quickLabel}>Quick Commands (tap to send):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
          {quickCommands.map((cmd, i) => (
            <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => processCommand(cmd.text)}>
              <Ionicons name={cmd.icon as any} size={20} color="#00D9FF" />
              <Text style={styles.quickBtnText}>{cmd.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Text Input - Primary Input Method */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Type your command:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Describe what's around me"
              placeholderTextColor="#666"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => processCommand(inputText)}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={() => processCommand(inputText)}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  keyboardAvoid: { flex: 1 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a5e',
    padding: 12,
  },
  statusText: { color: '#00D9FF', marginLeft: 8, fontSize: 14, fontWeight: '600', flex: 1 },
  stopBtn: { backgroundColor: '#F44336', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  stopBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messagesArea: { flex: 1 },
  messagesContent: { padding: 16 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12 },
  userBubble: { backgroundColor: '#00D9FF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#1a1a2e', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  assistantName: { color: '#00D9FF', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  processingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 12, borderRadius: 16, alignSelf: 'flex-start' },
  processingText: { color: '#888', marginLeft: 8, fontSize: 14 },
  responsePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a5e',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  responsePlayerText: { flex: 1, color: '#fff', fontSize: 13, marginLeft: 12 },
  tapToPlay: { color: '#00D9FF', fontSize: 11, fontWeight: '600' },
  quickLabel: { color: '#00D9FF', fontSize: 13, marginLeft: 16, marginBottom: 8, fontWeight: '600' },
  quickScroll: { paddingHorizontal: 16, marginBottom: 12 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#00D9FF33',
  },
  quickBtnText: { color: '#fff', fontSize: 14, marginLeft: 8 },
  inputSection: { paddingHorizontal: 16, paddingBottom: 16 },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  inputRow: { flexDirection: 'row' },
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
