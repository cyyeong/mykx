// Loads MediaPipe Face Landmarker in the browser, once per page. The WASM fileset comes from jsdelivr at exactly
// the installed @mediapipe/tasks-vision version, and the model from Google's MediaPipe storage; neither is
// committed. Both are downloads only: frames are processed on the device and never sent anywhere.
//
// MediaPipe Tasks also posts its own usage metrics (timings and counts, no images) to Google once a minute.
// myKx promises that only the per-minute focus counts leave the device, so blockMediapipeMetrics() refuses that
// one request; MediaPipe's logger then switches itself off.
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/** Must equal the installed package version (checked by lib/signals/camera.test.ts). */
export const MEDIAPIPE_VERSION = "1.1.1";
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
/** MediaPipe's usage-metrics endpoint. */
export const METRICS_HOST = "odml.pa.googleapis.com";

/** Refuses fetches to MediaPipe's metrics endpoint for the rest of the page's life. Idempotent. */
export function blockMediapipeMetrics(): void {
  const w = window as Window & { __mykxMetricsBlocked?: true };
  if (w.__mykxMetricsBlocked) return;
  w.__mykxMetricsBlocked = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let host = "";
    try {
      host = new URL(url, window.location.href).hostname;
    } catch {
      // Not a URL we can read: let fetch decide.
    }
    if (host === METRICS_HOST) return Promise.reject(new TypeError("myKx sends no camera usage metrics."));
    return original(input, init);
  };
}

let loading: Promise<FaceLandmarker> | null = null;

async function create(delegate: "GPU" | "CPU"): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 2, // enough to tell the child from someone passing behind; readFace picks the largest
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

/**
 * The page's one Face Landmarker. CPU (XNNPACK) first: at about 3 frames a second it takes a few milliseconds a
 * frame, works on older laptops and in browsers without WebGL 2, and leaves the GPU to the app's own visuals.
 * The GPU is the fallback. A failed load can be tried again on a later learning screen.
 */
export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  blockMediapipeMetrics();
  loading ??= create("CPU")
    .catch(() => create("GPU"))
    .catch((err: unknown) => {
      loading = null;
      throw err;
    });
  return loading;
}
