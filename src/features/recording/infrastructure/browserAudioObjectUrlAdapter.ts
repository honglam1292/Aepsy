import type { AudioObjectUrlAdapter } from "../application/recordingAdapter";

export const browserAudioObjectUrlAdapter: AudioObjectUrlAdapter = {
  create(blob: Blob): string {
    return URL.createObjectURL(blob);
  },
  revoke(objectUrl: string): void {
    URL.revokeObjectURL(objectUrl);
  },
};
