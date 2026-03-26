import '@testing-library/jest-dom/vitest';

// Some components call scrollTo on navigation.
Object.defineProperty(window, 'scrollTo', {value: () => {}, writable: true});

// JSDOM doesn't implement object URLs; stub for avatar previews.
if (!('createObjectURL' in URL)) {
  (URL as any).createObjectURL = () => 'blob:mock';
}
if (!('revokeObjectURL' in URL)) {
  (URL as any).revokeObjectURL = () => {};
}

// Some environments define it but throw; keep it stable for tests.
try {
  URL.revokeObjectURL('blob:mock');
} catch {
  (URL as any).revokeObjectURL = () => {};
}
