#!/usr/bin/env python3
"""
NAVI-VICA Backend API Testing Suite
Tests all backend endpoints for the cognitive care bot application
"""

import requests
import json
import time
import base64
from datetime import datetime
from typing import Dict, Any, Optional

# Base URL from the review request
BASE_URL = "https://cognitive-care-bot.preview.emergentagent.com/api"

class NaviVicaAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 30
        self.test_results = []
        self.created_reminder_id = None
        
    def log_test(self, endpoint: str, method: str, status: str, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "endpoint": endpoint,
            "method": method,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        print(f"[{status}] {method} {endpoint} - {details}")
        
    def test_api_root(self) -> bool:
        """Test GET /api/ - should return API info"""
        try:
            response = self.session.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "NAVI-VICA" in data.get("message", ""):
                    self.log_test("/", "GET", "PASS", f"API info returned correctly: {data.get('message')}", data)
                    return True
                else:
                    self.log_test("/", "GET", "FAIL", f"Unexpected response format: {data}", data)
                    return False
            else:
                self.log_test("/", "GET", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/", "GET", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_health_endpoint(self) -> bool:
        """Test GET /api/health - should return healthy status"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("/health", "GET", "PASS", "Health check returned healthy status", data)
                    return True
                else:
                    self.log_test("/health", "GET", "FAIL", f"Unexpected health status: {data}", data)
                    return False
            else:
                self.log_test("/health", "GET", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/health", "GET", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_create_reminder(self) -> bool:
        """Test POST /api/reminders - create medication reminder"""
        try:
            # Test data from the review request
            reminder_data = {
                "name": "Aspirin",
                "hour": 8,
                "minute": 30,
                "repeat_daily": True
            }
            
            response = self.session.post(
                f"{self.base_url}/reminders",
                json=reminder_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("name") == "Aspirin":
                    self.created_reminder_id = data.get("id")  # Store for delete test
                    self.log_test("/reminders", "POST", "PASS", f"Reminder created with ID: {self.created_reminder_id}", data)
                    return True
                else:
                    self.log_test("/reminders", "POST", "FAIL", f"Invalid response format: {data}", data)
                    return False
            else:
                self.log_test("/reminders", "POST", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/reminders", "POST", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_get_reminders(self) -> bool:
        """Test GET /api/reminders - get all reminders"""
        try:
            response = self.session.get(f"{self.base_url}/reminders")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    reminder_count = len(data)
                    self.log_test("/reminders", "GET", "PASS", f"Retrieved {reminder_count} reminders", {"count": reminder_count})
                    return True
                else:
                    self.log_test("/reminders", "GET", "FAIL", f"Expected list, got: {type(data)}", data)
                    return False
            else:
                self.log_test("/reminders", "GET", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/reminders", "GET", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_process_voice(self) -> bool:
        """Test POST /api/process-voice - process voice command"""
        try:
            # Test data from the review request
            voice_data = {
                "text": "Help me navigate",
                "context": "general"
            }
            
            response = self.session.post(
                f"{self.base_url}/process-voice",
                json=voice_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "response_text" in data:
                    self.log_test("/process-voice", "POST", "PASS", f"Voice command processed successfully", {"response_length": len(data.get("response_text", ""))})
                    return True
                else:
                    self.log_test("/process-voice", "POST", "FAIL", f"Missing response_text field: {data}", data)
                    return False
            else:
                self.log_test("/process-voice", "POST", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/process-voice", "POST", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_get_settings(self) -> bool:
        """Test GET /api/settings - get user settings"""
        try:
            response = self.session.get(f"{self.base_url}/settings")
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["voice_speed", "voice_pitch", "language", "alarm_sound", "voice_guidance", "warning_alerts", "user_profile"]
                
                if all(field in data for field in expected_fields):
                    self.log_test("/settings", "GET", "PASS", "Settings retrieved with all required fields", data)
                    return True
                else:
                    missing_fields = [field for field in expected_fields if field not in data]
                    self.log_test("/settings", "GET", "FAIL", f"Missing fields: {missing_fields}", data)
                    return False
            else:
                self.log_test("/settings", "GET", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/settings", "GET", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_update_settings(self) -> bool:
        """Test PUT /api/settings - update settings"""
        try:
            # Test data from the review request
            settings_data = {
                "voice_speed": 1.2,
                "voice_pitch": 1.0,
                "language": "en-US",
                "alarm_sound": True,
                "voice_guidance": True,
                "warning_alerts": True,
                "user_profile": "vision"
            }
            
            response = self.session.put(
                f"{self.base_url}/settings",
                json=settings_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("voice_speed") == 1.2 and data.get("user_profile") == "vision":
                    self.log_test("/settings", "PUT", "PASS", "Settings updated successfully", data)
                    return True
                else:
                    self.log_test("/settings", "PUT", "FAIL", f"Settings not updated correctly: {data}", data)
                    return False
            else:
                self.log_test("/settings", "PUT", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("/settings", "PUT", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_delete_reminder(self) -> bool:
        """Test DELETE /api/reminders/{id} - delete reminder"""
        if not self.created_reminder_id:
            self.log_test("/reminders/{id}", "DELETE", "SKIP", "No reminder ID available from create test")
            return False
            
        try:
            response = self.session.delete(f"{self.base_url}/reminders/{self.created_reminder_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "deleted" in data.get("message", "").lower():
                    self.log_test(f"/reminders/{self.created_reminder_id}", "DELETE", "PASS", "Reminder deleted successfully", data)
                    return True
                else:
                    self.log_test(f"/reminders/{self.created_reminder_id}", "DELETE", "FAIL", f"Unexpected response: {data}", data)
                    return False
            else:
                self.log_test(f"/reminders/{self.created_reminder_id}", "DELETE", "FAIL", f"Status code {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test(f"/reminders/{self.created_reminder_id}", "DELETE", "FAIL", f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"Starting NAVI-VICA API tests against: {self.base_url}")
        print("=" * 60)
        
        test_methods = [
            self.test_api_root,
            self.test_health_endpoint,
            self.test_create_reminder,
            self.test_get_reminders,
            self.test_process_voice,
            self.test_get_settings,
            self.test_update_settings,
            self.test_delete_reminder
        ]
        
        total_tests = len(test_methods)
        passed_tests = 0
        
        for test_method in test_methods:
            try:
                if test_method():
                    passed_tests += 1
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                print(f"Test {test_method.__name__} failed with exception: {e}")
        
        print("=" * 60)
        print(f"SUMMARY: {passed_tests}/{total_tests} tests passed")
        
        # Print failed tests
        failed_tests = [result for result in self.test_results if result["status"] == "FAIL"]
        if failed_tests:
            print("\nFAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['method']} {test['endpoint']}: {test['details']}")
        
        return passed_tests, total_tests, self.test_results

def main():
    """Main testing function"""
    tester = NaviVicaAPITester(BASE_URL)
    passed, total, results = tester.run_all_tests()
    
    # Save detailed results to file
    with open("/app/test_results_detailed.json", "w") as f:
        json.dump({
            "summary": {
                "passed": passed,
                "total": total,
                "success_rate": f"{(passed/total)*100:.1f}%"
            },
            "results": results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\nDetailed results saved to /app/test_results_detailed.json")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)