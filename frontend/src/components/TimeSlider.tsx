import { useEffect, useMemo, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

type TimeMode = "month" | "year";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

interface TimeSliderProps {
	startDate: Date;
	endDate: Date;
	currentRange: [Date, Date];
	onRangeChange: (range: [Date, Date]) => void;
}

export function TimeSlider({ currentRange, onRangeChange }: TimeSliderProps) {
	// Initialize state from currentRange
	const [mode, setMode] = useState<TimeMode>("month");
	const [selectedYear, setSelectedYear] = useState<number>(
		currentRange[0].getFullYear(),
	);
	const [selectedMonth, setSelectedMonth] = useState<number>(
		currentRange[0].getMonth(),
	);

	// Generate years from 2020 to current year
	const availableYears = useMemo(() => {
		const currentYear = new Date().getFullYear();
		const years: number[] = [];
		for (let year = 2020; year <= currentYear; year++) {
			years.push(year);
		}
		return years;
	}, []);

	// Calculate and emit the date range when selection changes
	useEffect(() => {
		let start: Date;
		let end: Date;

		if (mode === "month") {
			// First day of the selected month
			start = new Date(selectedYear, selectedMonth, 1);
			// Last day of the selected month
			end = new Date(selectedYear, selectedMonth + 1, 0);
		} else {
			// First day of the selected year
			start = new Date(selectedYear, 0, 1);
			// Last day of the selected year
			end = new Date(selectedYear, 11, 31);
		}

		// Only call onRangeChange if the range actually changed
		if (
			start.getTime() !== currentRange[0].getTime() ||
			end.getTime() !== currentRange[1].getTime()
		) {
			onRangeChange([start, end]);
		}
	}, [mode, selectedYear, selectedMonth, onRangeChange, currentRange]);

	const handleModeToggle = (checked: boolean) => {
		setMode(checked ? "year" : "month");
	};

	const handleYearChange = (year: string) => {
		setSelectedYear(Number(year));
	};

	const handleMonthChange = (month: string) => {
		setSelectedMonth(Number(month));
	};

	return (
		<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-10">
			<div className="flex items-center gap-4">
				{/* Mode Toggle */}
				<div className="flex items-center gap-2">
					<span
						className={`text-sm ${mode === "month" ? "text-slate-900 font-medium" : "text-slate-400"}`}
					>
						Monthly
					</span>
					<Switch
						checked={mode === "year"}
						onCheckedChange={handleModeToggle}
					/>
					<span
						className={`text-sm ${mode === "year" ? "text-slate-900 font-medium" : "text-slate-400"}`}
					>
						Yearly
					</span>
				</div>

				{/* Divider */}
				<div className="h-6 w-px bg-slate-200" />

				{/* Month Dropdown - only shown in month mode */}
				{mode === "month" && (
					<Select
						value={selectedMonth.toString()}
						onValueChange={handleMonthChange}
					>
						<SelectTrigger className="h-8 w-[120px] text-sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{MONTH_NAMES.map((month, index) => (
								<SelectItem key={month} value={index.toString()}>
									{month}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				{/* Year Dropdown */}
				<Select
					value={selectedYear.toString()}
					onValueChange={handleYearChange}
				>
					<SelectTrigger className="h-8 w-[80px] text-sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{availableYears.map((year) => (
							<SelectItem key={year} value={year.toString()}>
								{year}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
