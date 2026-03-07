#!/usr/bin/env python3
"""
NAVI-VICA Backend API Error Handling Tests
Tests error scenarios and edge cases for the backend APIs
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://cognitive-care-bot.preview.emergentagent.com/api"

def test_error_handling():
    """Test various error scenarios"""
    session = requests.Session()
    session.timeout = 30
    
    error_tests = []
    
    print("Testing error handling scenarios...")
    print("=" * 50)
    
    # Test 1: Invalid reminder data
    print("1. Testing invalid reminder data...")
    try:
        invalid_reminder = {
            "name": "Test Med",
            "hour": 25,  # Invalid hour
            "minute": 30
        }
        response = session.post(f"{BASE_URL}/reminders", json=invalid_reminder)
        if response.status_code == 422:  # Pydantic validation error
            print("   ✅ PASS - Correctly rejected invalid hour (25)")
        else:
            print(f"   ❌ FAIL - Expected 422, got {response.status_code}")
        error_tests.append({"test": "invalid_reminder_hour", "passed": response.status_code == 422})
    except Exception as e:
        print(f"   ❌ FAIL - Exception: {e}")
        error_tests.append({"test": "invalid_reminder_hour", "passed": False})
    
    # Test 2: Delete non-existent reminder
    print("2. Testing delete non-existent reminder...")
    try:
        response = session.delete(f"{BASE_URL}/reminders/non-existent-id")
        if response.status_code == 404:
            print("   ✅ PASS - Correctly returned 404 for non-existent reminder")
        else:
            print(f"   ❌ FAIL - Expected 404, got {response.status_code}")
        error_tests.append({"test": "delete_non_existent", "passed": response.status_code == 404})
    except Exception as e:
        print(f"   ❌ FAIL - Exception: {e}")
        error_tests.append({"test": "delete_non_existent", "passed": False})
    
    # Test 3: Invalid voice command (empty text)
    print("3. Testing empty voice command...")
    try:
        response = session.post(f"{BASE_URL}/process-voice", json={"text": "", "context": "general"})
        # Should still return 200 but with appropriate response
        if response.status_code == 200:
            data = response.json()
            if "response_text" in data:
                print("   ✅ PASS - Handled empty voice command gracefully")
                error_tests.append({"test": "empty_voice_command", "passed": True})
            else:
                print(f"   ❌ FAIL - Missing response_text in response: {data}")
                error_tests.append({"test": "empty_voice_command", "passed": False})
        else:
            print(f"   ❌ FAIL - Expected 200, got {response.status_code}")
            error_tests.append({"test": "empty_voice_command", "passed": False})
    except Exception as e:
        print(f"   ❌ FAIL - Exception: {e}")
        error_tests.append({"test": "empty_voice_command", "passed": False})
    
    # Test 4: Invalid JSON in request body
    print("4. Testing invalid JSON in reminder creation...")
    try:
        headers = {"Content-Type": "application/json"}
        response = session.post(f"{BASE_URL}/reminders", data="invalid json", headers=headers)
        if response.status_code == 422:
            print("   ✅ PASS - Correctly rejected invalid JSON")
        else:
            print(f"   ❌ FAIL - Expected 422, got {response.status_code}")
        error_tests.append({"test": "invalid_json", "passed": response.status_code == 422})
    except Exception as e:
        print(f"   ❌ FAIL - Exception: {e}")
        error_tests.append({"test": "invalid_json", "passed": False})
    
    # Test 5: Missing required fields in settings update
    print("5. Testing incomplete settings update...")
    try:
        incomplete_settings = {"voice_speed": 1.5}  # Missing other required fields
        response = session.put(f"{BASE_URL}/settings", json=incomplete_settings)
        # Should work as other fields have defaults
        if response.status_code == 200:
            print("   ✅ PASS - Accepted partial settings update with defaults")
        else:
            print(f"   ❌ FAIL - Expected 200, got {response.status_code}")
        error_tests.append({"test": "partial_settings", "passed": response.status_code == 200})
    except Exception as e:
        print(f"   ❌ FAIL - Exception: {e}")
        error_tests.append({"test": "partial_settings", "passed": False})
    
    print("=" * 50)
    passed_error_tests = sum(1 for test in error_tests if test["passed"])
    total_error_tests = len(error_tests)
    print(f"Error handling tests: {passed_error_tests}/{total_error_tests} passed")
    
    return error_tests

if __name__ == "__main__":
    results = test_error_handling()
    
    # Save results
    with open("/app/error_handling_results.json", "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "error_tests": results
        }, f, indent=2)
    
    print(f"\nError handling results saved to /app/error_handling_results.json")