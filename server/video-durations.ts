/**
 * Official YouTube watch-page player metadata, checked 2026-11-17.
 * Values are the first streamingData format's approxDurationMs / 1000.
 * Sub-second precision avoids requiring a rounded-up second after video ends.
 * Values never come from a student's heartbeat request.
 */
export const videoDurations: Record<string, number> = {
  frames: 799.699, // dXZB0bI6uis · approxDurationMs=799699
  shapes: 593.466, // m6utW8cghJI · approxDurationMs=593466
  typography: 432.483, // QeT7eydBrJ4 · approxDurationMs=432483
  geometry: 456.516, // 5pYzyN_idJk · approxDurationMs=456516
  pen: 890.416, // cke01gWWwyo · approxDurationMs=890416
  brushes: 620.966, // AUSZHj17bzY · approxDurationMs=620966
  animation: 603.866, // Ygjw4henJcY · approxDurationMs=603866
  loading: 411.266, // eAg9wgfNDf0 · approxDurationMs=411266
  'prototype-1': 461.849, // ZbFOvcGhqtk · approxDurationMs=461849
  'prototype-2': 378.466, // XijDqdlEaNs · approxDurationMs=378466
};
