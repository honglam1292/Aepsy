import { useCallback, useEffect, useRef } from "react";

import { useIntakePersistence } from "../../intake/application/useIntakePersistence";
import { useIntakeWorkflow } from "../../intake/application/useIntakeWorkflow";
import { getCommittedRecording } from "../../intake/domain/intakeReducer";
import type { TopicsState } from "../../intake/domain/intakeTypes";
import { normalizeTopicSuggestions } from "../domain/normalizeTopicSuggestions";
import type { AudioBufferReader } from "../infrastructure/browserAudioBufferAdapter";
import {
  useAudioTranscriber,
  type AudioTranscriptionProcessor,
} from "./useAudioTranscriber";

interface ActiveTopicRequest {
  readonly recordingId: string;
  readonly requestId: string;
}

interface UseTopicProcessingOptions {
  readonly audioBufferReader: AudioBufferReader;
  readonly audioProcessor: AudioTranscriptionProcessor;
}

export interface TopicProcessingController {
  readonly topics: TopicsState;
  readonly canContinue: boolean;
  retryProcessing(): void;
  setTopicSelected(topicValue: string, isSelected: boolean): void;
}

export function useTopicProcessing({
  audioBufferReader,
  audioProcessor,
}: UseTopicProcessingOptions): TopicProcessingController {
  const { state, dispatch, getState } = useIntakeWorkflow();
  const { loadCompletedRecordingAudio } = useIntakePersistence();
  const { processAudio } = useAudioTranscriber(audioProcessor);
  const activeRequestRef = useRef<ActiveTopicRequest | null>(null);
  const requestSequenceRef = useRef(0);
  const isMountedRef = useRef(true);

  const isCurrentRequest = useCallback(
    (request: ActiveTopicRequest): boolean => {
      if (!isMountedRef.current || activeRequestRef.current !== request) {
        return false;
      }

      const currentState = getState();
      const currentRecording = getCommittedRecording(currentState.recording);
      return (
        currentRecording?.recordingId === request.recordingId &&
        currentState.topics.status === "processing" &&
        currentState.topics.sourceRecordingId === request.recordingId &&
        currentState.topics.requestId === request.requestId
      );
    },
    [getState],
  );

  const finishWithError = useCallback(
    (
      request: ActiveTopicRequest,
      reason: "audioUnavailable" | "processingFailed",
    ): void => {
      if (!isCurrentRequest(request)) {
        return;
      }

      dispatch({
        type: "topicProcessingFailed",
        sourceRecordingId: request.recordingId,
        requestId: request.requestId,
        reason,
      });
    },
    [dispatch, isCurrentRequest],
  );

  const runRequest = useCallback(
    async (request: ActiveTopicRequest): Promise<void> => {
      try {
        const audioResult = await loadCompletedRecordingAudio(
          request.recordingId,
        );
        if (!isCurrentRequest(request) || audioResult.status === "stale") {
          return;
        }
        if (audioResult.status === "unavailable") {
          finishWithError(request, "audioUnavailable");
          return;
        }

        let audioBuffer: ArrayBuffer;
        try {
          audioBuffer = await audioBufferReader.read(audioResult.audio);
        } catch {
          finishWithError(request, "audioUnavailable");
          return;
        }

        if (!isCurrentRequest(request)) {
          return;
        }

        const topicOptions = await processAudio(audioBuffer);
        if (!isCurrentRequest(request)) {
          return;
        }
        if (topicOptions === null) {
          finishWithError(request, "processingFailed");
          return;
        }

        const suggestions = normalizeTopicSuggestions(topicOptions);
        dispatch(
          suggestions.length === 0
            ? {
                type: "topicProcessingEmpty",
                sourceRecordingId: request.recordingId,
                requestId: request.requestId,
              }
            : {
                type: "topicsProcessed",
                sourceRecordingId: request.recordingId,
                requestId: request.requestId,
                suggestions,
              },
        );
      } finally {
        if (activeRequestRef.current === request) {
          activeRequestRef.current = null;
        }
      }
    },
    [
      audioBufferReader,
      finishWithError,
      isCurrentRequest,
      loadCompletedRecordingAudio,
      processAudio,
      dispatch,
    ],
  );

  const beginProcessing = useCallback((): void => {
    if (activeRequestRef.current !== null) {
      return;
    }

    const currentState = getState();
    const recording = getCommittedRecording(currentState.recording);
    if (
      recording === null ||
      currentState.topics.status === "processing" ||
      (currentState.topics.status === "processed" &&
        currentState.topics.sourceRecordingId === recording.recordingId)
    ) {
      return;
    }

    requestSequenceRef.current += 1;
    const request: ActiveTopicRequest = {
      recordingId: recording.recordingId,
      requestId: `topics-${recording.recordingId}-${requestSequenceRef.current}`,
    };
    activeRequestRef.current = request;
    dispatch({
      type: "topicProcessingStarted",
      sourceRecordingId: request.recordingId,
      requestId: request.requestId,
    });

    if (!isCurrentRequest(request)) {
      activeRequestRef.current = null;
      return;
    }

    void runRequest(request);
  }, [dispatch, getState, isCurrentRequest, runRequest]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      const request = activeRequestRef.current;
      activeRequestRef.current = null;
      if (request !== null) {
        dispatch({
          type: "topicProcessingCancelled",
          sourceRecordingId: request.recordingId,
          requestId: request.requestId,
        });
      }
    };
  }, [dispatch]);

  const committedRecording = getCommittedRecording(state.recording);
  const recordingId = committedRecording?.recordingId ?? null;

  useEffect(() => {
    const request = activeRequestRef.current;
    if (request !== null && request.recordingId !== recordingId) {
      activeRequestRef.current = null;
      dispatch({
        type: "topicProcessingCancelled",
        sourceRecordingId: request.recordingId,
        requestId: request.requestId,
      });
    }

    if (recordingId !== null && state.topics.status === "unavailable") {
      beginProcessing();
    }
  }, [beginProcessing, dispatch, recordingId, state.topics.status]);

  const retryProcessing = (): void => {
    beginProcessing();
  };

  const setTopicSelected = (
    topicValue: string,
    isSelected: boolean,
  ): void => {
    const currentTopics = getState().topics;
    if (currentTopics.status !== "processed") {
      return;
    }

    const selectedTopicValues = new Set(currentTopics.selectedTopicValues);
    if (isSelected) {
      selectedTopicValues.add(topicValue);
    } else {
      selectedTopicValues.delete(topicValue);
    }

    dispatch({
      type: "topicSelectionChanged",
      selectedTopicValues: [...selectedTopicValues],
    });
  };

  return {
    topics: state.topics,
    canContinue:
      state.topics.status === "processed" &&
      state.topics.selectedTopicValues.length > 0,
    retryProcessing,
    setTopicSelected,
  };
}
