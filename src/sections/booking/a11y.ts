export type FieldErrorLike = { message?: string };

/** Verknüpft Fehlermeldung und Hinweis eines Formularfelds per aria-describedby. */
export function a11y(id: string, error?: FieldErrorLike, hint?: boolean) {
  const describedBy = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
}
