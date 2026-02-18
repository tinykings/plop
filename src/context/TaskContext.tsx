// Retained as a stub — no longer used. NoteContext replaces this.
'use client';

import React, { createContext, useContext } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TaskContext = createContext<any>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  return <TaskContext.Provider value={{}}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  return useContext(TaskContext);
}
