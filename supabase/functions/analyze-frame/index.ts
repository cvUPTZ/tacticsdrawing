import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DetectionResult {
  players: Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    team: 'home' | 'away' | 'referee' | 'unknown';
    jerseyColor: string;
    confidence: number;
  }>;
  ball: {
    x: number;
    y: number;
    confidence: number;
    visible: boolean;
  } | null;
  fieldLines: Array<{
    type: 'touchline' | 'goal_line' | 'penalty_box' | 'goal_area' | 'center_circle' | 'center_line' | 'penalty_arc' | 'corner_arc' | 'unknown';
    points: Array<{ x: number; y: number }>;
    confidence: number;
  }>;
  fieldMask: {
    corners: Array<{ x: number; y: number }>;
    isVisible: boolean;
  };
}

const SYSTEM_PROMPT = `You are an expert sports video analysis AI specialized in football/soccer. Analyze the given video frame with PIXEL-PERFECT accuracy.

DETECTION TASKS:
1. PLAYERS: Detect ALL visible players. For each player, determine:
   - Precise center position (x, y as percentage 0-100 of image dimensions)
   - Bounding box dimensions (width, height as percentage)
   - Team: "home" (typically lighter/brighter jerseys), "away" (typically darker jerseys), "referee" (usually black/yellow), or "unknown"
   - Jersey color (hex code)

2. BALL: Detect the football. If partially occluded but visible, still report it.

3. FIELD LINES: Detect visible pitch markings. For straight lines, provide start and end points. For curves (center circle, penalty arcs), provide 8-12 points along the curve.

4. FIELD MASK: Identify the 4 corners of the visible playing field area.

COORDINATE SYSTEM:
- All values are PERCENTAGES (0-100) relative to image dimensions
- x=0 is LEFT edge, x=100 is RIGHT edge
- y=0 is TOP edge, y=100 is BOTTOM edge
- Player positions should be at their FEET (bottom of bounding box)

OUTPUT FORMAT (JSON only, no markdown):
{
  "players": [
    {"id": 1, "x": <feet_x_pct>, "y": <feet_y_pct>, "width": <box_width_pct>, "height": <box_height_pct>, "team": "home|away|referee|unknown", "jerseyColor": "#hex", "confidence": 0.0-1.0}
  ],
  "ball": {"x": <center_x_pct>, "y": <center_y_pct>, "confidence": 0.0-1.0, "visible": true|false},
  "fieldLines": [
    {"type": "touchline|goal_line|penalty_box|goal_area|center_circle|center_line|penalty_arc|corner_arc|unknown", "points": [{"x": <pct>, "y": <pct>}], "confidence": 0.0-1.0}
  ],
  "fieldMask": {"corners": [{"x": <pct>, "y": <pct>}], "isVisible": true|false}
}

CRITICAL ACCURACY RULES:
- Position the bounding boxes PRECISELY around each player
- Account for camera perspective - players farther from camera appear smaller
- Distinguish goalkeepers (often different colored jerseys) correctly
- Report only what you can SEE with high confidence`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, analysisType = "full" } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Adjust prompt based on analysis type
    let userPrompt = "Analyze this football/soccer video frame and detect all players, the ball, field lines, and the field boundary.";
    
    if (analysisType === "players") {
      userPrompt = "Focus on detecting all players in this frame. Identify their positions, team affiliations based on jersey colors, and provide bounding boxes.";
    } else if (analysisType === "ball") {
      userPrompt = "Focus on detecting the football in this frame. If visible, provide its exact position.";
    } else if (analysisType === "lines") {
      userPrompt = "Focus on detecting all field lines and markings in this frame. Identify touchlines, penalty boxes, center circle, and other markings.";
    }

    userPrompt += " Return ONLY valid JSON, no markdown or explanation.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "API credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let detectionResult: DetectionResult;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      detectionResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return empty result on parse failure
      detectionResult = {
        players: [],
        ball: null,
        fieldLines: [],
        fieldMask: { corners: [], isVisible: false }
      };
    }

    return new Response(
      JSON.stringify(detectionResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("analyze-frame error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
