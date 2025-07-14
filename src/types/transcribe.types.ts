export type Word = { text: string; start: number; end: number };

export type Detection = {
	type: 'Filler Word' | 'Pause' | 'Cough';
	start: string;
	end: string;
	word?: string;
};
