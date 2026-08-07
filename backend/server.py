from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
import io
import tempfile
from PIL import Image
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'navi_vica_db')]

# Create the main app
app = FastAPI(title="NAVI-VICA API", description="Visually-Intelligent Cognitive Assistant API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# YOLOv9 Model - lazy loading
yolo_model = None

def get_yolo_model():
    global yolo_model
    if yolo_model is None:
        try:
            from ultralytics import YOLO
            # Use yolov9c for good balance of speed and accuracy
            yolo_model = YOLO('yolov9c.pt')
            logger.info("YOLOv9 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLOv9 model: {e}")
            raise HTTPException(status_code=500, detail="Failed to load object detection model")
    return yolo_model

# Gemini AI - lazy loading
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-3-flash-preview')

SYSTEM_PROMPT = """You are NAVI-VICA, a friendly and helpful AI assistant designed to help elderly and disabled individuals navigate their environment safely.

Your role is to:
1. Describe scenes in clear, simple language
2. Identify potential hazards and obstacles
3. Provide navigation guidance
4. Help with medication reminders
5. Respond to voice commands helpfully

Always be patient, clear, and reassuring. Use simple words and short sentences. When describing objects, mention their position (left, right, center, near, far). Prioritize safety warnings."""

_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client is None:
        from google import genai
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured (set GEMINI_API_KEY)")
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client

async def ai_generate(prompt: str, image_base64: Optional[str] = None) -> str:
    """Send a prompt (optionally with an image) to Gemini and return the reply text."""
    from google.genai import types
    client = get_genai_client()
    contents = []
    if image_base64:
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        contents.append(types.Part.from_bytes(
            data=base64.b64decode(image_base64), mime_type="image/jpeg"))
    contents.append(prompt)
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    return (response.text or "").strip()

# ========== MODELS ==========

class DetectionResult(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]
    position: str  # left, center, right

class SceneAnalysisRequest(BaseModel):
    image_base64: str
    user_profile: Optional[str] = "general"  # mobility, vision, cognitive, health
    confidence: Optional[float] = Field(default=0.20, ge=0.05, le=0.95)

class SceneAnalysisResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    detections: List[DetectionResult]
    ai_description: str
    safety_warnings: List[str]
    navigation_hints: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VoiceCommandRequest(BaseModel):
    text: str
    context: Optional[str] = None

class VoiceCommandResponse(BaseModel):
    response_text: str
    action: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MedicationReminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    hour: int
    minute: int
    repeat_daily: bool = True
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MedicationReminderCreate(BaseModel):
    name: str
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59)
    repeat_daily: bool = True

class UserSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voice_speed: float = 1.0
    voice_pitch: float = 1.0
    language: str = "en-US"
    alarm_sound: bool = True
    voice_guidance: bool = True
    warning_alerts: bool = True
    user_profile: str = "general"

# ========== HELPER FUNCTIONS ==========

def determine_position(x1: float, x2: float, img_width: float) -> str:
    """Determine if object is on left, center, or right of frame"""
    center_x = (x1 + x2) / 2
    third = img_width / 3
    if center_x < third:
        return "left"
    elif center_x < 2 * third:
        return "center"
    else:
        return "right"

def base64_to_image(base64_string: str) -> Image.Image:
    """Convert base64 string to PIL Image"""
    # Remove data URL prefix if present
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    image_data = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_data))
    
    # Convert to RGB if necessary
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')
    
    return image

async def run_yolo_detection(image: Image.Image, min_conf: float = 0.20) -> tuple:
    """Run YOLOv9 detection on image"""
    model = get_yolo_model()

    # Save image temporarily
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
        image.save(tmp.name, 'JPEG')
        tmp_path = tmp.name

    try:
        # Run detection with better settings for accuracy
        results = model(tmp_path, verbose=False, conf=min_conf, imgsz=1280)

        detections = []
        img_width = image.width

        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    class_name = model.names[cls]

                    if conf >= min_conf:
                        detection = DetectionResult(
                            class_name=class_name,
                            confidence=round(conf, 2),
                            bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                            position=determine_position(x1, x2, img_width)
                        )
                        detections.append(detection)
        
        return detections, img_width, image.height
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

def generate_safety_warnings(detections: List[DetectionResult]) -> List[str]:
    """Generate safety warnings based on detected objects"""
    warnings = []
    hazardous_objects = ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat', 
                         'knife', 'scissors', 'fire hydrant', 'stop sign', 'traffic light']
    
    for det in detections:
        if det.class_name.lower() in hazardous_objects:
            warnings.append(f"Caution: {det.class_name} detected on your {det.position}")
        
        # Close object warning (if bounding box is large, object is close)
        if det.bbox[2] - det.bbox[0] > 200 or det.bbox[3] - det.bbox[1] > 200:
            warnings.append(f"Warning: {det.class_name} is very close to you")
    
    return warnings

def generate_navigation_hints(detections: List[DetectionResult]) -> List[str]:
    """Generate navigation hints based on detected objects"""
    hints = []
    
    # Count objects by position
    left_count = sum(1 for d in detections if d.position == "left")
    right_count = sum(1 for d in detections if d.position == "right")
    center_count = sum(1 for d in detections if d.position == "center")
    
    if center_count > 0:
        hints.append("There are objects directly ahead. Consider moving left or right.")
    
    if left_count > right_count:
        hints.append("More objects detected on your left. Right side may be clearer.")
    elif right_count > left_count:
        hints.append("More objects detected on your right. Left side may be clearer.")
    
    # Look for helpful objects
    helpful_objects = ['chair', 'bench', 'couch', 'bed', 'dining table']
    for det in detections:
        if det.class_name.lower() in helpful_objects:
            hints.append(f"There's a {det.class_name} on your {det.position} - good resting spot.")
    
    # Look for doors/passages
    door_objects = ['door', 'refrigerator', 'oven', 'microwave']
    for det in detections:
        if det.class_name.lower() in door_objects:
            hints.append(f"{det.class_name.capitalize()} detected on your {det.position}.")
    
    return hints

# ========== API ROUTES ==========

@api_router.get("/")
async def root():
    return {"message": "NAVI-VICA API is running", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.post("/analyze-scene", response_model=SceneAnalysisResponse)
async def analyze_scene(request: SceneAnalysisRequest):
    """Analyze a scene using YOLOv9 object detection and Gemini AI description"""
    try:
        # Convert base64 to image
        image = base64_to_image(request.image_base64)
        logger.info(f"Processing image: {image.width}x{image.height}")
        
        # Run YOLOv9 detection
        detections, img_width, img_height = await run_yolo_detection(image, request.confidence or 0.20)
        logger.info(f"Detected {len(detections)} objects")
        
        # Generate safety warnings and navigation hints
        safety_warnings = generate_safety_warnings(detections)
        navigation_hints = generate_navigation_hints(detections)
        
        # Build context for AI description
        detection_summary = []
        for det in detections:
            detection_summary.append(f"- {det.class_name} ({det.confidence*100:.0f}% confidence) on {det.position}")
        
        profile_context = {
            "mobility": "Focus on obstacles, floor hazards, and resting spots.",
            "vision": "Describe everything in detail with positions and distances.",
            "cognitive": "Keep description simple. Focus on room orientation.",
            "health": "Look for medication bottles, medical equipment, and health-related items.",
            "general": "Provide a balanced description for general navigation assistance."
        }
        
        # Get AI description using Gemini
        ai_description = "Scene analysis in progress..."
        try:
            prompt = f"""Analyze this image for a {request.user_profile} assistance user.

Objects detected by computer vision:
{chr(10).join(detection_summary) if detection_summary else "No specific objects detected"}

{profile_context.get(request.user_profile, profile_context['general'])}

Please describe:
1. What is in the scene (2-3 sentences)
2. Any potential hazards or obstacles
3. Safe navigation suggestions
Keep it concise and clear for voice reading."""

            ai_description = await ai_generate(prompt, image_base64=request.image_base64)

        except Exception as e:
            logger.error(f"AI description failed: {e}")
            # Fallback description based on detections
            if detections:
                objects = [d.class_name for d in detections[:5]]
                ai_description = f"I can see: {', '.join(objects)}. " + (" ".join(safety_warnings) if safety_warnings else "The area appears clear for navigation.")
            else:
                ai_description = "I couldn't identify specific objects in this image. Please try taking another photo with better lighting."
        
        # Save to database
        response = SceneAnalysisResponse(
            detections=detections,
            ai_description=ai_description,
            safety_warnings=safety_warnings,
            navigation_hints=navigation_hints
        )
        
        await db.scene_analyses.insert_one(response.model_dump())
        
        return response
        
    except Exception as e:
        logger.error(f"Scene analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/process-voice", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process a voice command and return a response"""
    try:
        prompt = f"""User voice command: "{request.text}"

Context: {request.context if request.context else "General assistance"}

Respond naturally and helpfully. If the user is asking about their surroundings, remind them to use the camera feature. If asking about medications, mention the reminders feature.

Always reply in the same language the user wrote in.

Keep response under 50 words for easy listening."""

        response_text = await ai_generate(prompt)
        
        # Determine action based on command
        action = None
        command_lower = request.text.lower()
        if any(word in command_lower for word in ['camera', 'photo', 'picture', 'see', 'look', 'scan']):
            action = "open_camera"
        elif any(word in command_lower for word in ['medicine', 'medication', 'pill', 'drug', 'reminder']):
            action = "open_meds"
        elif any(word in command_lower for word in ['setting', 'config', 'option', 'preference']):
            action = "open_settings"
        elif any(word in command_lower for word in ['help', 'what can you do', 'commands']):
            action = "show_help"
        
        return VoiceCommandResponse(
            response_text=response_text,
            action=action
        )
        
    except Exception as e:
        logger.error(f"Voice command error: {e}")
        # Fallback response
        return VoiceCommandResponse(
            response_text="I'm sorry, I didn't understand that. Could you please repeat your command?",
            action=None
        )

# ========== MEDICATION REMINDERS ==========

@api_router.post("/reminders", response_model=MedicationReminder)
async def create_reminder(reminder: MedicationReminderCreate):
    """Create a new medication reminder"""
    reminder_obj = MedicationReminder(**reminder.model_dump())
    await db.reminders.insert_one(reminder_obj.model_dump())
    return reminder_obj

@api_router.get("/reminders", response_model=List[MedicationReminder])
async def get_reminders():
    """Get all medication reminders"""
    reminders = await db.reminders.find().to_list(100)
    return [MedicationReminder(**r) for r in reminders]

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Delete a medication reminder"""
    result = await db.reminders.delete_one({"id": reminder_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

@api_router.put("/reminders/{reminder_id}/toggle")
async def toggle_reminder(reminder_id: str):
    """Toggle a reminder's enabled status"""
    reminder = await db.reminders.find_one({"id": reminder_id})
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    new_status = not reminder.get("enabled", True)
    await db.reminders.update_one(
        {"id": reminder_id},
        {"$set": {"enabled": new_status}}
    )
    return {"id": reminder_id, "enabled": new_status}

# ========== USER SETTINGS ==========

@api_router.get("/settings", response_model=UserSettings)
async def get_settings():
    """Get user settings"""
    settings = await db.settings.find_one({"id": "default"})
    if settings:
        return UserSettings(**settings)
    # Return default settings
    return UserSettings(id="default")

@api_router.put("/settings", response_model=UserSettings)
async def update_settings(settings: UserSettings):
    """Update user settings"""
    settings.id = "default"
    await db.settings.update_one(
        {"id": "default"},
        {"$set": settings.model_dump()},
        upsert=True
    )
    return settings

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
