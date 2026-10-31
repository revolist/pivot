import { load as loadPivot } from './pivot';
export function load(parentSelector: string): ReturnType<typeof loadPivot> {
  return loadPivot(parentSelector, [], { initialPreset: 'profit', chartTitle: 'Pivot Financial Analysis Demo' });
}
