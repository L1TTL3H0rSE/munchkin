export function evaluateStopState({
  session,
  plan,
  scope,
  registryIssues = [],
}) {
  const warnings = registryIssues.map((issue) => (
    `registry ${issue.planId}: ${issue.code}`
  ));
  if (!session) {
    return {
      block: false,
      warnings,
      reasons: [],
    };
  }

  const performedWrites = (scope?.changed?.length ?? 0) > 0
    || (session.ledger?.targets?.length ?? 0) > 0;
  const reasons = [];
  if (!plan && performedWrites) {
    reasons.push("selected plan is missing or no longer active");
  }
  if (!scope && performedWrites) {
    reasons.push("scope check is unavailable");
  }
  if (scope?.error && performedWrites) {
    reasons.push(`scope check failed: ${scope.error}`);
  }
  if (scope?.outsideWriteSet?.length) {
    reasons.push(`${scope.outsideWriteSet.length} path(s) outside selected write set`);
  }
  if (
    performedWrites
    && plan
    && ["approved", "in_progress"].includes(plan.status)
    && plan.unchecked > 0
  ) {
    reasons.push(`${plan.unchecked} unchecked plan item(s) remain`);
  }
  if (performedWrites && (scope?.missingRequiredChecks?.length ?? 0) > 0) {
    reasons.push(`${scope.missingRequiredChecks.length} required check(s) remain`);
  }
  if (scope?.unledgered?.length) {
    warnings.push(`${scope.unledgered.length} changed path(s) were not recorded by post-write hooks`);
  }

  return {
    block: performedWrites && reasons.length > 0,
    warnings,
    reasons,
  };
}
