/** Mindestanforderung für Passwörter im Backoffice. */
export function passwordProblem(pw: string, repeat: string): string | null {
  if (pw.length < 10) return 'Bitte mindestens 10 Zeichen.';
  if (!/[A-Za-zÄÖÜäöüß]/.test(pw) || !/[0-9]/.test(pw))
    return 'Bitte mindestens einen Buchstaben und eine Ziffer verwenden.';
  if (pw !== repeat) return 'Die beiden Passwörter stimmen nicht überein.';
  return null;
}
