import React, { useState, useEffect, useRef } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isToday, 
  addDays,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  X, 
  ImagePlus, 
  Calendar as CalendarIcon,
  Users,
  ShieldAlert,
  Download,
  Menu
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';

// Types
interface Employee {
  id: string;
  name: string;
  color: string;
}

type Restriction = [string, string];
type DaysOffMap = Record<string, string[]>;

type AbsenceType = 'vacation' | 'medical' | 'unexcused';

interface Absence {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: AbsenceType;
}

// Constants
const COLORS = [
  'bg-red-100 text-red-800 border-red-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-orange-100 text-orange-800 border-orange-200'
];

export default function App() {
  // State
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('employees');
    return saved ? JSON.parse(saved) : [];
  });
  const [daysOff, setDaysOff] = useState<DaysOffMap>(() => {
    const saved = localStorage.getItem('daysOff');
    return saved ? JSON.parse(saved) : {};
  });
  const [logo, setLogo] = useState<string | null>(() => {
    return localStorage.getItem('logo');
  });
  const [restrictions, setRestrictions] = useState<Restriction[]>(() => {
    const saved = localStorage.getItem('restrictions');
    return saved ? JSON.parse(saved) : [];
  });
  const [absences, setAbsences] = useState<Absence[]>(() => {
    const saved = localStorage.getItem('absences');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // UI State
  const [newEmpName, setNewEmpName] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRestrictionModalOpen, setIsRestrictionModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [resEmp1, setResEmp1] = useState('');
  const [resEmp2, setResEmp2] = useState('');
  const [absEmp, setAbsEmp] = useState('');
  const [absStartDate, setAbsStartDate] = useState('');
  const [absEndDate, setAbsEndDate] = useState('');
  const [absType, setAbsType] = useState<AbsenceType>('vacation');
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<string | null>(null);
  const [selectedEmpForAdd, setSelectedEmpForAdd] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    localStorage.setItem('employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('daysOff', JSON.stringify(daysOff));
  }, [daysOff]);

  useEffect(() => {
    if (logo) {
      localStorage.setItem('logo', logo);
    } else {
      localStorage.removeItem('logo');
    }
  }, [logo]);

  useEffect(() => {
    localStorage.setItem('restrictions', JSON.stringify(restrictions));
  }, [restrictions]);

  useEffect(() => {
    localStorage.setItem('absences', JSON.stringify(absences));
  }, [absences]);

  // Handlers
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    
    const newEmp: Employee = {
      id: crypto.randomUUID(),
      name: newEmpName.trim(),
      color: COLORS[employees.length % COLORS.length]
    };
    
    setEmployees([...employees, newEmp]);
    setNewEmpName('');
  };

  const handleRemoveEmployee = (id: string) => {
    setEmployees(employees.filter(e => e.id !== id));
    // Also remove their days off
    const newDaysOff = { ...daysOff };
    Object.keys(newDaysOff).forEach(date => {
      newDaysOff[date] = newDaysOff[date].filter(empId => empId !== id);
      if (newDaysOff[date].length === 0) delete newDaysOff[date];
    });
    setDaysOff(newDaysOff);
    // Remove restrictions involving this employee
    setRestrictions(restrictions.filter(r => r[0] !== id && r[1] !== id));
    // Remove absences involving this employee
    setAbsences(absences.filter(a => a.employeeId !== id));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canTakeDayOffTogether = (empId1: string, empId2: string) => {
    return !restrictions.some(r => 
      (r[0] === empId1 && r[1] === empId2) || 
      (r[0] === empId2 && r[1] === empId1)
    );
  };

  const isValidDayForEmployee = (empId: string, dateStr: string, currentSchedule: Record<string, string[]>) => {
    const employeesOnDay = currentSchedule[dateStr] || [];
    return employeesOnDay.every(existingEmpId => canTakeDayOffTogether(empId, existingEmpId));
  };

  const handleAddRestriction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resEmp1 || !resEmp2 || resEmp1 === resEmp2) return;
    
    // Check if already exists
    const exists = restrictions.some(r => 
      (r[0] === resEmp1 && r[1] === resEmp2) || 
      (r[0] === resEmp2 && r[1] === resEmp1)
    );
    
    if (!exists) {
      setRestrictions([...restrictions, [resEmp1, resEmp2]]);
    }
    setResEmp1('');
    setResEmp2('');
  };

  const handleRemoveRestriction = (index: number) => {
    setRestrictions(restrictions.filter((_, i) => i !== index));
  };

  const handleAddAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!absEmp || !absStartDate || !absEndDate || !absType) return;
    if (absStartDate > absEndDate) {
      toast.error("Data de início deve ser anterior ou igual à data de fim.");
      return;
    }
    
    const newAbsence: Absence = {
      id: crypto.randomUUID(),
      employeeId: absEmp,
      startDate: absStartDate,
      endDate: absEndDate,
      type: absType
    };
    
    setAbsences([...absences, newAbsence]);
    setAbsEmp('');
    setAbsStartDate('');
    setAbsEndDate('');
    setAbsType('vacation');
    toast.success("Ausência cadastrada com sucesso!");
  };

  const handleRemoveAbsence = (id: string) => {
    setAbsences(absences.filter(a => a.id !== id));
  };

  const generateSchedule = () => {
    if (employees.length === 0) {
      toast.error("Adicione funcionários primeiro.");
      return;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const allDays: string[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      allDays.push(format(new Date(year, month, i), 'yyyy-MM-dd'));
    }

    const newMonthSchedule: Record<string, string[]> = {};

    const isAbsent = (empId: string, dateStr: string) => {
      return absences.some(a => 
        a.employeeId === empId && 
        dateStr >= a.startDate && 
        dateStr <= a.endDate
      );
    };

    const isValidDay = (empId: string, dateStr: string) => {
      if (isAbsent(empId, dateStr)) return false;
      const employeesOnDay = newMonthSchedule[dateStr] || [];
      return employeesOnDay.every(existingEmpId => canTakeDayOffTogether(empId, existingEmpId));
    };

    const shuffledEmployees = [...employees].sort(() => 0.5 - Math.random());

    shuffledEmployees.forEach(emp => {
      let daysNeeded = 5;
      const selectedDays: string[] = [];
      let hasSunday = false;

      // 1. Try to find ONE valid weekend (Saturday + Sunday)
      const validWeekends: [string, string][] = [];
      for (let i = 0; i < allDays.length - 1; i++) {
        const d1 = allDays[i];
        const d2 = allDays[i+1];
        const date1 = parseISO(d1);
        const date2 = parseISO(d2);
        
        if (date1.getDay() === 6 && date2.getDay() === 0) {
          if (isValidDay(emp.id, d1) && isValidDay(emp.id, d2)) {
            validWeekends.push([d1, d2]);
          }
        }
      }

      if (validWeekends.length > 0) {
        // Pick one random weekend
        const weekend = validWeekends[Math.floor(Math.random() * validWeekends.length)];
        selectedDays.push(weekend[0], weekend[1]);
        daysNeeded -= 2;
        hasSunday = true;
      } else {
        // 2. If no full weekend, MUST get a Sunday
        const validSundays = allDays.filter(d => parseISO(d).getDay() === 0 && isValidDay(emp.id, d));
        if (validSundays.length > 0) {
          const sunday = validSundays[Math.floor(Math.random() * validSundays.length)];
          selectedDays.push(sunday);
          daysNeeded -= 1;
          hasSunday = true;
        }

        // 3. And try to get two consecutive days in the week
        const validConsecutivePairs: [string, string][] = [];
        for (let i = 0; i < allDays.length - 1; i++) {
          const d1 = allDays[i];
          const d2 = allDays[i+1];
          if (!selectedDays.includes(d1) && !selectedDays.includes(d2)) {
            // Prevent picking another Sunday if we already have one
            if (hasSunday && (parseISO(d1).getDay() === 0 || parseISO(d2).getDay() === 0)) {
              continue;
            }
            if (isValidDay(emp.id, d1) && isValidDay(emp.id, d2)) {
              validConsecutivePairs.push([d1, d2]);
            }
          }
        }

        if (validConsecutivePairs.length > 0 && daysNeeded >= 2) {
          const pair = validConsecutivePairs[Math.floor(Math.random() * validConsecutivePairs.length)];
          selectedDays.push(pair[0], pair[1]);
          daysNeeded -= 2;
          if (parseISO(pair[0]).getDay() === 0 || parseISO(pair[1]).getDay() === 0) {
            hasSunday = true;
          }
        }
      }

      // Fallback: If somehow we still don't have a Sunday
      if (!hasSunday && daysNeeded > 0) {
        const remainingSundays = allDays.filter(d => parseISO(d).getDay() === 0 && !selectedDays.includes(d) && isValidDay(emp.id, d));
        if (remainingSundays.length > 0) {
          const sunday = remainingSundays[Math.floor(Math.random() * remainingSundays.length)];
          selectedDays.push(sunday);
          daysNeeded -= 1;
          hasSunday = true;
        }
      }

      // 4. Fill remaining days randomly
      if (daysNeeded > 0) {
        const remainingValidDays = allDays.filter(d => {
          if (selectedDays.includes(d)) return false;
          if (!isValidDay(emp.id, d)) return false;
          if (hasSunday && parseISO(d).getDay() === 0) return false; // Max 1 Sunday
          return true;
        });
        remainingValidDays.sort(() => 0.5 - Math.random());

        for (const d of remainingValidDays) {
          if (daysNeeded === 0) break;
          selectedDays.push(d);
          daysNeeded--;
        }
      }

      selectedDays.forEach(day => {
        if (!newMonthSchedule[day]) newMonthSchedule[day] = [];
        newMonthSchedule[day].push(emp.id);
      });
    });

    // Preserve days off from other months, replace current month
    const currentMonthPrefix = format(currentDate, 'yyyy-MM');
    const updatedDaysOff = { ...daysOff };

    Object.keys(updatedDaysOff).forEach(dateStr => {
      if (dateStr.startsWith(currentMonthPrefix)) {
        delete updatedDaysOff[dateStr];
      }
    });

    // Merge new schedule
    Object.keys(newMonthSchedule).forEach(dateStr => {
      updatedDaysOff[dateStr] = newMonthSchedule[dateStr];
    });

    setDaysOff(updatedDaysOff);
    toast.success("Escala gerada com sucesso!");
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, employeeId: string, fromDate: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ employeeId, fromDate }));
  };

  const handleDrop = (e: React.DragEvent, toDate: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    
    try {
      const { employeeId, fromDate } = JSON.parse(data);
      if (fromDate === toDate) return;

      setDaysOff(prev => {
        const newDaysOff = { ...prev };
        
        // Check restrictions
        const employeesOnTargetDay = newDaysOff[toDate] || [];
        let conflictingEmpId: string | null = null;
        
        const hasRestriction = employeesOnTargetDay.some(existingId => {
          if (existingId !== employeeId && !canTakeDayOffTogether(employeeId, existingId)) {
            conflictingEmpId = existingId;
            return true;
          }
          return false;
        });

        if (hasRestriction && conflictingEmpId) {
          const emp1 = employees.find(e => e.id === employeeId)?.name;
          const emp2 = employees.find(e => e.id === conflictingEmpId)?.name;
          toast.error(`Restrição encontrada: ${emp1} não pode folgar com ${emp2}.`);
          return prev;
        }

        // Remove from old date
        if (newDaysOff[fromDate]) {
          newDaysOff[fromDate] = newDaysOff[fromDate].filter(id => id !== employeeId);
          if (newDaysOff[fromDate].length === 0) delete newDaysOff[fromDate];
        }
        
        // Add to new date
        if (!newDaysOff[toDate]) {
          newDaysOff[toDate] = [];
        }
        if (!newDaysOff[toDate].includes(employeeId)) {
          newDaysOff[toDate].push(employeeId);
        }
        
        return newDaysOff;
      });
    } catch (err) {
      console.error("Error parsing drag data", err);
    }
  };

  const handleRemoveDayOff = (employeeId: string, dateStr: string) => {
    setDaysOff(prev => {
      const newDaysOff = { ...prev };
      if (newDaysOff[dateStr]) {
        newDaysOff[dateStr] = newDaysOff[dateStr].filter(id => id !== employeeId);
        if (newDaysOff[dateStr].length === 0) delete newDaysOff[dateStr];
      }
      return newDaysOff;
    });
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateForAdd || !selectedEmpForAdd) return;

    setDaysOff(prev => {
      const newDaysOff = { ...prev };
      
      // Check restrictions
      const employeesOnTargetDay = newDaysOff[selectedDateForAdd] || [];
      let conflictingEmpId: string | null = null;
      
      const hasRestriction = employeesOnTargetDay.some(existingId => {
        if (existingId !== selectedEmpForAdd && !canTakeDayOffTogether(selectedEmpForAdd, existingId)) {
          conflictingEmpId = existingId;
          return true;
        }
        return false;
      });

      if (hasRestriction && conflictingEmpId) {
        const emp1 = employees.find(e => e.id === selectedEmpForAdd)?.name;
        const emp2 = employees.find(e => e.id === conflictingEmpId)?.name;
        toast.error(`Restrição encontrada: ${emp1} não pode folgar com ${emp2}.`);
        return prev;
      }

      if (!newDaysOff[selectedDateForAdd]) {
        newDaysOff[selectedDateForAdd] = [];
      }
      if (!newDaysOff[selectedDateForAdd].includes(selectedEmpForAdd)) {
        newDaysOff[selectedDateForAdd].push(selectedEmpForAdd);
      }
      return newDaysOff;
    });

    setIsAddModalOpen(false);
    setSelectedEmpForAdd('');
  };

  // Helpers
  const getEmployeeDaysOffCount = (empId: string) => {
    let count = 0;
    const currentMonthPrefix = format(currentDate, 'yyyy-MM');
    Object.entries(daysOff).forEach(([dateStr, empIds]: [string, string[]]) => {
      if (dateStr.startsWith(currentMonthPrefix) && empIds.includes(empId)) {
        count++;
      }
    });
    return count;
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const exportToPDF = async () => {
    if (!calendarRef.current) return;
    try {
      setIsExporting(true);
      
      const dataUrl = await toPng(calendarRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          margin: '0',
        }
      });

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([841.89, 595.28]); 
      
      const pngImage = await pdfDoc.embedPng(dataUrl);
      const pngDims = pngImage.scale(1);

      const margin = 40;
      const maxWidth = page.getWidth() - margin * 2;
      const maxHeight = page.getHeight() - margin * 2 - 50;

      const scale = Math.min(maxWidth / pngDims.width, maxHeight / pngDims.height);
      const scaledWidth = pngDims.width * scale;
      const scaledHeight = pngDims.height * scale;

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const monthName = format(currentDate, 'MMMM yyyy', { locale: ptBR });
      const title = `Escala de Folgas - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;

      page.drawText(title, {
        x: margin,
        y: page.getHeight() - margin - 10,
        size: 20,
        font: font,
      });

      page.drawImage(pngImage, {
        x: margin + (maxWidth - scaledWidth) / 2,
        y: page.getHeight() - margin - 40 - scaledHeight,
        width: scaledWidth,
        height: scaledHeight,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `escala_folgas_${format(currentDate, 'yyyy_MM')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // Render Calendar
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const dateStr = format(day, 'yyyy-MM-dd');
        const isCurrentMonth = isSameMonth(day, monthStart);

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[120px] p-2 border-r border-b border-gray-200 relative group transition-colors",
              !isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white",
              isToday(day) && "bg-blue-50/30"
            )}
            onDragOver={(e) => { 
              e.preventDefault(); 
              e.currentTarget.classList.add('bg-blue-50'); 
            }}
            onDragLeave={(e) => { 
              e.currentTarget.classList.remove('bg-blue-50'); 
            }}
            onDrop={(e) => {
              e.currentTarget.classList.remove('bg-blue-50');
              handleDrop(e, dateStr);
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={cn(
                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full", 
                isToday(day) ? "bg-blue-600 text-white" : "",
                !isCurrentMonth && !isToday(day) ? "text-gray-400" : "text-gray-700"
              )}>
                {formattedDate}
              </span>
              {isCurrentMonth && (
                <button
                  onClick={() => { 
                    setSelectedDateForAdd(dateStr); 
                    setIsAddModalOpen(true); 
                  }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-gray-100 rounded text-gray-500 transition-opacity"
                  title="Adicionar folga manualmente"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {(() => {
                const dayAbsences = absences.filter(a => dateStr >= a.startDate && dateStr <= a.endDate);
                return dayAbsences.map(abs => {
                  const emp = employees.find(e => e.id === abs.employeeId);
                  if (!emp) return null;
                  
                  let bgColor = 'bg-gray-100 text-gray-800 border-gray-200';
                  let label = '';
                  if (abs.type === 'vacation') {
                    bgColor = 'bg-amber-100 text-amber-800 border-amber-200';
                    label = 'Férias';
                  } else if (abs.type === 'medical') {
                    bgColor = 'bg-rose-100 text-rose-800 border-rose-200';
                    label = 'Atestado';
                  } else if (abs.type === 'unexcused') {
                    bgColor = 'bg-slate-100 text-slate-800 border-slate-200';
                    label = 'Falta';
                  }

                  return (
                    <div
                      key={`abs-${abs.id}-${dateStr}`}
                      className={cn(
                        "text-xs px-2 py-1 rounded-md flex justify-between items-center shadow-sm border mb-0.5",
                        bgColor
                      )}
                      title={label}
                    >
                      <span className="truncate font-medium">{emp.name} ({label})</span>
                    </div>
                  );
                });
              })()}
              {daysOff[dateStr]?.map(empId => {
                const emp = employees.find(e => e.id === empId);
                if (!emp) return null;
                return (
                  <div
                    key={empId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, empId, dateStr)}
                    className={cn(
                      "text-xs px-2 py-1.5 rounded-md flex justify-between items-center cursor-move shadow-sm border",
                      emp.color
                    )}
                    title="Arraste para mudar o dia"
                  >
                    <span className="truncate font-medium">{emp.name}</span>
                    <button
                      onClick={() => handleRemoveDayOff(empId, dateStr)}
                      className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                      title="Remover folga"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 border-l border-gray-200" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="border-t border-gray-200">{rows}</div>;
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden print:h-auto print:overflow-visible relative">
      <Toaster position="top-right" richColors />
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-gray-200 flex flex-col shadow-xl md:shadow-sm md:relative transform transition-transform duration-300 ease-in-out print:hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-12 h-12 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              title="Alterar logo"
            >
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="text-gray-400" size={20} />
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">Gerenciador</h1>
              <p className="text-sm text-gray-500">de Folgas</p>
            </div>
          </div>

          <form onSubmit={handleAddEmployee} className="relative">
            <input
              type="text"
              placeholder="Nome do funcionário..."
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <button 
              type="submit" 
              className="absolute right-1.5 top-1.5 p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={!newEmpName.trim()}
            >
              <Plus size={16} />
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3 mb-4 px-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Users size={14} />
              Equipe ({employees.length})
            </h2>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsAbsenceModalOpen(true)}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1.5 transition-colors bg-amber-50 px-2 py-1.5 rounded-md flex-1 justify-center"
                title="Cadastrar Ausências"
              >
                <CalendarIcon size={14} />
                Ausências
              </button>
              <button 
                onClick={() => setIsRestrictionModalOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5 transition-colors bg-blue-50 px-2 py-1.5 rounded-md flex-1 justify-center"
                title="Restrições de folga"
              >
                <ShieldAlert size={14} />
                Restrições
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            {employees.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Nenhum funcionário cadastrado.
              </div>
            ) : (
              employees.map(emp => {
                const count = getEmployeeDaysOffCount(emp.id);
                return (
                  <div 
                    key={emp.id} 
                    className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-3 h-3 rounded-full", emp.color.split(' ')[0])} />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{emp.name}</p>
                        <p className={cn(
                          "text-xs",
                          count === 5 ? "text-green-600 font-medium" : 
                          count > 5 ? "text-red-500 font-medium" : "text-gray-400"
                        )}>
                          {count}/5 folgas neste mês
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveEmployee(emp.id)}
                      className="text-gray-400 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all p-1.5 hover:bg-red-50 rounded-md"
                      title="Remover funcionário"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white print:overflow-visible w-full">
        {/* Header */}
        <header className="h-auto min-h-[5rem] py-3 border-b border-gray-200 px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white shrink-0 print:hidden">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <button 
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 capitalize min-w-[130px] md:min-w-[180px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center justify-center w-full sm:w-auto gap-2 md:gap-3">
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 md:px-4 py-2 md:py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar para PDF"
            >
              <Download size={18} className={isExporting ? "animate-bounce" : ""} />
              <span className="text-sm sm:text-base">{isExporting ? 'Exportando...' : 'Exportar PDF'}</span>
            </button>
            <button
              onClick={generateSchedule}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-lg font-medium transition-colors shadow-sm"
              title="Gerar Folgas do Mês"
            >
              <CalendarIcon size={18} />
              <span className="text-sm sm:text-base">Gerar Folgas</span>
            </button>
          </div>
        </header>

        {/* Calendar */}
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50/50 print:p-0 print:overflow-visible">
          <div ref={calendarRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto print:border-none print:shadow-none print:rounded-none">
            <div className="min-w-[800px]">
              {/* Days of week */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80">
              {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, i) => (
                <div key={day} className={cn(
                  "py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500",
                  i === 0 && "text-red-500" // Highlight Sunday
                )}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            {renderCalendar()}
            </div>
          </div>
        </div>
      </div>

      {/* Add Manual Day Off Modal */}
      {isAddModalOpen && selectedDateForAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Adicionar Folga Manual</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleManualAdd} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data selecionada
                </label>
                <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                  {format(parseISO(selectedDateForAdd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o funcionário
                </label>
                <select
                  value={selectedEmpForAdd}
                  onChange={(e) => setSelectedEmpForAdd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  required
                >
                  <option value="" disabled>Escolha um funcionário...</option>
                  {employees.map(emp => {
                    const isAlreadyOff = selectedDateForAdd ? daysOff[selectedDateForAdd]?.includes(emp.id) : false;
                    return (
                      <option key={emp.id} value={emp.id} disabled={isAlreadyOff}>
                        {emp.name} {isAlreadyOff ? '(Já possui folga neste dia)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedEmpForAdd}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar Folga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Absences Modal */}
      {isAbsenceModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <CalendarIcon className="text-amber-500" size={20} />
                <h3 className="font-bold text-gray-900">Gerenciar Ausências</h3>
              </div>
              <button 
                onClick={() => setIsAbsenceModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-6">
                Cadastre férias, atestados ou faltas para os funcionários.
              </p>

              <form onSubmit={handleAddAbsence} className="flex flex-col gap-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                    Funcionário
                  </label>
                  <select
                    value={absEmp}
                    onChange={(e) => setAbsEmp(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                      Tipo
                    </label>
                    <select
                      value={absType}
                      onChange={(e) => setAbsType(e.target.value as AbsenceType)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="vacation">Férias</option>
                      <option value="medical">Atestado</option>
                      <option value="unexcused">Falta (Sem avisar)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                      Data Início
                    </label>
                    <input
                      type="date"
                      value={absStartDate}
                      onChange={(e) => setAbsStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      value={absEndDate}
                      onChange={(e) => setAbsEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!absEmp || !absStartDate || !absEndDate}
                  className="mt-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cadastrar Ausência
                </button>
              </form>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3">Ausências Cadastradas ({absences.length})</h4>
                {absences.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                    Nenhuma ausência cadastrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {absences.map((abs) => {
                      const emp = employees.find(e => e.id === abs.employeeId);
                      if (!emp) return null;
                      
                      const typeLabel = abs.type === 'vacation' ? 'Férias' : abs.type === 'medical' ? 'Atestado' : 'Falta';
                      const typeColor = abs.type === 'vacation' ? 'text-amber-600 bg-amber-50' : abs.type === 'medical' ? 'text-rose-600 bg-rose-50' : 'text-slate-600 bg-slate-50';
                      
                      return (
                        <div key={abs.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{emp.name}</span>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", typeColor)}>{typeLabel}</span>
                            </div>
                            <span className="text-gray-500 text-xs">
                              {format(parseISO(abs.startDate), 'dd/MM/yyyy')} até {format(parseISO(abs.endDate), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveAbsence(abs.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                            title="Remover ausência"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restrictions Modal */}
      {isRestrictionModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-orange-500" size={20} />
                <h3 className="font-bold text-gray-900">Restrições de Folga</h3>
              </div>
              <button 
                onClick={() => setIsRestrictionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-6">
                Adicione pares de funcionários que <strong>não podem</strong> tirar folga no mesmo dia.
              </p>

              <form onSubmit={handleAddRestriction} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                    Funcionário 1
                  </label>
                  <select
                    value={resEmp1}
                    onChange={(e) => setResEmp1(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id} disabled={emp.id === resEmp2}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="text-gray-400 pb-2 font-medium text-sm hidden sm:block">E</div>
                
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                    Funcionário 2
                  </label>
                  <select
                    value={resEmp2}
                    onChange={(e) => setResEmp2(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id} disabled={emp.id === resEmp1}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!resEmp1 || !resEmp2 || resEmp1 === resEmp2}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[38px] w-full sm:w-auto mt-2 sm:mt-0"
                >
                  Adicionar
                </button>
              </form>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3">Restrições Ativas ({restrictions.length})</h4>
                {restrictions.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                    Nenhuma restrição cadastrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {restrictions.map((res, idx) => {
                      const emp1 = employees.find(e => e.id === res[0]);
                      const emp2 = employees.find(e => e.id === res[1]);
                      if (!emp1 || !emp2) return null;
                      
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-900">{emp1.name}</span>
                            <span className="text-gray-400 text-xs">não folga com</span>
                            <span className="font-medium text-gray-900">{emp2.name}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveRestriction(idx)}
                            className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                            title="Remover restrição"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
