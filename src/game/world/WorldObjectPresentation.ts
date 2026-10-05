export function objectPresentation(
  kind: 'chest' | 'breakable' | 'mechanism' | 'gate',
  completed: boolean,
) {
  return {
    visible: !completed || kind === 'chest' || kind === 'mechanism',
    frame: kind === 'chest' ? (completed ? 8 : 7) : kind === 'mechanism' && completed ? 17 : null,
    rotation: kind === 'mechanism' && completed ? Math.PI / 4 : 0,
  };
}
