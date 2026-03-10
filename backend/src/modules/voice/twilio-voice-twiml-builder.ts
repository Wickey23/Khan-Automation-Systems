import { twiml as Twiml } from "twilio";

export function buildPassiveForwardDialTwiml(input: {
  forwardingNumber: string;
  statusCallbackUrl: string;
  timeoutSeconds: number;
  stream?: {
    url: string;
    name?: string;
    track: "both_tracks";
    statusCallbackUrl?: string;
    customParameters?: Array<{ name: string; value: string }>;
  } | null;
  preDialInstructions?: ((response: InstanceType<typeof Twiml.VoiceResponse>) => void) | null;
}) {
  const response = new Twiml.VoiceResponse();
  input.preDialInstructions?.(response);
  if (input.stream) {
    const start = response.start();
    const stream = start.stream({
      url: input.stream.url,
      ...(input.stream.name ? { name: input.stream.name } : {}),
      track: input.stream.track,
      ...(input.stream.statusCallbackUrl
        ? {
            statusCallback: input.stream.statusCallbackUrl,
            statusCallbackMethod: "POST"
          }
        : {})
    });
    for (const parameter of input.stream.customParameters || []) {
      if (!parameter.name || !parameter.value) continue;
      stream.parameter({ name: parameter.name, value: parameter.value });
    }
  }
  const dial = response.dial({
    answerOnBridge: true,
    timeout: input.timeoutSeconds
  });
  dial.number(
    {
      statusCallback: input.statusCallbackUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
    },
    input.forwardingNumber
  );
  return response;
}

export function buildMissingForwardingFallbackTwiml() {
  const response = new Twiml.VoiceResponse();
  response.say("We're unable to connect your call right now. Please try again shortly.");
  response.hangup();
  return response;
}

export function buildUnresolvedNumberFallbackTwiml() {
  const response = new Twiml.VoiceResponse();
  response.say("This line is not configured yet.");
  response.hangup();
  return response;
}

export function buildSystemErrorFallbackTwiml() {
  const response = new Twiml.VoiceResponse();
  response.say("Sorry, we are having technical difficulties. Please try again shortly.");
  response.hangup();
  return response;
}
