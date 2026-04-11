/** Short English words for session folder names (adjective-noun style). */
export const ADJECTIVES = [
  'calm', 'quiet', 'swift', 'bright', 'gentle', 'brave', 'lucky', 'happy', 'clever', 'noble',
  'mighty', 'golden', 'silver', 'crimson', 'azure', 'jade', 'amber', 'ivory', 'sunny', 'misty',
  'cosmic', 'stellar', 'rapid', 'steady', 'silent', 'vivid', 'keen', 'bold', 'fair', 'wise',
  'wild', 'cool', 'warm', 'fresh', 'solid', 'grand', 'tiny', 'epic', 'prime', 'ultra',
] as const;

export const NOUNS = [
  'ocean', 'river', 'meadow', 'forest', 'canyon', 'summit', 'harbor', 'island', 'desert', 'prairie',
  'falcon', 'raven', 'tiger', 'panda', 'otter', 'badger', 'beaver', 'turtle', 'dolphin', 'orca',
  'comet', 'nebula', 'quasar', 'meteor', 'rocket', 'beacon', 'signal', 'vector', 'matrix', 'cipher',
  'hammer', 'anvil', 'compass', 'anchor', 'lantern', 'crystal', 'ember', 'frost', 'thunder', 'breeze',
  'pixel', 'kernel', 'daemon', 'socket', 'packet', 'stream', 'buffer', 'cache', 'token', 'ledger',
] as const;

export function randomSessionSlug(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const b = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  return `${a}-${b}`;
}
