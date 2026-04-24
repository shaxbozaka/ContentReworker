import { useState, useMemo } from "react";
import { Check } from "lucide-react";

interface SmartTimePickerProps {
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  existingPostDates?: Date[];
}

export default function SmartTimePicker({ onSelect, selectedDate, existingPostDates = [] }: SmartTimePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  const timeOptions = useMemo(() => {
    const now = new Date();
    const options: { label: string; date: Date }[] = [];

    // Tomorrow 9am
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    options.push({ label: "Tomorrow, 9:00 AM", date: tomorrow });

    // Next Tuesday 9am (or this Tuesday if today is before Tuesday)
    const tuesday = new Date(now);
    const daysUntilTuesday = (2 - now.getDay() + 7) % 7 || 7;
    tuesday.setDate(now.getDate() + daysUntilTuesday);
    tuesday.setHours(9, 0, 0, 0);
    if (tuesday > tomorrow) {
      options.push({
        label: tuesday.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + ", 9:00 AM",
        date: tuesday
      });
    }

    // Next Wednesday 12pm
    const wednesday = new Date(now);
    const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7;
    wednesday.setDate(now.getDate() + daysUntilWednesday);
    wednesday.setHours(12, 0, 0, 0);
    if (wednesday > tomorrow) {
      options.push({
        label: wednesday.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + ", 12:00 PM",
        date: wednesday
      });
    }

    return options.slice(0, 3);
  }, []);

  const handleCustomSubmit = () => {
    if (customDate && customTime) {
      const date = new Date(`${customDate}T${customTime}`);
      if (date > new Date()) {
        onSelect(date);
        setShowCustom(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Quick options */}
      {timeOptions.map((option, index) => (
        <button
          key={index}
          onClick={() => onSelect(option.date)}
          className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${
            selectedDate?.getTime() === option.date.getTime()
              ? 'bg-white/10 border-white/20'
              : 'bg-white/[0.02] border-white/10 hover:bg-white/5'
          }`}
        >
          <span className="text-white/80 text-sm">{option.label}</span>
          {selectedDate?.getTime() === option.date.getTime() && (
            <Check className="w-4 h-4 text-white/60" />
          )}
        </button>
      ))}

      {/* Custom time toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
          showCustom ? 'bg-white/5 border-white/20' : 'bg-white/[0.02] border-white/10 hover:bg-white/5'
        }`}
      >
        <span className="text-white/60 text-sm">Pick custom time</span>
      </button>

      {/* Custom inputs */}
      {showCustom && (
        <div className="flex gap-2 mt-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="w-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customDate || !customTime}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-30"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}
