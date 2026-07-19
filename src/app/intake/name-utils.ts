export function composeFullName(familyName: string, givenName: string, middleName: string): string {
  return [givenName, middleName, familyName].filter(Boolean).join(" ").trim();
}
