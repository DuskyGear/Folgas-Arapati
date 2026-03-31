export type Employee = {
  id: string;
  name: string;
  role: string;
};

export type EventType = 'ferias' | 'falta' | 'atestado' | 'falta_sem_avisar' | 'folga';

export type ScheduleEvent = {
  id: string;
  employeeId: string;
  type: EventType;
  startDate: string;
  endDate: string;
  notes?: string;
};
