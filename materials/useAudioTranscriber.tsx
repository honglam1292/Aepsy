import { useState } from "react";

interface DisorderOption {
  value: string;
  label: string;
}

interface TranscriptionState {
  isLoading: boolean;
  data: DisorderOption[] | null;
  error: string | null;
}

/**
 * Custom Hook: useAudioTranscriber
 * This encapsulates the logic, the 2s delay, and the state transitions.
 */
export const useAudioTranscriber = () => {
  const [state, setState] = useState<TranscriptionState>({
    isLoading: false,
    data: null,
    error: null,
  });

  const processAudio = async (audioBuffer: ArrayBuffer | Uint8Array) => {
    // 1. Start Loading
    setState({ isLoading: true, data: null, error: null });

    try {
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new Error("Empty audio data.");
      }

      // 2. The 2-second logic requirement
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock Result
      const result: DisorderOption[] = [
        { value: "U_DIS_DEPRESSION", label: "Feeling down" },
        { value: "U_DIS_PANIC", label: "Sudden panic" },
        { value: "U_DIS_TRIGGERED_FEAR", label: "Anxiety with clear reason" },
        { value: "U_DIS_NO_TRIGGERED_FEAR", label: "Generalised anxiety without a trigger" },
        { value: "U_DIS_FEAR", label: "Fears" },
        { value: "U_DIS_PHYSICAL_PAIN", label: "Physical pain" },
        { value: "U_DIS_EATING_DISORDER", label: "Eating behaviour disorders" },
        { value: "U_DIS_SLEEP_PROBLEM", label: "Sleep problems" },
        { value: "U_DIS_OUT_OF_CONTROL_EMOTION", label: "Emotions out of control" },
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
        { value: "U_DIS_LACK_OF_DRIVE", label: "Lack of drive and desire" },
        { value: "U_DIS_COMMUNICATION_PROBLEM", label: "Communication problems" },
        { value: "U_DIS_LOYALTY_PROBLEM", label: "Trust issues" },
        { value: "U_DIS_CONFLICT_RESOLUTION", label: "Conflict resolution" },
        { value: "U_DIS_INTIMACY_SEXUALITY", label: "Intimacy and sexuality" },
        { value: "U_DIS_AGGRESSION_VIOLENCE", label: "Aggression" },
        { value: "U_DIS_MANIPULATION_VIOLENCE", label: "Manipulation" },
        { value: "U_DIS_ALIENATION", label: "Alienation" },
        { value: "U_DIS_EMOTIONAL_DEPENDENCE", label: "Emotional dependency" },
        { value: "U_DIS_SUBSTANCE_ABUSE", label: "Consumer behaviour" },
        { value: "U_DIS_JEALOUSY", label: "Jealousy" },
        { value: "U_DIS_BEHAVIOR_PROBLEM_CHILD", label: "Child with behavioural problems" },
        { value: "U_DIS_EATING_BEHAVIOR", label: "Eating behaviour and body image" },
        { value: "U_DIS_CONSUMER_BEHAVIOUR", label: "Consumer behaviour" },
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
        { value: "U_DIS_FAMILY_CONCENTRATION_PROBLEM", label: "Concentration problems" },
        { value: "U_DIS_SOCIAL_BEHAVIOUR", label: "Social behavior" },
        { value: "U_DIS_OTHER", label: "Others" },
      ];

      // 3. Success State
      setState({ isLoading: false, data: result, error: null });
    } catch (err) {
      // 4. Error State
      setState({
        isLoading: false,
        data: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return { ...state, processAudio };
};
