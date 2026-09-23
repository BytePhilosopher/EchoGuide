import type { components } from '@echoguide/openapi';

type ScreenContext = components['schemas']['ScreenContext'];

export interface AddisSTTResponse {
  text: string;
  confidence: number;
  avg_logprob: number;
  no_speech_prob: number;
  compression_ratio: number;
}

export class AddisAIAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.addisassistant.com/v1';

  constructor(apiKey: string = process.env.ADDIS_AI_API_KEY || 'mock_key') {
    this.apiKey = apiKey;
  }

  async transcribeAudio(audioBuffer: Buffer, language: string): Promise<AddisSTTResponse> {
    return {
      text: "በስልኬ ላይ መልእክት ላክ",
      confidence: 0.96,
      avg_logprob: -0.25,
      no_speech_prob: 0.02,
      compression_ratio: 1.1,
    };
  }

  async planActionSequence(transcript: string, screenContext: ScreenContext): Promise<unknown> {
    return {
      model: "Addis-፩-አሌፍ",
      steps: [
        {
          step_id: "step-1",
          action_type: "TAP",
          target_node_id: "com.whatsapp:id/send_button",
          is_destructive: false
        }
      ]
    };
  }
}
