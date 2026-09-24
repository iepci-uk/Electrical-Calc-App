// ============================================================
// Reference data used by the calculations.
// Values marked "design sheet" come from the Excel workbooks.
// ============================================================

// Cable presets: mV/A/m (3-phase) at 30 degC, as used in the design sheet
// (taken from BS 7671 tables). Add more rows here as needed.
export const CABLE_PRESETS = [
  { id: 'cu-4c-50',   label: 'Cu 4C x 50 mm²',       r: 0.86,  x: 0.135 },
  { id: 'cu-4c-150',  label: 'Cu 4C x 150 mm²',      r: 0.28,  x: 0.125 },
  { id: 'cu-4c-240',  label: 'Cu 4C x 240 mm²',      r: 0.175, x: 0.125 },
  { id: 'cu-1c-240',  label: 'Cu 4 x 1C x 240 mm²',  r: 0.17,  x: 0.14 },
  { id: 'cu-1c-300',  label: 'Cu 4 x 1C x 300 mm²',  r: 0.14,  x: 0.14 },
];

// Resistivity used for busbars / bus-ways (mOhm.mm²/m) - design sheet
export const RHO = { Cu: 22.5, Al: 36 };

// Adiabatic k factors (IEC 60364-5-54 / BS 7671 Table 43.1), conductor + insulation
export const K_FACTORS = [
  { id: 'cu-pvc',  label: 'Copper / PVC (70°C)',        k: 115 },
  { id: 'cu-xlpe', label: 'Copper / XLPE-EPR (90°C)',   k: 143 },
  { id: 'al-pvc',  label: 'Aluminium / PVC (70°C)',     k: 76 },
  { id: 'al-xlpe', label: 'Aluminium / XLPE-EPR (90°C)', k: 94 },
];

// Common breaking capacities (Icu, kA) offered by LV breaker makers
export const BREAKER_ICU = [6, 10, 16, 20, 25, 36, 42, 50, 65, 70, 85, 100, 120, 150];

// Ratio n = Icm / Icu (IEC 60947-2, Table 2)
export function nFactor(icuKA) {
  if (icuKA <= 4.5) return 1.5;
  if (icuKA <= 6) return 1.7;
  if (icuKA <= 10) return 2.0;
  if (icuKA <= 20) return 2.1;
  return 2.2;
}

// Default settings for the impedance method (all from the design sheet)
export const NETWORK_SETTINGS = {
  ambientTemp: 50,     // degC                                   (D10)
  alpha: 0.00323,      // copper temperature coefficient         (F12)
  tempOnX: true,       // sheet also scales X with temperature
  netXFactor: 0.98,    // network X = 0.98 Zn                    (D17)
  netRFactor: 0.2,     // network R = 0.2 Zn                     (H53)
  trafoRFactor: 0.2,   // transformer R = 0.2 X                  (L25)
  genRFactor: 0.1,     // generator R = 0.1 X                    (L21)
  exactZ: false,       // false = sheet method (X = Z). true = split Z exactly into R and X
  xPerMetre: 0.00015,  // busbar / bus-way reactance, Ohm per metre (L32)
  xBreaker: 0.00015,   // breaker reactance, Ohm                 (E32)
  motorXFactor: 0.25,  // motor X = 0.25 x V²/(P/(eta.cos))      (E44)
};
