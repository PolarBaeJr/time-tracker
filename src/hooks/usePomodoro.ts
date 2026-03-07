import { useCallback, useMemo } from 'react';

import { usePomodoroSettings } from './usePomodoroSettings';
import { useTimerStore } from '@/stores';
import type { PomodoroPhase } from '@/types';

export interface PomodoroSettings {
  workDurationSeconds: number;
  breakDurationSeconds: number;
  longBreakDurationSeconds: number;
  pomodorosBeforeLongBreak: number;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workDurationSeconds: 25 * 60,
  breakDurationSeconds: 5 * 60,
  longBreakDurationSeconds: 15 * 60,
  pomodorosBeforeLongBreak: 4,
};

export interface PomodoroState {
  settings: PomodoroSettings;
  currentPhase: PomodoroPhase;
  pomodorosCompleted: number;
  phaseDurationSeconds: number;
  timeRemainingSeconds: number;
  isPhaseComplete: boolean;
  nextPhase: PomodoroPhase;
  getNextPhaseInfo: () => { phase: PomodoroPhase; duration: number; pomodorosCompleted: number };
}

export function usePomodoro(): PomodoroState {
  const { settings: pomodoroSettings } = usePomodoroSettings();

  const settings: PomodoroSettings = useMemo(
    () => ({
      workDurationSeconds: pomodoroSettings.workDurationSeconds,
      breakDurationSeconds: pomodoroSettings.breakDurationSeconds,
      longBreakDurationSeconds: pomodoroSettings.longBreakDurationSeconds,
      pomodorosBeforeLongBreak: pomodoroSettings.pomodorosBeforeLongBreak,
    }),
    [
      pomodoroSettings.workDurationSeconds,
      pomodoroSettings.breakDurationSeconds,
      pomodoroSettings.longBreakDurationSeconds,
      pomodoroSettings.pomodorosBeforeLongBreak,
    ]
  );

  const activeTimer = useTimerStore(state => state.activeTimer);
  const localElapsed = useTimerStore(state => state.localElapsed);

  const isPomodoro = activeTimer?.timer_mode === 'pomodoro';
  const currentPhase: PomodoroPhase = isPomodoro ? (activeTimer.pomodoro_phase ?? 'work') : 'work';
  const pomodorosCompleted = isPomodoro ? (activeTimer.pomodoros_completed ?? 0) : 0;
  const phaseDurationSeconds = isPomodoro
    ? (activeTimer.phase_duration_seconds ?? settings.workDurationSeconds)
    : 0;

  const timeRemainingSeconds = useMemo(() => {
    if (!isPomodoro || !phaseDurationSeconds) return 0;
    return Math.max(0, phaseDurationSeconds - localElapsed);
  }, [isPomodoro, phaseDurationSeconds, localElapsed]);

  const isPhaseComplete = isPomodoro && phaseDurationSeconds > 0 && timeRemainingSeconds === 0;

  const nextPhase: PomodoroPhase = useMemo(() => {
    if (currentPhase === 'break' || currentPhase === 'long_break') {
      return 'work';
    }
    // After work phase
    const nextCount = pomodorosCompleted + 1;
    if (nextCount >= settings.pomodorosBeforeLongBreak) {
      return 'long_break';
    }
    return 'break';
  }, [currentPhase, pomodorosCompleted, settings.pomodorosBeforeLongBreak]);

  const getNextPhaseInfo = useCallback(() => {
    let phase: PomodoroPhase;
    let duration: number;
    let nextPomodorosCompleted = pomodorosCompleted;

    if (currentPhase === 'work') {
      nextPomodorosCompleted = pomodorosCompleted + 1;
      if (nextPomodorosCompleted >= settings.pomodorosBeforeLongBreak) {
        phase = 'long_break';
        duration = settings.longBreakDurationSeconds;
      } else {
        phase = 'break';
        duration = settings.breakDurationSeconds;
      }
    } else {
      // After break or long break, start work
      phase = 'work';
      duration = settings.workDurationSeconds;
      if (currentPhase === 'long_break') {
        nextPomodorosCompleted = 0;
      }
    }

    return { phase, duration, pomodorosCompleted: nextPomodorosCompleted };
  }, [currentPhase, pomodorosCompleted, settings]);

  return {
    settings,
    currentPhase,
    pomodorosCompleted,
    phaseDurationSeconds,
    timeRemainingSeconds,
    isPhaseComplete,
    nextPhase,
    getNextPhaseInfo,
  };
}
