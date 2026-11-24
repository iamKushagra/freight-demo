export function describeReason(reason, ruleNames = []) {
  if (!reason) {
    return { label: 'Not evaluated yet', detail: 'Waiting for LaunchDarkly.' };
  }
  switch (reason.kind) {
    case 'TARGET_MATCH':
      return { label: 'Individual target', detail: 'This context key is listed in the flag’s individual targets.' };
    case 'RULE_MATCH': {
      const n = (reason.ruleIndex ?? 0) + 1;
      const name = ruleNames[reason.ruleIndex];
      return { label: `Rule ${n}`, detail: name ? `Matched rule ${n}: ${name}.` : `Matched targeting rule ${n}.` };
    }
    case 'FALLTHROUGH':
      return { label: 'Default rule', detail: 'No target or rule matched, so the default rule applies.' };
    case 'OFF':
      return { label: 'Flag off', detail: 'The flag is off in this environment, so it serves the off variation.' };
    case 'PREREQUISITE_FAILED':
      return { label: 'Prerequisite', detail: `Prerequisite flag ${reason.prerequisiteKey} did not pass.` };
    case 'ERROR':
      return {
        label: 'Error',
        detail: reason.errorKind === 'FLAG_NOT_FOUND'
          ? 'LaunchDarkly has no client-side flag with this key. Create it and enable “SDKs using Client-side ID”.'
          : `Evaluation error: ${reason.errorKind}. Serving the fallback value.`,
      };
    default:
      return { label: reason.kind, detail: '' };
  }
}
