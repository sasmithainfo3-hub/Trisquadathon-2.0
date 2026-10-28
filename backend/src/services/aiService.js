import { config } from '../config/env.js';

export async function generateIncidentSummary({ userName, triggerReason, trip, lastLocation, triggerExplanation }) {
  // Deterministic fallback text
  const baseSummary = `Incident initiated for ${userName}. Reason: ${triggerReason === 'MANUAL_EMERGENCY' ? 'Manual SOS Action' : 'Missed scheduled safety check-in'}. Last reported coordinates: ${lastLocation.latitude.toFixed(4)}, ${lastLocation.longitude.toFixed(4)}${trip ? ` on route to ${trip.destination.address}` : ''}.`;

  if (!config.openAi.isConfigured) {
    return baseSummary;
  }

  try {
    const prompt = `You are a factual emergency assistant for the SafePath safety application.
Provide a concise, 1 to 2 sentence objective summary of this safety alert for trusted contacts.
Rules:
- NEVER invent an AI danger score.
- NEVER accuse any person of suspicious behavior.
- NEVER assert that the user is definitely in physical danger; only state the factual condition.
- Keep under 40 words.

Data:
User: ${userName}
Trigger: ${triggerReason}
Explanation: ${triggerExplanation}
Destination: ${trip?.destination?.address || 'N/A'}
Last Location: ${lastLocation.latitude}, ${lastLocation.longitude}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openAi.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.2
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        return content;
      }
    }
  } catch (err) {
    console.warn('[SafePath AI] OpenAI incident summary generation failed:', err.message);
  }

  return baseSummary;
}
