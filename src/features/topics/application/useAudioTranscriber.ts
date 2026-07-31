import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { SuppliedTopicOption } from "../domain/normalizeTopicSuggestions";

export type { SuppliedTopicOption } from "../domain/normalizeTopicSuggestions";

export type AudioTranscriptionInput = ArrayBuffer | Uint8Array;

export type AudioTranscriptionProcessor = (
  audioBuffer: AudioTranscriptionInput,
) => Promise<readonly SuppliedTopicOption[]>;

export interface AudioTranscriber {
  readonly isLoading: boolean;
  readonly data: readonly SuppliedTopicOption[] | null;
  readonly error: string | null;
  processAudio(
    audioBuffer: AudioTranscriptionInput,
  ): Promise<readonly SuppliedTopicOption[] | null>;
}

interface AudioTranscriptionState {
  readonly isLoading: boolean;
  readonly data: readonly SuppliedTopicOption[] | null;
  readonly error: string | null;
}

const PROCESSING_DELAY_MILLISECONDS = 2_000;

export const SUPPLIED_TOPIC_OPTIONS: readonly SuppliedTopicOption[] = [
  { value: "U_DIS_DEPRESSION", label: "Feeling down" },
  { value: "U_DIS_PANIC", label: "Sudden panic" },
  {
    value: "U_DIS_TRIGGERED_FEAR",
    label: "Anxiety with clear reason",
  },
  {
    value: "U_DIS_NO_TRIGGERED_FEAR",
    label: "Generalised anxiety without a trigger",
  },
  { value: "U_DIS_FEAR", label: "Fears" },
  { value: "U_DIS_PHYSICAL_PAIN", label: "Physical pain" },
  {
    value: "U_DIS_EATING_DISORDER",
    label: "Eating behaviour disorders",
  },
  { value: "U_DIS_SLEEP_PROBLEM", label: "Sleep problems" },
  {
    value: "U_DIS_OUT_OF_CONTROL_EMOTION",
    label: "Emotions out of control",
  },
  { value: "U_DIS_LACK_OF_DRIVE", label: "Lack of drive" },
  { value: "U_DIS_COMPULSION", label: "Compulsions" },
  { value: "U_DIS_TRAUMA", label: "Trauma" },
  { value: "U_DIS_GRIEF", label: "Grief" },
  { value: "U_DIS_STRESS", label: "Stress" },
  { value: "U_DIS_DEEP_SELF_WORTH", label: "Low self-esteem" },
  { value: "U_DIS_SELF_WORTH", label: "Self-esteem problems" },
  { value: "U_DIS_DECISION_MAKING", label: "Decision making" },
  { value: "U_DIS_LONELINESS", label: "Loneliness" },
  { value: "U_DIS_SEXUAL_PREFERENCE", label: "Sexual orientation" },
  { value: "U_DIS_DISPLEASURE", label: "Depressive mood" },
  { value: "U_DIS_EATING_BEHAVIOUR", label: "Eating habits" },
  { value: "U_DIS_EMOTION", label: "Regulating emotions" },
  { value: "U_DIS_MEANING_SEEKING", label: "Search for meaning" },
  {
    value: "U_DIS_LACK_OF_DRIVE",
    label: "Lack of drive and desire",
  },
  {
    value: "U_DIS_COMMUNICATION_PROBLEM",
    label: "Communication problems",
  },
  { value: "U_DIS_LOYALTY_PROBLEM", label: "Trust issues" },
  { value: "U_DIS_CONFLICT_RESOLUTION", label: "Conflict resolution" },
  {
    value: "U_DIS_INTIMACY_SEXUALITY",
    label: "Intimacy and sexuality",
  },
  { value: "U_DIS_AGGRESSION_VIOLENCE", label: "Aggression" },
  { value: "U_DIS_MANIPULATION_VIOLENCE", label: "Manipulation" },
  { value: "U_DIS_ALIENATION", label: "Alienation" },
  {
    value: "U_DIS_EMOTIONAL_DEPENDENCE",
    label: "Emotional dependency",
  },
  { value: "U_DIS_SUBSTANCE_ABUSE", label: "Consumer behaviour" },
  { value: "U_DIS_JEALOUSY", label: "Jealousy" },
  {
    value: "U_DIS_BEHAVIOR_PROBLEM_CHILD",
    label: "Child with behavioural problems",
  },
  {
    value: "U_DIS_EATING_BEHAVIOR",
    label: "Eating behaviour and body image",
  },
  {
    value: "U_DIS_CONSUMER_BEHAVIOUR",
    label: "Consumer behaviour",
  },
  { value: "U_DIS_FAMILY_SUBSTANCE_ABUSE", label: "Substance abuse" },
  { value: "U_DIS_FAMILY_ANXIETY", label: "Fears" },
  { value: "U_DIS_FAMILY_DEPRESSION", label: "Depressiveness" },
  { value: "U_DIS_FAMILY_PANIC", label: "Panic" },
  { value: "U_DIS_FAMILY_SEXUALITY", label: "Sexuality" },
  { value: "U_DIS_GENDER_IDENTITY", label: "Gender identity" },
  { value: "U_DIS_FAMILY_COMPULSION", label: "Compulsions" },
  { value: "U_DIS_FAMILY_SLEEP_PROBLEM", label: "Sleep problems" },
  { value: "U_DIS_FAMILY_AUTISM", label: "Autism spectrum" },
  { value: "U_DIS_FAMILY_HYPERACTIVITY", label: "Hyperactivity" },
  {
    value: "U_DIS_FAMILY_CONCENTRATION_PROBLEM",
    label: "Concentration problems",
  },
  { value: "U_DIS_SOCIAL_BEHAVIOUR", label: "Social behavior" },
  { value: "U_DIS_OTHER", label: "Others" },
];

const initialAudioTranscriptionState: AudioTranscriptionState = {
  isLoading: false,
  data: null,
  error: null,
};

function waitForSuppliedProcessingDelay(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, PROCESSING_DELAY_MILLISECONDS);
  });
}

export const suppliedAudioTranscriptionProcessor: AudioTranscriptionProcessor =
  async (audioBuffer) => {
    void audioBuffer;
    await waitForSuppliedProcessingDelay();
    return [...SUPPLIED_TOPIC_OPTIONS];
  };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function useAudioTranscriber(
  audioProcessor: AudioTranscriptionProcessor =
    suppliedAudioTranscriptionProcessor,
): AudioTranscriber {
  const [state, setState] = useState<AudioTranscriptionState>(
    initialAudioTranscriptionState,
  );
  const requestSequenceRef = useRef(0);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
    },
    [],
  );

  const processAudio = useCallback(
    async (
      audioBuffer: AudioTranscriptionInput,
    ): Promise<readonly SuppliedTopicOption[] | null> => {
      requestSequenceRef.current += 1;
      const requestSequence = requestSequenceRef.current;
      setState({ isLoading: true, data: null, error: null });

      try {
        if (audioBuffer.byteLength === 0) {
          throw new Error("Empty audio data.");
        }

        const topicOptions = await audioProcessor(audioBuffer);

        if (requestSequenceRef.current === requestSequence) {
          setState({ isLoading: false, data: topicOptions, error: null });
        }
        return topicOptions;
      } catch (error: unknown) {
        if (requestSequenceRef.current === requestSequence) {
          setState({
            isLoading: false,
            data: null,
            error: getErrorMessage(error),
          });
        }
        return null;
      }
    },
    [audioProcessor],
  );

  return { ...state, processAudio };
}
