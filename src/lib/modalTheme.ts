// Shared dark palette for app modals (Settings, PersonEditor, RelationshipEditor,
// GedcomImport, ProjectManager, WelcomeModal). CoffeeModal stays light because
// the embedded Ko-fi iframe is a light surface and reads as its own thing.

export const M = {
  overlayBg: 'rgba(0, 0, 0, 0.55)',     // a touch heavier than the original 0.3 so dark panels pop
  panelBg: '#1e1e2e',
  headerBarBg: '#27293b',
  inputBg: '#313244',
  inputBgRaised: '#3a3c4f',
  border: '#45475a',
  borderSubtle: '#313244',
  text: '#ffffff',
  textSubtle: '#a6adc8',
  textMuted: '#7f849c',
  accent: '#6d7ce5',
  danger: '#f38ba8',
  dangerBgHover: 'rgba(243, 139, 168, 0.12)',
  itemHover: '#313244',
}
