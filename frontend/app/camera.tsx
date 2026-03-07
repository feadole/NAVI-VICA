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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
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
  const [autoMode, setAutoMode] = useState(false);
  const [userProfile, setUserProfile] = useState(params.profile || 'general');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Welcome message
    setTimeout(() => {
      speakText('Scene analysis. Upload an image or start the camera.');
    }, 500);
    
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
      }
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (autoMode && cameraActive) {
      autoIntervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 5000);
    } else {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
      }
    };
  }, [autoMode, cameraActive]);

  const speakText = (text: string, rate: number = 0.9) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      rate,
      pitch: 1.0,
      language: 'en-US',
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const pickImage = async () => {
    try {
      speakText('Opening image picker.');
      
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
      speakText('Failed to pick image.');
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const startCamera = async () => {
    if (!permission?.granted) {
      speakText('Requesting camera permission.');
      const result = await requestPermission();
      if (!result.granted) {
        speakText('Camera permission is required.');
        Alert.alert('Permission Required', 'Camera permission is needed.');
        return;
      }
    }
    speakText('Camera started. Tap scan to capture.');
    setCameraActive(true);
    setCapturedImage(null);
    setAnalysisResult(null);
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current || isAnalyzing) return;

    try {
      speakText('Capturing.');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
        await analyzeImage(photo.base64);
      }
    } catch (error) {
      console.error('Error capturing:', error);
      speakText('Capture failed.');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    speakText('Analyzing scene. Please wait.');

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-scene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64,
          user_profile: userProfile,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);

      // Build and speak the full result
      let speechText = '';
      
      if (result.detections.length > 0) {
        speechText += `I detected ${result.detections.length} objects. `;
        const names = result.detections.slice(0, 3).map(d => d.class_name).join(', ');
        speechText += `Including: ${names}. `;
      }
      
      speechText += result.ai_description + ' ';
      
      if (result.safety_warnings.length > 0) {
        speechText += 'Warning: ' + result.safety_warnings.join('. ') + ' ';
      }
      
      // Speak the full analysis
      speakText(speechText, 0.85);
      
    } catch (error) {
      console.error('Analysis error:', error);
      speakText('Analysis failed. Please try again.');
      Alert.alert('Error', 'Could not analyze the scene.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakResult = () => {
    if (analysisResult) {
      let text = analysisResult.ai_description;
      if (analysisResult.safety_warnings.length > 0) {
        text += ' Warning: ' + analysisResult.safety_warnings.join('. ');
      }
      speakText(text);
    } else {
      speakText('No analysis available.');
    }
  };

  const profiles = [
    { key: 'general', label: 'General', icon: 'person' },
    { key: 'mobility', label: 'Mobility', icon: 'walk' },
    { key: 'vision', label: 'Vision', icon: 'eye' },
    { key: 'cognitive', label: 'Cognitive', icon: 'bulb' },
    { key: 'health', label: 'Health', icon: 'heart' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Speaking Banner */}
        {isSpeaking && (
          <View style={styles.speakingBanner}>
            <Ionicons name="volume-high" size={20} color="#00D9FF" />
            <Text style={styles.speakingText}>Speaking...</Text>
            <TouchableOpacity onPress={stopSpeaking} style={styles.stopBtn}>
              <Text style={styles.stopBtnText}>STOP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileSelector}>
          {profiles.map((profile) => (
            <TouchableOpacity
              key={profile.key}
              style={[styles.profileButton, userProfile === profile.key && styles.profileButtonActive]}
              onPress={() => {
                setUserProfile(profile.key);
                speakText(`Profile: ${profile.label}`);
              }}
            >
              <Ionicons
                name={profile.icon as any}
                size={18}
                color={userProfile === profile.key ? '#00D9FF' : '#888'}
              />
              <Text style={[styles.profileButtonText, userProfile === profile.key && styles.profileButtonTextActive]}>
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
              <Ionicons name="image-outline" size={64} color="#666" />
              <Text style={styles.uploadText}>TAP TO UPLOAD IMAGE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {!cameraActive ? (
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlButton} onPress={startCamera}>
                <Ionicons name="camera" size={32} color="#00D9FF" />
                <Text style={styles.controlButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={pickImage}>
                <Ionicons name="images" size={32} color="#00D9FF" />
                <Text style={styles.controlButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlButton} onPress={() => { setCameraActive(false); speakText('Camera stopped.'); }}>
                <Ionicons name="close" size={32} color="#F44336" />
                <Text style={styles.controlButtonText}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureButton, isAnalyzing && styles.captureButtonDisabled]}
                onPress={captureAndAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <Ionicons name="scan" size={40} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
                <Ionicons name="camera-reverse" size={32} color="#00D9FF" />
                <Text style={styles.controlButtonText}>Flip</Text>
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
            {/* Speak Button */}
            <TouchableOpacity style={styles.speakResultButton} onPress={speakResult}>
              <Ionicons name="volume-high" size={28} color="#fff" />
              <Text style={styles.speakResultText}>TAP TO HEAR DESCRIPTION</Text>
            </TouchableOpacity>

            {/* Detections */}
            <View style={styles.resultSection}>
              <Text style={styles.resultTitle}>Detected: {analysisResult.detections.length} objects</Text>
              <View style={styles.detectionsGrid}>
                {analysisResult.detections.slice(0, 6).map((det, i) => (
                  <View key={i} style={styles.detectionChip}>
                    <Text style={styles.detectionName}>{det.class_name}</Text>
                    <Text style={styles.detectionInfo}>{Math.round(det.confidence * 100)}% • {det.position}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* AI Description */}
            <View style={styles.resultSection}>
              <Text style={styles.resultTitle}>AI Analysis</Text>
              <Text style={styles.aiDescription}>{analysisResult.ai_description}</Text>
            </View>

            {/* Warnings */}
            {analysisResult.safety_warnings.length > 0 && (
              <View style={[styles.resultSection, styles.warningSection]}>
                <Text style={styles.warningTitle}>Warnings</Text>
                {analysisResult.safety_warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>• {w}</Text>
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
    backgroundColor: '#1a3a5e',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  speakingText: { color: '#00D9FF', marginLeft: 8, flex: 1, fontWeight: '600' },
  stopBtn: { backgroundColor: '#F44336', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  stopBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  profileSelector: { paddingHorizontal: 16, paddingVertical: 12 },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  profileButtonActive: { backgroundColor: '#1a3a5e', borderWidth: 1, borderColor: '#00D9FF' },
  profileButtonText: { color: '#888', marginLeft: 6, fontSize: 13 },
  profileButtonTextActive: { color: '#00D9FF' },
  cameraContainer: {
    marginHorizontal: 16,
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  cameraWrapper: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', top: 12, left: 12 },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336', marginRight: 6 },
  liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  capturedImage: { flex: 1 },
  uploadArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#333',
    margin: 16,
    borderRadius: 12,
  },
  uploadText: { color: '#666', fontSize: 14, marginTop: 12, fontWeight: '600' },
  controlsContainer: { padding: 16 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  controlButton: { alignItems: 'center', padding: 12 },
  controlButtonText: { color: '#888', fontSize: 12, marginTop: 4 },
  captureButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#00D9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: { backgroundColor: '#555' },
  loadingContainer: { alignItems: 'center', padding: 24 },
  loadingText: { color: '#888', marginTop: 12 },
  resultsContainer: { padding: 16 },
  speakResultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9FF',
    borderRadius: 12,
    paddingVertical: 18,
    marginBottom: 16,
  },
  speakResultText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  resultSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resultTitle: { color: '#00D9FF', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  detectionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detectionChip: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  detectionName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  detectionInfo: { color: '#888', fontSize: 10 },
  aiDescription: { color: '#ccc', fontSize: 15, lineHeight: 22 },
  warningSection: { backgroundColor: '#2a1a1e', borderLeftWidth: 3, borderLeftColor: '#F44336' },
  warningTitle: { color: '#F44336', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  warningText: { color: '#F44336', fontSize: 14, marginBottom: 4 },
});
