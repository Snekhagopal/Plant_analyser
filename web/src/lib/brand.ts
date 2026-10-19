export const PRODUCT_NAME = "PlantVision AI";
export const TAGLINE = "Healthy Plants, Greener Tomorrow";

/**
 * Hero photo of a healthy potted plant (generated image supplied by the project owner,
 * public/hero.jpg, 1672x940). Set to null to fall back to the CSS gradient.
 */
export const HERO_IMAGE: string | null = "/hero.jpg";

/** FastAPI backend (see api/main.py). Override with NEXT_PUBLIC_API_BASE. */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
