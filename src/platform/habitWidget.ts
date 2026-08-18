export const HabitWidget = {
  async updateWidgetData(_data: unknown): Promise<void> {},
  async updateDailyProgressWidget(_data: unknown): Promise<void> {},
  async updateTasksWidget(_data: unknown): Promise<void> {},
  async updateStepWidget(_data: unknown): Promise<void> {},
  async getAndClearPendingActions(): Promise<{ actions: unknown[] }> { return { actions: [] }; },
};
