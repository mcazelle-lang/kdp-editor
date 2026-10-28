import { GoogleGenAI } from '@google/genai';
import type { Asset } from '@shared';
import { saveAsset } from '../assets';
import { AGENT } from '../config';

// Imagen a été arrêté le 17/08/2026 dans l'API Gemini : les illustrations passent par les modèles d'image Gemini (« Nano Banana »).
export const imagesAvailable = () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

export type ImageAspect = '2:3' | '3:4' | '4:5' | '1:1' | '4:3' | '3:2';

export async function generateIllustration(prompt: string, aspect: ImageAspect, size: '2K' | '4K', signal?: AbortSignal): Promise<Asset> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY });
  const interaction = await ai.interactions.create(
    {
      model: AGENT.imageModel,
      input: prompt,
      response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: aspect, image_size: size },
    },
    { signal },
  );
  const data = interaction.output_image?.data;
  if (!data) throw new Error('Le modèle d\'image n\'a renvoyé aucune image (prompt refusé ou quota atteint).');
  const mime = interaction.output_image?.mime_type ?? 'image/png';
  if (mime !== 'image/png' && mime !== 'image/jpeg') throw new Error(`Format d'image inattendu : ${mime}`);
  return saveAsset(Buffer.from(data, 'base64'), mime === 'image/png' ? '.png' : '.jpg', `illustration-ia-${Date.now()}.png`);
}
