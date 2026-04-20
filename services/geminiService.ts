import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Check for common 429/Quota/Rate Limit indicators in the error object
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 429 || 
      error?.error?.code === 429 || 
      (error?.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')));
    
    if (retries > 0 && isQuotaError) {
      console.warn(`Quota exceeded/Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await wait(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Simulates or performs AI image enhancement.
 * Since real-time detailed image editing (removing background cleanly) usually requires
 * specialized models or complex pipelines, we will use Gemini to describe the edit
 * or use the image generation capabilities if applicable.
 * 
 * For this demo, we will use the Gemini 2.5 Flash Image model to 'generate' a new version
 * or provide a critique/enhancement suggestion if generation isn't strictly editing.
 */
export const enhanceDishImage = async (
  base64Image: string, 
  enhancementType: 'lighting' | 'color' | 'remove-bg' | 'replace-bg' | 'upscale' | 'zoom-in' | 'zoom-out',
  promptModifier?: string
): Promise<string | null> => {
  const ai = getAI();
  if (!ai) return null;

  try {
    const promptMap = {
      'lighting': "Enhance the lighting of this food image to make it look professional, appetizing, and bright. Keep the food exactly the same.",
      'color': "Enhance the colors of this food image to be vibrant and fresh. High contrast, saturation optimized for food photography.",
      'remove-bg': " Isolate the food dish and place it on a purely white background.",
      'replace-bg': `Replace the background of this food dish with a ${promptModifier || "clean, premium marble table"} surface. Keep the food items intact.`,
      'upscale': "Upscale this image to be high resolution, sharp, and highly detailed. Food photography style.",
      'zoom-in': "Zoom in on the dish, creating a macro close-up shot of the delicious details. High resolution.",
      'zoom-out': "Zoom out (outpaint) this image by expanding the canvas only. Do NOT modify, redraw, enhance, restyle, or reinterpret any existing pixels. Keep the original image 100% unchanged — same angle, perspective, lighting, colors, textures, sharpness, and composition. Do NOT add new objects, people, text, or design elements. Extend only the background outward by continuing the exact same environment seamlessly. The result must look like the camera simply moved backward, not like a new image was generated. Preserve photorealism and visual continuity. No cropping. No rotation. No perspective shift. No stylistic changes."
    };

    const prompt = promptMap[enhancementType];

    // Using gemini-2.5-flash-image for image generation tasks as per updated guidelines
    const model = 'gemini-2.5-flash-image';
    
    // Clean base64 string
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG for simplicity in this flow
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    }));

    // Check for image in response
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;

  } catch (error: any) {
    console.error("AI Image Enhancement Failed:", error);
    if (error?.status === 429 || error?.error?.code === 429) {
       console.error("Rate limit persistently exceeded.");
    }
    throw error;
  }
};

export const suggestDishDescription = async (dishName: string, ingredients: string[]): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Delicious freshly prepared dish.";

  try {
    // Fixed: using gemini-3-flash-preview for basic text tasks
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a short, premium, appetizing description (max 2 sentences) for a dish named "${dishName}" containing: ${ingredients.join(', ')}. Do not use pricing or sales language.`
    }));
    return response.text?.trim() || "Delicious freshly prepared dish.";
  } catch (e) {
    console.error("AI Description Failed:", e);
    return "Delicious freshly prepared dish.";
  }
};

export const generateImageFromText = async (prompt: string): Promise<string | null> => {
  const ai = getAI();
  if (!ai) return null;

  try {
    // Using gemini-2.5-flash-image for text-to-image generation
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    }));

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;

  } catch (error) {
    console.error("AI Image Generation Failed:", error);
    return null;
  }
};