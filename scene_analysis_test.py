#!/usr/bin/env python3
"""
Test the scene analysis API with a sample image
"""

import requests
import base64
import json
from datetime import datetime
from PIL import Image
import io

BASE_URL = "https://cognitive-care-bot.preview.emergentagent.com/api"

def create_test_image():
    """Create a simple test image for scene analysis"""
    # Create a simple 200x200 colored image
    img = Image.new('RGB', (200, 200), color=(73, 109, 137))
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    return image_base64

def test_scene_analysis():
    """Test the scene analysis endpoint"""
    print("Testing scene analysis API...")
    print("=" * 50)
    
    try:
        # Create test image
        test_image = create_test_image()
        
        # Test data
        scene_data = {
            "image_base64": test_image,
            "user_profile": "vision"
        }
        
        session = requests.Session()
        session.timeout = 60  # Longer timeout for AI processing
        
        print("Sending scene analysis request...")
        response = session.post(
            f"{BASE_URL}/analyze-scene",
            json=scene_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Scene analysis request successful!")
            print(f"   - Detections: {len(data.get('detections', []))}")
            print(f"   - AI description: {data.get('ai_description', 'N/A')[:100]}...")
            print(f"   - Safety warnings: {len(data.get('safety_warnings', []))}")
            print(f"   - Navigation hints: {len(data.get('navigation_hints', []))}")
            
            # Save results
            with open("/app/scene_analysis_test_results.json", "w") as f:
                json.dump({
                    "status": "success",
                    "timestamp": datetime.now().isoformat(),
                    "response": data
                }, f, indent=2)
            
            return True
            
        else:
            print(f"❌ Scene analysis failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            
            # Save error results
            with open("/app/scene_analysis_test_results.json", "w") as f:
                json.dump({
                    "status": "error",
                    "status_code": response.status_code,
                    "error": response.text,
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            return False
            
    except Exception as e:
        print(f"❌ Scene analysis test failed with exception: {e}")
        
        # Save exception results
        with open("/app/scene_analysis_test_results.json", "w") as f:
            json.dump({
                "status": "exception",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        return False

if __name__ == "__main__":
    success = test_scene_analysis()
    print(f"\nResults saved to /app/scene_analysis_test_results.json")
    exit(0 if success else 1)