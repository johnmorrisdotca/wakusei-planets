// Made by scripts/make-orbiter-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): the spacecraft in orbit round the Moon and Mars, as mean elements with secular rates fitted over a window
// of each craft's current track (centre the body, in the body's equator frame of the pole given, km and degrees, `epochJd` in TDB, the dates in UTC), with the dates the fit is good for and its error against Horizons, over the fit and past it. Fetched 2026-11-12. Do not edit by hand.
export const ORBITER_FITS = {
  "lro": {
    "id": "lro",
    "center": "moon",
    "horizonsId": -85,
    "pole": [
      269.9949,
      66.5392
    ],
    "prime": [
      38.3213,
      13.17635815
    ],
    "epochJd": 2461353.000801,
    "a": 1827.833,
    "e": 0.0124504,
    "i": 82.79029,
    "raan": 18.50175,
    "argp": 61.92079,
    "m0": 185.61327,
    "raanRate": 0.004191,
    "argpRate": 9.5110522,
    "meanMotionCorrection": -10.3194214,
    "periodDays": 0.0813505,
    "validFrom": "2026-11-05T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-19T00:00:00Z",
    "trackedUntil": "",
    "trackEnd": "",
    "horizonsRevised": "Oct 07, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 11.2,
      "max": 26.3
    },
    "predictedErrorKm": {
      "median": 91.5,
      "max": 206.2
    },
    "basis": "tracked"
  },
  "chandrayaan-2": {
    "id": "chandrayaan-2",
    "center": "moon",
    "horizonsId": -152,
    "pole": [
      269.9949,
      66.5392
    ],
    "prime": [
      38.3213,
      13.17635815
    ],
    "epochJd": 2461353.000801,
    "a": 1839.494,
    "e": 0.0130231,
    "i": 90.16894,
    "raan": 286.94281,
    "argp": 357.10556,
    "m0": 140.02256,
    "raanRate": 0.1006207,
    "argpRate": 2.1563679,
    "meanMotionCorrection": -3.6610741,
    "periodDays": 0.0820075,
    "validFrom": "2026-11-05T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-19T00:00:00Z",
    "trackedUntil": "2026-Nov-01",
    "trackEnd": "",
    "horizonsRevised": "Nov 03, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 11.5,
      "max": 37.7
    },
    "predictedErrorKm": {
      "median": 111.5,
      "max": 243.8
    },
    "basis": "tracked"
  },
  "danuri": {
    "id": "danuri",
    "center": "moon",
    "horizonsId": -155,
    "pole": [
      269.9949,
      66.5392
    ],
    "prime": [
      38.3213,
      13.17635815
    ],
    "epochJd": 2461353.000801,
    "a": 1868.132,
    "e": 0.0381572,
    "i": 88.40211,
    "raan": 307.64463,
    "argp": 273.69568,
    "m0": 117.13177,
    "raanRate": 0.0229026,
    "argpRate": 1.0365395,
    "meanMotionCorrection": -2.4755357,
    "periodDays": 0.0839085,
    "validFrom": "2026-11-05T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-19T00:00:00Z",
    "trackedUntil": "",
    "trackEnd": "",
    "horizonsRevised": "Nov 10, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 7.1,
      "max": 34.6
    },
    "predictedErrorKm": {
      "median": 74.4,
      "max": 225.0
    },
    "basis": "tracked"
  },
  "artemis-p1": {
    "id": "artemis-p1",
    "center": "moon",
    "horizonsId": -192,
    "pole": [
      269.9949,
      66.5392
    ],
    "prime": [
      38.3213,
      13.17635815
    ],
    "epochJd": 2461349.500801,
    "a": 9982.387,
    "e": 0.7880008,
    "i": 175.92609,
    "raan": 84.19751,
    "argp": 341.76384,
    "m0": 321.4583,
    "raanRate": 0.8415794,
    "argpRate": 0.8983474,
    "meanMotionCorrection": -0.4232021,
    "periodDays": 1.0371099,
    "validFrom": "2026-10-29T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-26T00:00:00Z",
    "trackedUntil": "2026-Oct-29",
    "trackEnd": "",
    "horizonsRevised": "Nov 03, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 478.2,
      "max": 3248.7
    },
    "predictedErrorKm": {
      "median": 660.6,
      "max": 4604.8
    },
    "basis": "modelled"
  },
  "artemis-p2": {
    "id": "artemis-p2",
    "center": "moon",
    "horizonsId": -193,
    "pole": [
      269.9949,
      66.5392
    ],
    "prime": [
      38.3213,
      13.17635815
    ],
    "epochJd": 2461349.500801,
    "a": 10519.186,
    "e": 0.7736396,
    "i": 19.73931,
    "raan": 260.19199,
    "argp": 6.69725,
    "m0": 89.3298,
    "raanRate": -0.365736,
    "argpRate": 0.3024694,
    "meanMotionCorrection": -0.4208017,
    "periodDays": 1.1219834,
    "validFrom": "2026-10-29T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-26T00:00:00Z",
    "trackedUntil": "2026-Oct-30",
    "trackEnd": "",
    "horizonsRevised": "Nov 10, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 595.1,
      "max": 4189.5
    },
    "predictedErrorKm": {
      "median": 1212.3,
      "max": 7169.1
    },
    "basis": "modelled"
  },
  "capstone": {
    "id": "capstone",
    "center": "moon",
    "horizonsId": -1176,
    "basis": "modelled",
    "retrieved": "2026-11-12",
    "horizonsRevised": "Jul 20, 2026",
    "trackedUntil": "2026-08-14",
    "trackEnd": "2026-08-13T11:58:50Z"
  },
  "mro": {
    "id": "mro",
    "center": "mars",
    "horizonsId": -74,
    "pole": [
      317.68143,
      52.8865
    ],
    "prime": [
      176.63,
      350.89198226
    ],
    "epochJd": 2461353.000801,
    "a": 3657.232,
    "e": 0.0090177,
    "i": 92.67858,
    "raan": 280.79384,
    "argp": 269.79926,
    "m0": 70.84025,
    "raanRate": 0.5258712,
    "argpRate": -0.0393425,
    "meanMotionCorrection": -11.4027472,
    "periodDays": 0.0779111,
    "validFrom": "2026-11-05T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-19T00:00:00Z",
    "trackedUntil": "",
    "trackEnd": "",
    "horizonsRevised": "Nov 03, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 9.5,
      "max": 27.0
    },
    "predictedErrorKm": {
      "median": 10.8,
      "max": 31.5
    },
    "basis": "tracked"
  },
  "odyssey": {
    "id": "odyssey",
    "center": "mars",
    "horizonsId": -53,
    "pole": [
      317.68143,
      52.8865
    ],
    "prime": [
      176.63,
      350.89198226
    ],
    "epochJd": 2461353.000801,
    "a": 3794.989,
    "e": 0.0083212,
    "i": 92.95162,
    "raan": 144.72036,
    "argp": 273.7271,
    "m0": 195.18414,
    "raanRate": 0.5204129,
    "argpRate": 0.0361697,
    "meanMotionCorrection": -10.111977,
    "periodDays": 0.0823416,
    "validFrom": "2026-11-05T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-19T00:00:00Z",
    "trackedUntil": "",
    "trackEnd": "",
    "horizonsRevised": "Nov 03, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 8.6,
      "max": 15.4
    },
    "predictedErrorKm": {
      "median": 18.9,
      "max": 49.2
    },
    "basis": "tracked"
  },
  "maven": {
    "id": "maven",
    "center": "mars",
    "horizonsId": -202,
    "pole": [
      317.68143,
      52.8865
    ],
    "prime": [
      176.63,
      350.89198226
    ],
    "epochJd": 2461096.5,
    "a": 5734.045,
    "e": 0.3702219,
    "i": 74.99112,
    "raan": 302.96505,
    "argp": 58.87102,
    "m0": 44.69217,
    "raanRate": -0.8463665,
    "argpRate": -1.1029384,
    "meanMotionCorrection": -1.192116,
    "periodDays": 0.1526551,
    "validFrom": "2026-02-21T11:58:50Z",
    "fitUntil": "2026-02-28T11:58:50Z",
    "validUntil": "2026-03-07T11:58:50Z",
    "trackedUntil": "2025-Dec-04",
    "trackEnd": "2026-02-28T11:58:50Z",
    "horizonsRevised": "Feb 13, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 5.4,
      "max": 12.3
    },
    "predictedErrorKm": null,
    "basis": "modelled"
  },
  "mars-express": {
    "id": "mars-express",
    "center": "mars",
    "horizonsId": -41,
    "pole": [
      317.68143,
      52.8865
    ],
    "prime": [
      176.63,
      350.89198226
    ],
    "epochJd": 2461351.500801,
    "a": 8816.1,
    "e": 0.5683865,
    "i": 87.17629,
    "raan": 44.25024,
    "argp": 67.89943,
    "m0": 33.46229,
    "raanRate": -0.0582399,
    "argpRate": -0.5852057,
    "meanMotionCorrection": -0.4828015,
    "periodDays": 0.2909944,
    "validFrom": "2026-11-02T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-22T00:00:00Z",
    "trackedUntil": "2026-Oct-21",
    "trackEnd": "",
    "horizonsRevised": "Nov 03, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 6.8,
      "max": 18.7
    },
    "predictedErrorKm": {
      "median": 8.1,
      "max": 28.2
    },
    "basis": "tracked"
  },
  "tgo": {
    "id": "tgo",
    "center": "mars",
    "horizonsId": -143,
    "pole": [
      317.68143,
      52.8865
    ],
    "prime": [
      176.63,
      350.89198226
    ],
    "epochJd": 2461354.500801,
    "a": 3782.075,
    "e": 0.0071903,
    "i": 75.92753,
    "raan": 306.9378,
    "argp": 270.05235,
    "m0": 81.99723,
    "raanRate": -2.500131,
    "argpRate": 0.2015422,
    "meanMotionCorrection": -8.1449683,
    "periodDays": 0.0818841,
    "validFrom": "2026-11-08T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-16T00:00:00Z",
    "trackedUntil": "",
    "trackEnd": "",
    "horizonsRevised": "Jan 13, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 7.9,
      "max": 16.0
    },
    "predictedErrorKm": {
      "median": 8.8,
      "max": 27.8
    },
    "basis": "tracked"
  },
  "hope": {
    "id": "hope",
    "center": "mars",
    "horizonsId": -62,
    "pole": [
      317.68143,
      52.8865
    ],
    "prime": [
      176.63,
      350.89198226
    ],
    "epochJd": 2461351.500801,
    "a": 35135.691,
    "e": 0.3380819,
    "i": 23.75226,
    "raan": 115.3567,
    "argp": 193.69303,
    "m0": 30.25594,
    "raanRate": -0.0057366,
    "argpRate": 0.0063908,
    "meanMotionCorrection": 0.0064724,
    "periodDays": 2.3142219,
    "validFrom": "2026-11-02T00:00:00Z",
    "fitUntil": "2026-11-12T00:00:00Z",
    "validUntil": "2026-11-22T00:00:00Z",
    "trackedUntil": "2026-Oct-15",
    "trackEnd": "",
    "horizonsRevised": "Nov 03, 2026",
    "retrieved": "2026-11-12",
    "fitErrorKm": {
      "median": 3.7,
      "max": 12.2
    },
    "predictedErrorKm": {
      "median": 13.8,
      "max": 27.9
    },
    "basis": "tracked"
  },
  "tianwen-1": {
    "id": "tianwen-1",
    "center": "mars",
    "horizonsId": -9901491,
    "basis": "modelled",
    "retrieved": "2026-11-12"
  }
} as const;
