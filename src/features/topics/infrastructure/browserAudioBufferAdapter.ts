export interface AudioBufferReader {
  read(audioBlob: Blob): Promise<ArrayBuffer>;
}

export const browserAudioBufferAdapter: AudioBufferReader = {
  read(audioBlob: Blob): Promise<ArrayBuffer> {
    return audioBlob.arrayBuffer();
  },
};
