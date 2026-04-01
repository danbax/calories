const nutritionPrompt =
  'Analyze this food image and estimate total nutrition. Return ONLY valid JSON with this exact shape: {"description":"short text", "calories":number, "protein":number, "carbs":number, "fat":number}. Numbers must be totals for the full plate.'

const parseNutritionJson = (rawText) => {
  const clean = rawText
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')

  const parsed = JSON.parse(clean)

  return {
    description: parsed.description || 'AI estimate',
    calories: Number(parsed.calories) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fat: Number(parsed.fat) || 0,
  }
}

export const estimateNutritionFromImage = async ({ provider, apiKey, model, dataUrl }) => {
  if (!apiKey) {
    throw new Error('Missing API key. Add it in Settings first.')
  }

  if (provider === 'gemini') {
    const base64Payload = dataUrl.split(',')[1]
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: nutritionPrompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Payload,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    )

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`Gemini request failed: ${details}`)
    }

    const json = await response.json()
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('Gemini returned an empty response.')
    }

    return parseNutritionJson(text)
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: nutritionPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`OpenAI request failed: ${details}`)
  }

  const json = await response.json()
  const text = json.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('OpenAI returned an empty response.')
  }

  return parseNutritionJson(text)
}
