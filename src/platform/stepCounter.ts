export type StepsPermissionState = "prompt" | "granted" | "denied" | "limited" | "unknown" | "unavailable";

type StepEvent = { today: number };
type Listener = (event: StepEvent) => void;

const listeners = new Set<Listener>();

export const StepCounter = {
  async checkPermissions(): Promise<{ steps: StepsPermissionState }> {
    return { steps: "denied" };
  },
  async requestPermissions(): Promise<{ steps: StepsPermissionState }> {
    return { steps: "denied" };
  },
  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  },
  async sync(): Promise<{ today: number }> {
    return { today: 0 };
  },
  async getSteps(_options: { date: string }): Promise<{ steps: number }> {
    return { steps: 0 };
  },
  async addListener(_event: "stepsChanged", listener: Listener): Promise<{ remove: () => Promise<void> }> {
    listeners.add(listener);
    return { remove: async () => { listeners.delete(listener); } };
  },
  async stopTracking(): Promise<void> {},
};
