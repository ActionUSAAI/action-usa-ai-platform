export function composeAddress(
  streetNumberName: string,
  aptSteFlr: string,
  aptSteFlrNumber: string,
  city: string,
  state: string,
  zipCode: string
): string {
  const unit = aptSteFlr && aptSteFlrNumber ? `${aptSteFlr} ${aptSteFlrNumber}` : "";
  const line1 = [streetNumberName, unit].filter(Boolean).join(", ");
  const line2 = [city, state, zipCode].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" — ");
}
