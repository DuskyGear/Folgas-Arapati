import { Employee, ScheduleEvent } from '../types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isSameDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export function Dashboard({ employees, events }: { employees: Employee[], events: ScheduleEvent[] }) {
  const today = new Date();
  
  const todayEvents = events.filter(event => {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    return isWithinInterval(today, { start: startOfDay(start), end: endOfDay(end) });
  });

  const upcomingEvents = events.filter(event => {
    const start = parseISO(event.startDate);
    return isAfter(startOfDay(start), endOfDay(today));
  }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).slice(0, 5);

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  const ferias = todayEvents.filter(e => e.type === 'ferias');
  const faltas = todayEvents.filter(e => e.type === 'falta' || e.type === 'falta_sem_avisar');
  const atestados = todayEvents.filter(e => e.type === 'atestado');
  const folgas = todayEvents.filter(e => e.type === 'folga');

  const renderEventItem = (event: ScheduleEvent) => {
    let color = 'bg-gray-100 text-gray-800';
    let label = 'Desconhecido';
    
    if (event.type === 'ferias') { color = 'bg-blue-100 text-blue-800'; label = 'Férias'; }
    if (event.type === 'falta') { color = 'bg-orange-100 text-orange-800'; label = 'Falta'; }
    if (event.type === 'atestado') { color = 'bg-purple-100 text-purple-800'; label = 'Atestado'; }
    if (event.type === 'falta_sem_avisar') { color = 'bg-red-100 text-red-800'; label = 'Falta s/ avisar'; }
    if (event.type === 'folga') { color = 'bg-green-100 text-green-800'; label = 'Folga'; }

    return (
      <li key={event.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
            {label}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{getEmployeeName(event.employeeId)}</p>
            {event.notes && <p className="text-xs text-gray-500">{event.notes}</p>}
          </div>
        </div>
        <div className="text-sm text-gray-500 text-right">
          {isSameDay(parseISO(event.startDate), parseISO(event.endDate)) ? (
            <span>{format(parseISO(event.startDate), 'dd/MM')}</span>
          ) : (
            <span>{format(parseISO(event.startDate), 'dd/MM')} até {format(parseISO(event.endDate), 'dd/MM')}</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total de Funcionários</p>
            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-full text-orange-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Faltas Hoje</p>
            <p className="text-2xl font-bold text-gray-900">{faltas.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-full text-purple-600">
            <CalendarIcon size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">De Férias</p>
            <p className="text-2xl font-bold text-gray-900">{ferias.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-full text-green-600">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">De Folga Hoje</p>
            <p className="text-2xl font-bold text-gray-900">{folgas.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarIcon size={20} className="text-blue-600" />
              Eventos de Hoje ({format(today, "dd 'de' MMMM", { locale: ptBR })})
            </h2>
          </div>
          
          {todayEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Nenhum evento registrado para hoje.</p>
              <p className="text-sm mt-1">Todos os funcionários devem estar trabalhando normalmente.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {todayEvents.map(renderEventItem)}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              Próximos Eventos
            </h2>
          </div>
          
          {upcomingEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CalendarIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Nenhum evento futuro registrado.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {upcomingEvents.map(renderEventItem)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
