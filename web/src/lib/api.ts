/**
 * Typed client for the FastAPI backend. All response types come from
 * src/lib/api-schema.d.ts, generated from the backend's OpenAPI schema
 * (`npm run gen:api`; `npm run check:api` verifies they are up to date).
 */
import type { components } from "./api-schema";
import { API_BASE } from "./brand";

type S = components["schemas"];
export type AnalyzeResponse = S["AnalyzeResponse"];
export type Assessment = S["AssessmentOut"];
export type Prediction = S["PredictionOut"];
export type Symptom = S["SymptomOut"];
export type Section = S["SectionOut"];
export type Meta = S["MetaResponse"];
export type PlantOption = S["PlantOption"];
export type Question = S["QuestionOut"];
export type HistoryItem = S["HistoryItem"];
export type HistoryDetail = S["HistoryDetail"];
export type PlantGuide = S["PlantGuideResponse"];
export type Condition = S["ConditionOut"];
export type LibraryCondition = S["LibraryCondition"];
export type CareGroup = S["CareGroupOut"];
export type About = S["AboutResponse"];
export type Health = S["HealthResponse"];
export type PhotoType = AnalyzeResponse["photo_type"];
export type Status = AnalyzeResponse["status"];

/** Error with a user-safe message; `code` mirrors the API's `error` field. */
export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) {
    super(message);
  }
}

export const SERVER_UNREACHABLE =
  "We can't connect to PlantVision AI right now. Please make sure the app is running, then try again. " +
  "(For whoever runs the app: start the backend with uvicorn api.main:app --port 8000.)";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("network_error", SERVER_UNREACHABLE);
  }
  if (!res.ok) {
    let code = "http_error";
    let message = `Something went wrong on our side (error ${res.status}). Please try again.`;
    try {
      const body = (await res.json()) as Partial<S["ErrorResponse"]>;
      if (body.error) code = body.error;
      if (body.message) message = body.message;
    } catch {
      /* non-JSON error body: keep the generic message */
    }
    throw new ApiError(code, message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  meta: () => request<Meta>("/api/meta"),
  about: () => request<About>("/api/about"),
  conditions: () => request<LibraryCondition[]>("/api/conditions"),
  careGroups: () => request<CareGroup[]>("/api/care-groups"),
  plant: (name: string) => request<PlantGuide>(`/api/plants/${encodeURIComponent(name)}`),
  history: (limit = 200) => request<HistoryItem[]>(`/api/history?limit=${limit}`),
  historyItem: (id: number) => request<HistoryDetail>(`/api/history/${id}`),
  deleteHistoryItem: (id: number) => request<S["DeletedResponse"]>(`/api/history/${id}`, { method: "DELETE" }),
  clearHistory: () => request<S["DeletedResponse"]>("/api/history", { method: "DELETE" }),

  analyze(input: { file: File; plantName: string; photoType: PhotoType; context: Record<string, unknown> }) {
    const form = new FormData();
    form.append("file", input.file, input.file.name);
    form.append("plant_name", input.plantName);
    form.append("photo_type", input.photoType);
    form.append("context", JSON.stringify(input.context));
    return request<AnalyzeResponse>("/api/analyze", { method: "POST", body: form });
  },
};
