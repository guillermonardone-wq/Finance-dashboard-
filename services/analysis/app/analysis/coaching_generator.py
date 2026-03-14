"""
Coaching Generator Module

Takes structured findings and sends them to Claude API for natural language coaching.
Claude receives ONLY structured data, never raw telemetry.
"""

import json
from app.models.schemas import StructuredFindings
from app.config import settings

COACHING_PROMPT = """You are a professional racing driving coach reviewing structured analysis
data for an amateur driver at {track_name}.

You are receiving PRE-ANALYZED structured findings, NOT raw telemetry.
Each corner includes measured and inferred metrics with confidence scores.

Rules:
- Convert the structured data into short, specific, actionable coaching
- Be specific with numbers ("brake 13m later" not "brake later")
- Clearly distinguish MEASURED observations from INFERRED suggestions
- Include confidence level for each insight
- Use encouraging but honest tone
- Focus on the 1 most impactful change per corner
- Generate an audio_script suitable for TTS (conversational, 2 min max)

Respond in JSON format:
{{
  "corners": [
    {{
      "corner_number": 1,
      "coaching_text": "...",
      "confidence": 0.8,
      "measured_insights": ["..."],
      "inferred_insights": ["..."]
    }}
  ],
  "summary": "2-3 paragraph overall summary",
  "top_3_improvements": [
    {{
      "corner_number": 3,
      "suggestion": "...",
      "estimated_time_save": 0.3
    }}
  ],
  "audio_script": "Conversational 2-min script for TTS"
}}

Structured findings:
{structured_json}"""


async def generate_coaching(findings: StructuredFindings) -> dict:
    """
    Send structured findings to Claude API and get coaching text.

    Returns coaching dict with corners, summary, top_3_improvements, audio_script.
    """
    if not settings.anthropic_api_key:
        # Return placeholder coaching when API key not configured
        return _placeholder_coaching(findings)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        prompt = COACHING_PROMPT.format(
            track_name=findings.track_name,
            structured_json=json.dumps(findings.model_dump(), indent=2),
        )

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        return json.loads(response_text)

    except Exception as e:
        print(f"Claude API error: {e}. Using placeholder coaching.")
        return _placeholder_coaching(findings)


def _placeholder_coaching(findings: StructuredFindings) -> dict:
    """Generate placeholder coaching when Claude API is not available."""
    corners = []
    improvements = []

    for cf in findings.corners:
        delta = cf.findings.get("time_delta_seconds", 0)
        corners.append({
            "corner_number": cf.corner_number,
            "coaching_text": (
                f"{cf.corner_name}: Entry speed {cf.findings['entry_speed_kmh']} km/h "
                f"(best: {cf.findings['best_entry_speed_kmh']} km/h). "
                f"Time delta: {delta:+.3f}s vs best."
            ),
            "confidence": cf.findings.get("confidence", 0.5),
            "measured_insights": [
                f"Entry speed: {cf.findings['entry_speed_kmh']} km/h",
                f"Min speed: {cf.findings['min_speed_kmh']} km/h",
            ],
            "inferred_insights": [
                f"Brake distance delta: {cf.findings.get('brake_distance_delta_meters', 0):.1f}m",
            ],
        })

        if delta > 0.1:
            improvements.append({
                "corner_number": cf.corner_number,
                "suggestion": f"Focus on {cf.corner_name} — {delta:.3f}s slower than your best",
                "estimated_time_save": round(delta, 3),
            })

    improvements.sort(key=lambda x: x["estimated_time_save"], reverse=True)

    return {
        "corners": corners,
        "summary": (
            f"Analysis of lap {findings.lap_number} at {findings.track_name}. "
            f"Analyzed {len(findings.corners)} corners. "
            "Placeholder coaching — configure ANTHROPIC_API_KEY for real coaching."
        ),
        "top_3_improvements": improvements[:3],
        "audio_script": (
            f"Here's your coaching recap for {findings.track_name}. "
            + " ".join(c["coaching_text"] for c in corners[:3])
        ),
    }
