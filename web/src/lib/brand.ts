export const PRODUCT_NAME = "PlantVision AI";
export const TAGLINE = "Healthy Plants, Greener Tomorrow";

/**
 * Hero photo of a healthy potted plant. No generated image has been added to the
 * project yet, so the hero uses a CSS gradient. Once the image is placed in
 * `web/public/`, set this to its path (e.g. "/hero.jpg").
 */
export const HERO_IMAGE: string | null = null;

/** FastAPI backend (see api/main.py). Override with NEXT_PUBLIC_API_BASE. */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
