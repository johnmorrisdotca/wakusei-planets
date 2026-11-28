#!/usr/bin/env python3
"""Read four pinned MESA structures and print the TypeScript numbers for their cutaways.

The saved model files and the ZAMS grid are distributed separately by MESA.
Run with the directory containing the four files named in SOURCES.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import re


SOURCES = {
    'dwarf': ('zams_z2m2_y28.data', '84651346e4313c7160c7b6f2b8d15629da71fc50a9ffa7eb019dcd24413fddbb'),
    'massive': ('star_test_suite_20M_pre_ms_to_core_collapse_standard_zams.mod', '133a5ee96544e548f4094310fe94ef2dbce7246c8bdbe51f9a6a7fb16ce119b0'),
    'giant': ('star_test_suite_1M_pre_ms_to_wd_standard_start_he_core_flash.mod', '294021222c38c37d9f665e8275c915ffa8f388c17da0e574ad980304f866b812'),
    'whiteDwarf': ('star_test_suite_wd_cool_0.6M_co_wd_settled.mod', '5188b9e626ad429cb6fcb9509b8f9c071c649210ef4ae508022edd0366c151eb'),
}
STEFAN_BOLTZMANN_CGS = 5.670374419e-5
SOLAR_LUMINOSITY_CGS = 3.828e33
DWARF_MASS = 0.199526231496888


def decimal(text):
    """MESA's Fortran output also drops the exponent marker for three digits."""
    text = text.replace('D', 'e')
    if 'e' not in text.lower():
        text = re.sub(r'(?<=\d)([+-]\d{3})$', r'e\1', text)
    return float(text)


def read_rows(lines, count):
    columns = next(lines).split()
    rows = []
    for expected in range(1, count + 1):
        index, *values = next(lines).split()
        if int(index) != expected or len(values) != len(columns):
            raise ValueError(f'Unexpected layout in mesh cell {expected}')
        row = dict(zip(columns, map(decimal, values)))
        row['radiusKm'] = math.exp(row['lnR']) / 1e5
        rows.append(row)
    if not all(a['radiusKm'] >= b['radiusKm'] for a, b in zip(rows, rows[1:])):
        raise ValueError('The mesh must run from the photosphere towards the centre')
    if any(row['dq'] <= 0 for row in rows) or not math.isclose(math.fsum(row['dq'] for row in rows), 1, abs_tol=1e-7):
        raise ValueError('The mesh cell masses must sum to one stellar mass')
    return rows


def read_saved_model(path):
    fields = {'M/Msun', 'initial_z', 'model_number', 'n_shells', 'star_age', 'Teff', 'version_number'}
    header = {}
    with path.open() as lines:
        for line in lines:
            fields_here = line.split()
            if len(fields_here) >= 2 and fields_here[0] in fields:
                header[fields_here[0]] = fields_here[1].strip("'")
            if not line.strip() and fields.issubset(header.keys() | {'Teff'}):
                break
        rows = read_rows(lines, int(header['n_shells']))
    return header, rows


def read_zams_dwarf(path):
    header = {}
    with path.open() as lines:
        for line in lines:
            fields = line.split()
            if len(fields) == 2 and fields[0] in ('version_number', 'initial_z', 'initial_y'):
                header[fields[0]] = fields[1]
            if len(fields) == 2 and fields[0] == 'M/Msun' and fields[1] != 'n_shells':
                mass = decimal(fields[1])
                if math.isclose(mass, DWARF_MASS, rel_tol=1e-10):
                    header['M/Msun'] = fields[1]
                    key, header['n_shells'] = next(lines).split()
                    if key != 'n_shells' or next(lines).strip():
                        raise ValueError('Unexpected structure header in the ZAMS grid')
                    return header, read_rows(lines, int(header['n_shells']))
    raise ValueError(f'No {DWARF_MASS} solar-mass model in the verified grid')


def basic_data(header, rows):
    surface = rows[0]
    radius = surface['radiusKm']
    temperature = (surface['L'] / (4 * math.pi * (radius * 1e5) ** 2 * STEFAN_BOLTZMANN_CGS)) ** 0.25
    return {
        'massSun': round(decimal(header['M/Msun']), 8),
        'radiusKm': round(radius, 2),
        'temperatureK': round(decimal(header['Teff']) if 'Teff' in header else temperature),
        'luminositySun': float(f"{surface['L'] / SOLAR_LUMINOSITY_CGS:.8g}"),
        'initialZ': decimal(header['initial_z']),
        'meshCells': len(rows),
        'mesaVersion': header['version_number'],
    }


def saved_data(header, rows):
    return {
        **basic_data(header, rows),
        'ageYears': round(decimal(header['star_age'])),
        'modelNumber': int(header['model_number']),
    }


def crossing(rows, value, threshold):
    for i, (outer, inner) in enumerate(zip(rows, rows[1:])):
        before, after = value(outer), value(inner)
        if (before >= threshold) != (after >= threshold):
            return i, (threshold - before) / (after - before)
    raise ValueError(f'No crossing of {threshold} in the mesh')


def between(rows, i, fraction, key='radiusKm'):
    return rows[i][key] * (1 - fraction) + rows[i + 1][key] * fraction


def dwarf_data(path):
    header, rows = read_zams_dwarf(path)
    hydrogen = [row['h1'] for row in rows]
    if max(hydrogen) - min(hydrogen) > 1e-9:
        raise ValueError('The ZAMS example is expected to be chemically well mixed')
    return {
        **basic_data(header, rows),
        'initialY': decimal(header['initial_y']),
        'hydrogen': round(hydrogen[0], 8),
    }


def massive_data(path):
    header, rows = read_saved_model(path)
    if rows[-1]['mlt_vc'] <= 0:
        raise ValueError('The massive example is expected to have a convective core')
    boundary = next(i for i in reversed(range(len(rows))) if rows[i]['mlt_vc'] <= 0)
    return {**saved_data(header, rows), 'coreKm': round(between(rows, boundary, 0.5), 2)}


def giant_data(path):
    header, rows = read_saved_model(path)
    convection = [i for i, row in enumerate(rows) if row['conv_vel'] > 0]
    outside, inside = convection[0], convection[-1]
    if len(convection) != inside - outside + 1:
        raise ValueError('Expected one contiguous convective envelope in the giant mesh')
    i, fraction = crossing(rows, lambda row: row['h1'], 0.01)
    core = between(rows, i, fraction)
    core_luminosity = between(rows, i, fraction, 'L')
    # The outward increase in L locates the shell heating in this saved model.
    # Its plotted outer edge is where 95% of the rise to the envelope base is reached.
    shell_level = core_luminosity + 0.95 * (rows[inside]['L'] - core_luminosity)
    away_from_core = rows[:i + 1][::-1]
    shell_i, shell_fraction = crossing(away_from_core, lambda row: row['L'], shell_level)
    return {
        **saved_data(header, rows),
        'coreKm': round(core, 2),
        'burningShellKm': round(between(away_from_core, shell_i, shell_fraction), 2),
        'envelopeBaseKm': round(between(rows, inside, 0.5), 2),
        'envelopeTopKm': round(between(rows, outside - 1, 0.5), 2),
    }


def white_dwarf_data(path):
    header, rows = read_saved_model(path)

    def helium(row):
        return row['he3'] + row['he4']

    i, fraction = crossing(rows, lambda row: row['h1'] - helium(row), 0)
    below_hydrogen = rows[i + 1:]
    j, core_fraction = crossing(below_hydrogen, lambda row: helium(row) - row['c12'] - row['o16'] - row['o18'], 0)
    return {
        **saved_data(header, rows),
        'coreKm': round(between(below_hydrogen, j, core_fraction), 2),
        'heliumOutsideKm': round(between(rows, i, fraction), 2),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', type=Path)
    args = parser.parse_args()
    data = {}
    for key, extract in [('dwarf', dwarf_data), ('massive', massive_data), ('giant', giant_data), ('whiteDwarf', white_dwarf_data)]:
        filename, expected = SOURCES[key]
        path = args.sources / filename
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            parser.error(f'{filename} does not match the pinned SHA-256')
        data[key] = extract(path)
    print('// Derived model values. Rebuild with scripts/derive-stellar-interiors.py.')
    print('export const STELLAR_INTERIOR_DATA = ' + json.dumps(data, indent=2) + ' as const;')


if __name__ == '__main__':
    main()
