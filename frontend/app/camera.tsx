import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Detection {
  class_name: string;
  confidence: number;
  bbox: number[];
  position: string;
}

interface AnalysisResult {
  id: string;
  detections: Detection[];
  ai_description: string;
  safety_warnings: string[];
  navigation_hints: string[];
}

export default function CameraScreen() {
  const params = useLocalSearchParams<{ profile?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [userProfile, setUserProfile] = useState(params.profile || 'general');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Configure audio on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch (e) {
        console.log('Audio setup error:', e);
      }
    };
    setupAudio();
    
    // Welcome message
    setTimeout(() => {
      speak('Scene analysis ready. Upload an image or use the camera.');
    }, 1000);
    
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = async (text: string) => {
    try {
      // Ensure audio mode is set
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

  const pickImage = async () => {
    try {
      speak('Opening photos.');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setCapturedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setCameraActive(false);
        await analyzeImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      speak('Failed to pick image.');
    }
  };

  const startCamera = async () => {
    if (!permission?.granted) {
      speak('Requesting camera permission.');
      const result = await requestPermission();
      if (!result.granted) {
        speak('Camera permission is required.');
        Alert.alert('Permission Required', 'Camera access is needed.');
        return;
      }
    }
    speak('Camera started. Tap the large button to scan.');
    setCameraActive(true);
    setCapturedImage(null);
    setAnalysisResult(null);
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current || isAnalyzing) return;

    try {
      speak('Capturing image.');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
        setCameraActive(false);
        await analyzeImage(photo.base64);
      }
    } catch (error) {
      console.error('Capture error:', error);
      speak('Capture failed. Please try again.');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    speak('Analyzing your surroundings. Please wait.');

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          user_profile: userProfile,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);

      // Build comprehensive navigation speech
      let speechText = '';
      
      // Detected objects
      if (result.detections.length > 0) {
        const objects = result.detections.slice(0, 5).map(d => 
          `${d.class_name} on your ${d.position}`
        ).join(', ');
        speechText += `I see ${result.detections.length} objects. ${objects}. `;
      }
      
      // AI description
      speechText += result.ai_description + ' ';
      
      // Safety warnings - CRITICAL
      if (result.safety_warnings.length > 0) {
        speechText += 'CAUTION! ' + result.safety_warnings.join('. ') + ' ';
      }
      
      // Navigation hints
      if (result.navigation_hints.length > 0) {
        speechText += result.navigation_hints[0];
      }
      
      // Speak the full navigation guidance
      speak(speechText);
      
    } catch (error) {
      console.error('Analysis error:', error);
      speak('Sorry, analysis failed. Please check your connection and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakResult = () => {
    if (analysisResult) {
      let text = analysisResult.ai_description;
      if (analysisResult.safety_warnings.length > 0) {
        text += ' CAUTION! ' + analysisResult.safety_warnings.join('. ');
      }
      speak(text);
    } else {
      speak('No analysis available. Please scan an image first.');
    }
  };

  const profiles = [
    { key: 'general', label: 'General', icon: 'person' },
    { key: 'mobility', label: 'Mobility', icon: 'walk' },
    { key: 'vision', label: 'Vision', icon: 'eye' },
    { key: 'health', label: 'Health', icon: 'heart' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
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

        {/* Profile Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileSelector}>
          {profiles.map((profile) => (
            <TouchableOpacity
              key={profile.key}
              style={[styles.profileBtn, userProfile === profile.key && styles.profileBtnActive]}
              onPress={() => {
                setUserProfile(profile.key);
                speak(`${profile.label} mode selected.`);
              }}
            >
              <Ionicons
                name={profile.icon as any}
                size={22}
                color={userProfile === profile.key ? '#00D9FF' : '#888'}
              />
              <Text style={[styles.profileBtnText, userProfile === profile.key && styles.profileBtnTextActive]}>
                {profile.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Camera/Image View */}
        <View style={styles.cameraContainer}>
          {cameraActive ? (
            <View style={styles.cameraWrapper}>
              <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
              <View style={styles.cameraOverlay}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
            </View>
          ) : capturedImage ? (
            <Image source={{ uri: capturedImage }} style={styles.capturedImage} resizeMode="contain" />
          ) : (
            <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
              <Ionicons name="images" size={80} color="#00D9FF" />
              <Text style={styles.uploadText}>TAP TO UPLOAD IMAGE</Text>
              <Text style={styles.uploadSubtext}>or use camera below</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Controls */}
        <View style={styles.controlsContainer}>
          {!cameraActive ? (
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.bigButton} onPress={startCamera}>
                <Ionicons name="camera" size={40} color="#fff" />
                <Text style={styles.bigButtonText}>START CAMERA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bigButton, styles.uploadButton]} onPress={pickImage}>
                <Ionicons name="images" size={40} color="#fff" />
                <Text style={styles.bigButtonText}>UPLOAD PHOTO</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.cameraControlBtn} onPress={() => { setCameraActive(false); speak('Camera stopped.'); }}>
                <Ionicons name="close-circle" size={36} color="#F44336" />
                <Text style={styles.cameraControlText}>STOP</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.scanButton, isAnalyzing && styles.scanButtonDisabled]}
                onPress={captureAndAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <>
                    <Ionicons name="scan" size={50} color="#fff" />
                    <Text style={styles.scanButtonText}>SCAN</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.cameraControlBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
                <Ionicons name="camera-reverse" size={36} color="#00D9FF" />
                <Text style={styles.cameraControlText}>FLIP</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Loading */}
        {isAnalyzing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D9FF" />
            <Text style={styles.loadingText}>Analyzing with YOLOv9 + AI...</Text>
          </View>
        )}

        {/* Results */}
        {analysisResult && (
          <View style={styles.resultsContainer}>
            {/* SPEAK BUTTON - Most Important */}
            <TouchableOpacity style={styles.speakResultBtn} onPress={speakResult}>
              <Ionicons name="volume-high" size={32} color="#fff" />
              <Text style={styles.speakResultText}>TAP TO HEAR AGAIN</Text>
            </TouchableOpacity>

            {/* Detections */}
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>
                <Ionicons name="locate" size={18} color="#00D9FF" /> Detected: {analysisResult.detections.length} objects
              </Text>
              <View style={styles.detectionsGrid}>
                {analysisResult.detections.slice(0, 8).map((det, i) => (
                  <View key={i} style={styles.detectionChip}>
                    <Text style={styles.detectionName}>{det.class_name}</Text>
                    <Text style={styles.detectionPosition}>{det.position}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* AI Description */}
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>
                <Ionicons name="chatbubble" size={18} color="#D900FF" /> AI Description
              </Text>
              <Text style={styles.aiDescription}>{analysisResult.ai_description}</Text>
            </View>

            {/* Warnings */}
            {analysisResult.safety_warnings.length > 0 && (
              <View style={[styles.resultCard, styles.warningCard]}>
                <Text style={styles.warningTitle}>
                  <Ionicons name="warning" size={18} color="#F44336" /> Safety Warnings
                </Text>
                {analysisResult.safety_warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>{w}</Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  scrollView: { flex: 1 },
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
  profileSelector: { paddingHorizontal: 16, paddingVertical: 12 },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 10,
  },
  profileBtnActive: { backgroundColor: '#1a3a5e', borderWidth: 2, borderColor: '#00D9FF' },
  profileBtnText: { color: '#888', marginLeft: 8, fontSize: 14, fontWeight: '600' },
  profileBtnTextActive: { color: '#00D9FF' },
  cameraContainer: {
    marginHorizontal: 16,
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  cameraWrapper: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', top: 12, left: 12 },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F44336', marginRight: 8 },
  liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  capturedImage: { flex: 1 },
  uploadArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: { color: '#00D9FF', fontSize: 18, marginTop: 16, fontWeight: 'bold' },
  uploadSubtext: { color: '#666', fontSize: 14, marginTop: 4 },
  controlsContainer: { padding: 16 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bigButton: {
    flex: 1,
    backgroundColor: '#00D9FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  uploadButton: { backgroundColor: '#D900FF' },
  bigButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  cameraControlBtn: { alignItems: 'center', padding: 10 },
  cameraControlText: { color: '#888', fontSize: 12, marginTop: 4 },
  scanButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00D9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonDisabled: { backgroundColor: '#555' },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  loadingContainer: { alignItems: 'center', padding: 20 },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
  resultsContainer: { padding: 16 },
  speakResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9FF',
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 16,
  },
  speakResultText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 12 },
  resultCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  resultTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  detectionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detectionChip: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  detectionName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detectionPosition: { color: '#00D9FF', fontSize: 11, marginTop: 2 },
  aiDescription: { color: '#ccc', fontSize: 16, lineHeight: 24 },
  warningCard: { backgroundColor: '#2a1a1e', borderLeftWidth: 4, borderLeftColor: '#F44336' },
  warningTitle: { color: '#F44336', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  warningText: { color: '#F44336', fontSize: 15, marginBottom: 4 },
});
