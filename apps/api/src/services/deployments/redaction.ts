const secretPatterns = [
  /(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi,
  /(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi,
  /(token\s*[:=]\s*)[^\s,;]+/gi,
  /(password\s*[:=]\s*)[^\s,;]+/gi,
  /(secret\s*[:=]\s*)[^\s,;]+/gi
];

export const redactSecrets = (value: string) => {
  let next = value;
  for (const pattern of secretPatterns) {
    next = next.replace(pattern, '$1[REDACTED]');
  }
  return next;
};
