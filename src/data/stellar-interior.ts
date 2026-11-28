// Derived model values. Rebuild with scripts/derive-stellar-interiors.py.
export const STELLAR_INTERIOR_DATA = {
  "dwarf": {
    "massSun": 0.19952623,
    "radiusKm": 147382.24,
    "temperatureK": 3600,
    "luminositySun": 0.0067945968,
    "initialZ": 0.02,
    "meshCells": 3793,
    "mesaVersion": "4afeff1",
    "initialY": 0.28,
    "hydrogen": 0.69699419
  },
  "massive": {
    "massSun": 20.0,
    "radiusKm": 4102436.84,
    "temperatureK": 34517,
    "luminositySun": 44467.357,
    "initialZ": 0.0142,
    "meshCells": 388,
    "mesaVersion": "c9ff9db",
    "ageYears": 927880,
    "modelNumber": 441,
    "coreKm": 1169091.1
  },
  "giant": {
    "massSun": 0.80409357,
    "radiusKm": 122909787.09,
    "temperatureK": 3071,
    "luminositySun": 2500.7856,
    "initialZ": 0.02,
    "meshCells": 1870,
    "mesaVersion": "15121",
    "ageYears": 12283956883,
    "modelNumber": 9589,
    "coreKm": 18529.87,
    "burningShellKm": 22091.93,
    "envelopeBaseKm": 590704.32,
    "envelopeTopKm": 121232745.39
  },
  "whiteDwarf": {
    "massSun": 0.61131968,
    "radiusKm": 10400.23,
    "temperatureK": 46138,
    "luminositySun": 0.91234677,
    "initialZ": 0.02,
    "meshCells": 731,
    "mesaVersion": "f3de5e0",
    "ageYears": 432737928,
    "modelNumber": 1406,
    "coreKm": 7501.81,
    "heliumOutsideKm": 9176.62
  }
} as const;
