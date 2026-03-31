import { useState, FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Employee, EventType, ScheduleEvent } from '../types';
import { format, addDays, isSaturday, isSunday, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: 'ferias', label: 'Férias', color: 'bg-blue-100 text-blue-800' },
  { value: 'falta', label: 'Falta', color: 'bg-orange-100 text-orange-800' },
  { value: 'atestado', label: 'Atestado', color: 'bg-purple-100 text-purple-800' },
  { value: 'falta_sem_avisar', label: 'Falta sem avisar', color: 'bg-red-100 text-red-800' },
  { value: 'folga', label: 'Folga', color: 'bg-green-100 text-green-800' },
];

export function Schedule({
  employees,
  events,
  setEvents
}: {
  employees: Employee[],
  events: ScheduleEvent[],
  setEvents: (e: ScheduleEvent[]) => void
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<EventType>('folga');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionAction, setSuggestionAction] = useState<(() => void) | null>(null);

  const handleTypeChange = (newType: EventType) => {
    setType(newType);
    if (newType !== 'folga' && newType !== 'ferias' && newType !== 'atestado') {
      // Single day events by default
      setEndDate(startDate);
    }
    checkSuggestions(startDate, newType);
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (type !== 'ferias' && type !== 'atestado' && type !== 'folga') {
      setEndDate(date);
    } else if (startDate === endDate || new Date(date) > new Date(endDate)) {
      setEndDate(date);
    }
    checkSuggestions(date, type);
  };

  const checkSuggestions = (dateStr: string, currentType: EventType) => {
    setSuggestion(null);
    setSuggestionAction(null);

    if (currentType === 'folga') {
      const date = parseISO(dateStr);
      if (isSaturday(date)) {
        setSuggestion('Sábado selecionado. Deseja estender a folga para o Domingo (2 dias seguidos)?');
        setSuggestionAction(() => () => {
          setEndDate(format(addDays(date, 1), 'yyyy-MM-dd'));
          setSuggestion(null);
        });
      } else if (!isSunday(date)) {
        setSuggestion('Geralmente é bom dar 2 dias seguidos de folga. Deseja adicionar o dia seguinte?');
        setSuggestionAction(() => () => {
          setEndDate(format(addDays(date, 1), 'yyyy-MM-dd'));
          setSuggestion(null);
        });
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      alert('Selecione um funcionário');
      return;
    }

    const newEvent: ScheduleEvent = {
      id: uuidv4(),
      employeeId,
      type,
      startDate,
      endDate,
      notes
    };

    setEvents([...events, newEvent]);
    
    // Reset form
    setNotes('');
    setSuggestion(null);
    setSuggestionAction(null);
    
    // Show confirmation if it's a 2-day folga
    if (type === 'folga' && startDate !== endDate) {
      alert('Sucesso: Folga de múltiplos dias registrada!');
    }
  };

  const handleDelete = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Registrar Evento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Evento</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as EventType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {(type === 'ferias' || type === 'atestado' || type === 'folga') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Fim</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}
          </div>

          {suggestion && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md flex items-start gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="text-sm font-medium">{suggestion}</p>
                {suggestionAction && (
                  <button
                    type="button"
                    onClick={suggestionAction}
                    className="mt-2 text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors"
                  >
                    Sim, aplicar sugestão
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Motivo da falta, detalhes do atestado..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              Salvar Registro
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Histórico de Eventos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obs</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Nenhum evento registrado.</td>
                </tr>
              ) : (
                events.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map((event) => {
                  const typeInfo = EVENT_TYPES.find(t => t.value === event.type);
                  const isSame = event.startDate === event.endDate;
                  
                  return (
                    <tr key={event.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getEmployeeName(event.employeeId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${typeInfo?.color}`}>
                          {typeInfo?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(parseISO(event.startDate), 'dd/MM/yyyy')}
                        {!isSame && ` até ${format(parseISO(event.endDate), 'dd/MM/yyyy')}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {event.notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
