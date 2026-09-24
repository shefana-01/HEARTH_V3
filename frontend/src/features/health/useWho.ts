import { useFamily } from '@/app/FamilyProvider';

/** How to name someone in a sentence: "you" for the signed-in person, a first name for everyone else. */
export function useWho(): (personId: string) => string {
  const { me, personName } = useFamily();
  return (personId) => (personId === me?.id ? 'you' : personName(personId).split(' ')[0]);
}
