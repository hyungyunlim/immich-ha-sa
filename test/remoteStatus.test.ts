import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type AccelerometerSample = Readonly<Partial<Record<'x' | 'y' | 'z', unknown>>>;

function xAxisDominant(sample: AccelerometerSample): boolean | null {
  const source = [
    'import json, sys',
    'sys.path.insert(0, sys.argv[1])',
    'from remote_status import remote_orientation_x_axis_dominant',
    'sample = json.loads(sys.argv[2])',
    'data = {"remote_status": {"status": {"sensors": {"accelerometer": sample}}}}',
    'print(json.dumps(remote_orientation_x_axis_dominant(data)))',
  ].join('\n');
  const output = execFileSync(
    'python3',
    [
      '-c',
      source,
      join(process.cwd(), 'custom_components/immich_frame'),
      JSON.stringify(sample),
    ],
    { encoding: 'utf8' },
  ).trim();
  if (output === 'true') return true;
  if (output === 'false') return false;
  if (output === 'null') return null;
  throw new Error(`Unexpected orientation result: ${output}`);
}

describe('FreeKiosk accelerometer orientation', () => {
  it('reports on when the X axis clearly dominates', () => {
    // Given
    const sample = { x: 9.6, y: 0.3, z: 1.2 } as const;

    // When
    const result = xAxisDominant(sample);

    // Then
    expect(result).toBe(true);
  });

  it('reports off when the Y axis clearly dominates', () => {
    // Given
    const sample = { x: -0.2, y: -9.5, z: 1.1 } as const;

    // When
    const result = xAxisDominant(sample);

    // Then
    expect(result).toBe(false);
  });

  it('is unavailable when the device is lying flat', () => {
    // Given
    const sample = { x: 0.2, y: 0.1, z: 9.8 } as const;

    // When
    const result = xAxisDominant(sample);

    // Then
    expect(result).toBeNull();
  });

  it('is unavailable near the diagonal boundary', () => {
    // Given
    const sample = { x: 6.9, y: 6.7, z: 0.2 } as const;

    // When
    const result = xAxisDominant(sample);

    // Then
    expect(result).toBeNull();
  });

  it('is unavailable when an accelerometer axis is missing', () => {
    // Given
    const sample = { x: 9.6, z: 0.2 } as const;

    // When
    const result = xAxisDominant(sample);

    // Then
    expect(result).toBeNull();
  });

  it('does not interpret booleans as numeric accelerometer values', () => {
    // Given
    const sample = { x: true, y: 0.2, z: 0.1 } as const;

    // When
    const result = xAxisDominant(sample);

    // Then
    expect(result).toBeNull();
  });
});
